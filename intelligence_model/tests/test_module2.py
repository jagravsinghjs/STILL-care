"""
tests/test_module2.py

Verifies Module 12 (module2_distress_monitoring/trend_engine.py). Reuses
the DB-per-test isolation pattern from test_module1.py.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from db.connection import get_raw_connection, init_schema
from db.repository import create_session, get_latest_distress_trend, insert_turn, end_session
from modules.module1_session_analysis import analyze_session
from modules.module2_distress_monitoring import compute_trend
from schemas.schemas import ArousalFeatures, ArousalLabel, EmotionScores, TrendLabel, TurnRecord

PATIENT_ID = "patient-001"
BASE_DAY = datetime(2026, 1, 1, 9, 0, 0)


@pytest.fixture
def conn(tmp_path):
    db_path = tmp_path / "test_still.db"
    init_schema(db_path=db_path)
    connection = get_raw_connection(db_path=db_path)
    yield connection
    connection.close()


def _single_turn_session(conn, session_id: str, day_offset: int, pause_ratio: float) -> None:
    """
    Creates a one-turn session on BASE_DAY + day_offset days, then runs it
    through analyze_session() so session_summary gets a real row (with a
    real computed_at) -- driving mean_score entirely via pause_ratio
    (LOW arousal, zero emotion) keeps this simple and decoupled from
    test_module1.py's TurnScorer target table.
    """
    ts = BASE_DAY + timedelta(days=day_offset)
    create_session(session_id, PATIENT_ID, ts, conn=conn)
    turn = TurnRecord(
        turn_id=f"{session_id}-t0",
        session_id=session_id,
        patient_id=PATIENT_ID,
        timestamp=ts,
        transcript="placeholder",
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


def test_insufficient_data_with_zero_sessions(conn):
    trend = compute_trend(PATIENT_ID, conn=conn)

    assert trend.window_sessions == 0
    assert trend.trend_label == TrendLabel.INSUFFICIENT_DATA
    assert trend.slope == pytest.approx(0.0)
    assert trend.confidence == pytest.approx(0.0)
    # Persisted even though insufficient -- not skipped.
    assert get_latest_distress_trend(PATIENT_ID, conn=conn) is not None


def test_insufficient_data_with_one_session(conn):
    _single_turn_session(conn, "s1", day_offset=0, pause_ratio=0.5)

    trend = compute_trend(PATIENT_ID, conn=conn)

    assert trend.window_sessions == 1
    assert trend.trend_label == TrendLabel.INSUFFICIENT_DATA


def test_worsening_trend_negative_slope(conn):
    """
    pause_ratio (hence mean_score) rises sharply session-to-session -> raw
    still_core slope is positive (mean_score increasing) -> stored slope
    must be negative (worsening), per the locked sign convention.
    """
    for i, pause in enumerate([0.1, 0.3, 0.5, 0.7, 0.9]):
        _single_turn_session(conn, f"s{i}", day_offset=i, pause_ratio=pause)

    trend = compute_trend(PATIENT_ID, conn=conn)

    assert trend.window_sessions == 5
    assert trend.slope < 0
    assert trend.trend_label == TrendLabel.WORSENING


def test_improving_trend_positive_slope(conn):
    """Mirror of the worsening case: mean_score falls over time -> stored
    slope must be positive (improving)."""
    for i, pause in enumerate([0.9, 0.7, 0.5, 0.3, 0.1]):
        _single_turn_session(conn, f"s{i}", day_offset=i, pause_ratio=pause)

    trend = compute_trend(PATIENT_ID, conn=conn)

    assert trend.slope > 0
    assert trend.trend_label == TrendLabel.IMPROVING


def test_stable_trend_within_threshold(conn):
    """Flat mean_score across sessions -> slope ~0, well within the ±1.5
    stable band."""
    for i in range(5):
        _single_turn_session(conn, f"s{i}", day_offset=i, pause_ratio=0.5)

    trend = compute_trend(PATIENT_ID, conn=conn)

    assert abs(trend.slope) < 1.5
    assert trend.trend_label == TrendLabel.STABLE


def test_window_capped_at_ten_most_recent(conn):
    """12 sessions exist; compute_trend should only use the 10 most recent."""
    for i in range(12):
        _single_turn_session(conn, f"s{i}", day_offset=i, pause_ratio=0.5)

    trend = compute_trend(PATIENT_ID, conn=conn)

    assert trend.window_sessions == 10