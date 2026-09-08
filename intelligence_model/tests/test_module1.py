"""
tests/test_module1.py

Verifies Module 11 (module1_session_analysis/aggregator.py) against
hand-built turn sequences with known, hand-computed expected scores/stats
-- same reference values as core_cpp/tests/test_session_stats.cpp, so a
regression here is distinguishable from a regression in still_core itself.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from db.connection import get_raw_connection, init_schema
from db.repository import create_session, end_session, get_session_summary_row, insert_turn
from modules.module1_session_analysis import analyze_session
from schemas.schemas import ArousalFeatures, ArousalLabel, EmotionScores, TurnRecord

from modules.module1_session_analysis import generate_report



PATIENT_ID = "patient-001"
SESSION_START = datetime(2026, 1, 1, 9, 0, 0)


@pytest.fixture
def conn(tmp_path):
    """Fresh, isolated SQLite DB per test -- schema applied, connection left
    open for the test body, closed at teardown."""
    db_path = tmp_path / "test_still.db"
    init_schema(db_path=db_path)
    connection = get_raw_connection(db_path=db_path)
    yield connection
    connection.close()


def _turn(turn_id: str, session_id: str, ts: datetime, arousal_label: ArousalLabel,
          pause_ratio: float, emotion_mass: float) -> TurnRecord:
    """
    Builds a TurnRecord whose still_core.TurnScorer().score() output is
    fully hand-controlled via arousal_label / pause_ratio / emotion_mass,
    so target turn scores can be dialed in exactly rather than approximated.
    emotion_mass is distributed across anger/disgust/fear/sadness in that
    order, each capped at 1.0 (EmotionScores' own field constraint).
    """
    remaining = emotion_mass
    vals = []
    for _ in range(4):
        v = min(1.0, remaining)
        vals.append(v)
        remaining -= v
    anger, disgust, fear, sadness = vals

    return TurnRecord(
        turn_id=turn_id,
        session_id=session_id,
        patient_id=PATIENT_ID,
        timestamp=ts,
        transcript="placeholder",
        arousal=ArousalFeatures(
            pitch_mean=0.0, pitch_std=0.0, energy=0.0, zero_crossing_rate=0.0,
            pause_ratio=pause_ratio, arousal_label=arousal_label,
        ),
        emotion=EmotionScores(
            anger=anger, disgust=disgust, fear=fear, joy=0.0,
            neutral=0.0, sadness=sadness, surprise=0.0,
        ),
    )


# Hand-solved (arousal_label, pause_ratio, emotion_mass) combos that make
# TurnScorer's default formula (0.4*arousal_base + 0.2*pause*100 +
# 0.4*clamp(mass*100)) land on each exact target score.
# score = 0.4*A + 0.2*P + 0.4*E   where A in {0,50,100}, P=pause*100, E=min(mass*100,100)
_TARGET_CONFIG = {
    10: (ArousalLabel.LOW,      0.5, 0.00),  # 0  + 10 + 0
    20: (ArousalLabel.LOW,      0.5, 0.25),  # 0  + 10 + 10
    30: (ArousalLabel.LOW,      0.5, 0.50),  # 0  + 10 + 20
    40: (ArousalLabel.LOW,      0.5, 0.75),  # 0  + 10 + 30
    50: (ArousalLabel.LOW,      0.5, 1.00),  # 0  + 10 + 40
    60: (ArousalLabel.MODERATE, 0.5, 0.75),  # 20 + 10 + 30
    70: (ArousalLabel.MODERATE, 0.5, 1.00),  # 20 + 10 + 40
    80: (ArousalLabel.HIGH,     0.5, 0.75),  # 40 + 10 + 30
    90: (ArousalLabel.HIGH,     0.5, 1.00),  # 40 + 10 + 40
}

def _seed_session(conn, session_id: str, scores: list[int], ended: bool = True):
    """Creates a session and inserts one turn per target score, in order."""
    create_session(session_id, PATIENT_ID, SESSION_START, conn=conn)
    ts = SESSION_START
    for i, target in enumerate(scores):
        label, pause, mass = _TARGET_CONFIG[target]
        turn = _turn(f"{session_id}-t{i}", session_id, ts, label, pause, mass)
        insert_turn(turn, conn=conn)
        ts += timedelta(minutes=1)
    if ended:
        end_session(session_id, ts, len(scores), conn=conn)
    conn.commit()


# ---------------------------------------------------------------------------
# Monotonic sequence -- matches core_cpp/tests/test_session_stats.cpp's
# hand-computed monotonic case exactly: mean=50, max=90, min=10, trend=10.0.
# ---------------------------------------------------------------------------

def test_monotonic_sequence_stats(conn):
    session_id = "session-monotonic"
    scores = [10, 20, 30, 40, 50, 60, 70, 80, 90]
    _seed_session(conn, session_id, scores)

    summary = analyze_session(session_id, conn=conn)

    assert summary is not None
    assert summary.session_id == session_id
    assert summary.patient_id == PATIENT_ID
    assert summary.turn_count == 9
    assert [round(t.score, 6) for t in summary.timeline] == [float(s) for s in scores]

    assert summary.mean_score == pytest.approx(50.0)
    assert summary.max_score == pytest.approx(90.0)
    assert summary.min_score == pytest.approx(10.0)
    assert summary.within_session_trend == pytest.approx(10.0)
    # Sample std dev of [10,20,...,90]: hand-computed = sqrt(6000/8)
    assert summary.volatility == pytest.approx(27.386127875, abs=1e-6)

    # Persisted, not just returned in-memory.
    row = get_session_summary_row(session_id, conn=conn)
    assert row is not None
    assert row["mean_score"] == pytest.approx(50.0)
    assert row["within_session_trend"] == pytest.approx(10.0)


# ---------------------------------------------------------------------------
# Oscillating sequence -- matches test_session_stats.cpp's oscillating case:
# trend flat (first-third mean == last-third mean) but volatility high.
# ---------------------------------------------------------------------------

def test_oscillating_sequence_trend_flat_but_volatile(conn):
    session_id = "session-oscillating"
    scores = [10, 90, 10, 90, 10, 90]
    _seed_session(conn, session_id, scores)

    summary = analyze_session(session_id, conn=conn)

    assert summary is not None
    assert summary.within_session_trend == pytest.approx(0.0)
    assert summary.volatility > 30.0


# ---------------------------------------------------------------------------
# flagged_high_pause must round-trip through the DB (update_turn_score ->
# get_turn_scores_for_session) into SessionSummary.timeline.
# ---------------------------------------------------------------------------

def test_high_pause_flag_persisted(conn):
    session_id = "session-highpause"
    create_session(session_id, PATIENT_ID, SESSION_START, conn=conn)

    flagged_turn = _turn(
        "t-flagged", session_id, SESSION_START,
        ArousalLabel.LOW, pause_ratio=0.8, emotion_mass=0.0,
    )
    not_flagged_turn = _turn(
        "t-not-flagged", session_id, SESSION_START + timedelta(minutes=1),
        ArousalLabel.LOW, pause_ratio=0.3, emotion_mass=0.0,
    )
    insert_turn(flagged_turn, conn=conn)
    insert_turn(not_flagged_turn, conn=conn)
    end_session(session_id, SESSION_START + timedelta(minutes=2), 2, conn=conn)
    conn.commit()

    summary = analyze_session(session_id, conn=conn)

    assert summary is not None
    by_id = {t.turn_id: t for t in summary.timeline}
    assert by_id["t-flagged"].flagged_high_pause is True
    assert by_id["t-not-flagged"].flagged_high_pause is False


# ---------------------------------------------------------------------------
# Zero turns -> skip silently, nothing written to session_summary.
# ---------------------------------------------------------------------------

def test_zero_turns_skips_silently(conn):
    session_id = "session-empty"
    create_session(session_id, PATIENT_ID, SESSION_START, conn=conn)
    end_session(session_id, SESSION_START, 0, conn=conn)
    conn.commit()

    result = analyze_session(session_id, conn=conn)

    assert result is None
    assert get_session_summary_row(session_id, conn=conn) is None


# ---------------------------------------------------------------------------
# Nonexistent session_id -> explicit error, not a silent no-op.
# ---------------------------------------------------------------------------

def test_missing_session_raises(conn):
    with pytest.raises(ValueError):
        analyze_session("session-does-not-exist", conn=conn)