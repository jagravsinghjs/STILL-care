"""
tests/test_module3.py

Verifies Module 13 (module3_escalation_prediction). Reuses the
DB-per-test isolation pattern and Module 11 pipeline from earlier test
files to produce real session_summary/distress_trend rows to assess
against.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from db.connection import get_raw_connection, init_schema
from db.repository import create_session, end_session, insert_turn
from modules.module1_session_analysis import analyze_session
from modules.module2_distress_monitoring import compute_trend
from modules.module3_escalation_prediction import assess_risk
from modules.module3_escalation_prediction.acute_keyword_detector import (
    detect_acute_risk,
    find_acute_matches,
)
from schemas.schemas import ArousalFeatures, ArousalLabel, EmotionScores, RiskLevel, TurnRecord

PATIENT_ID = "patient-001"
BASE_DAY = datetime(2026, 1, 1, 9, 0, 0)


@pytest.fixture
def conn(tmp_path):
    db_path = tmp_path / "test_still.db"
    init_schema(db_path=db_path)
    connection = get_raw_connection(db_path=db_path)
    yield connection
    connection.close()


def _session_with_transcript(conn, session_id: str, day_offset: int, pause_ratio: float,
                              transcript: str = "placeholder") -> None:
    ts = BASE_DAY + timedelta(days=day_offset)
    create_session(session_id, PATIENT_ID, ts, conn=conn)
    turn = TurnRecord(
        turn_id=f"{session_id}-t0",
        session_id=session_id,
        patient_id=PATIENT_ID,
        timestamp=ts,
        transcript=transcript,
        arousal=ArousalFeatures(
            pitch_mean=0.0, pitch_std=0.0, energy=0.0, zero_crossing_rate=0.0,
            pause_ratio=pause_ratio, arousal_label=ArousalLabel.LOW,
        ),
        emotion=EmotionScores(anger=0, disgust=0, fear=0, joy=0, neutral=0, sadness=0, surprise=0),
    )
    insert_turn(turn, conn=conn)
    end_session(session_id, ts, 1, conn=conn)
    conn.commit()
    analyze_session(session_id, conn=conn)
    conn.commit()


# ---------------------------------------------------------------------------
# acute_keyword_detector.py, standalone
# ---------------------------------------------------------------------------

def test_detect_acute_risk_true_on_match():
    assert detect_acute_risk("I just want to end it all sometimes.") is True


def test_detect_acute_risk_false_on_benign_text():
    assert detect_acute_risk("Today was a pretty normal day at work.") is False


def test_detect_acute_risk_case_insensitive():
    assert detect_acute_risk("I WANT TO DIE") is True


def test_find_acute_matches_returns_matched_phrases():
    matches = find_acute_matches("I want to hurt myself, I have no reason to live.")
    assert "hurt myself" in matches
    assert "no reason to live" in matches


# ---------------------------------------------------------------------------
# assess_risk() -- preconditions
# ---------------------------------------------------------------------------

def test_missing_distress_trend_raises(conn):
    _session_with_transcript(conn, "s1", day_offset=0, pause_ratio=0.5)
    # No compute_trend() called -- no distress_trend row exists yet.
    with pytest.raises(ValueError):
        assess_risk(PATIENT_ID, "s1", conn=conn)


def test_missing_session_summary_raises(conn):
    compute_trend(PATIENT_ID, conn=conn)  # window_sessions=0, but persists INSUFFICIENT_DATA row
    with pytest.raises(ValueError):
        assess_risk(PATIENT_ID, "no-such-session", conn=conn)


# ---------------------------------------------------------------------------
# assess_risk() -- risk_level thresholds
# ---------------------------------------------------------------------------

def test_low_risk_scenario(conn):
    _session_with_transcript(conn, "s1", day_offset=0, pause_ratio=0.1)
    compute_trend(PATIENT_ID, conn=conn)

    risk = assess_risk(PATIENT_ID, "s1", conn=conn)

    assert risk.risk_score <= 40.0
    assert risk.risk_level == RiskLevel.LOW
    assert risk.acute_override is False

def _escalating_sessions(conn, patient_id: str) -> str:
    """
    6 sessions of steadily worsening severity (day 0-5), final session
    maxed out. Gives compute_trend() a real, high-confidence worsening
    trend to work with -- unlike a single session, this can legitimately
    clear the HIGH threshold via weighted aggregation alone.
    Returns the final session_id (the one to call assess_risk on).
    """
    stages = [
        (ArousalLabel.LOW,      0.1, 0.0),  # score  2
        (ArousalLabel.LOW,      0.3, 0.2),  # score 14
        (ArousalLabel.MODERATE, 0.5, 0.4),  # score 46
        (ArousalLabel.MODERATE, 0.7, 0.6),  # score 58
        (ArousalLabel.HIGH,     0.9, 0.8),  # score 90
        (ArousalLabel.HIGH,     1.0, 1.0),  # score 100
    ]
    last_session_id = None
    for i, (label, pause, mass) in enumerate(stages):
        session_id = f"escalating-s{i}"
        ts = BASE_DAY + timedelta(days=i)
        create_session(session_id, patient_id, ts, conn=conn)
        turn = TurnRecord(
            turn_id=f"{session_id}-t0", session_id=session_id, patient_id=patient_id,
            timestamp=ts, transcript="placeholder",
            arousal=ArousalFeatures(pitch_mean=0.0, pitch_std=0.0, energy=0.0,
                                     zero_crossing_rate=0.0, pause_ratio=pause,
                                     arousal_label=label),
            emotion=EmotionScores(anger=min(mass, 1.0), disgust=0, fear=0, joy=0,
                                   neutral=0, sadness=0, surprise=0),
        )
        insert_turn(turn, conn=conn)
        end_session(session_id, ts, 1, conn=conn)
        conn.commit()
        analyze_session(session_id, conn=conn)
        conn.commit()
        last_session_id = session_id
    return last_session_id


def test_high_risk_scenario_from_escalating_sessions(conn):
    """
    Six sessions of steadily worsening severity -> strong worsening slope
    with real confidence (n=6) + a maxed-out final session -> HIGH via
    weighted aggregation alone, no acute language involved.
    """
    last_session_id = _escalating_sessions(conn, PATIENT_ID)
    compute_trend(PATIENT_ID, conn=conn)

    risk = assess_risk(PATIENT_ID, last_session_id, conn=conn)

    assert risk.risk_level == RiskLevel.HIGH
    assert risk.acute_override is False
    assert risk.risk_score < 100.0  # high, but not the forced-100 acute case

# ---------------------------------------------------------------------------
# acute_override end-to-end -- must force risk_score=100 and HIGH
# regardless of how benign every other signal looks.
# ---------------------------------------------------------------------------

def test_acute_override_forces_high_risk_end_to_end(conn):
    _session_with_transcript(
        conn, "s1", day_offset=0, pause_ratio=0.1,
        transcript="I feel okay today but sometimes I want to end it all.",
    )
    compute_trend(PATIENT_ID, conn=conn)

    risk = assess_risk(PATIENT_ID, "s1", conn=conn)

    assert risk.acute_override is True
    assert risk.risk_score == pytest.approx(100.0)
    assert risk.risk_level == RiskLevel.HIGH

    found_feature = any(f.name == "acute_override" for f in risk.contributing_features)
    assert found_feature


# ---------------------------------------------------------------------------
# Persistence -- upsert on (patient_id, session_id) re-assessment.
# ---------------------------------------------------------------------------

def test_reassessing_same_session_upserts(conn):
    _session_with_transcript(conn, "s1", day_offset=0, pause_ratio=0.1)
    compute_trend(PATIENT_ID, conn=conn)

    first = assess_risk(PATIENT_ID, "s1", conn=conn)
    second = assess_risk(PATIENT_ID, "s1", conn=conn)

    assert first.session_id == second.session_id == "s1"
    # Should be the same row, not two -- insert_escalation_risk's ON
    # CONFLICT clause handles this; this test just confirms the call
    # doesn't raise a UNIQUE constraint error.