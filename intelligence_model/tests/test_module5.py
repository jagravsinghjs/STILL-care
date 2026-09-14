"""tests/test_module5.py -- Module 15 (status & risk classification)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from db.connection import get_raw_connection, init_schema
from modules.module5_risk_classification import classify_status
from schemas.schemas import EscalationRisk, RiskLevel, RiskTier

PATIENT_ID = "patient-001"


@pytest.fixture
def conn(tmp_path):
    db_path = tmp_path / "test_still.db"
    init_schema(db_path=db_path)
    connection = get_raw_connection(db_path=db_path)
    yield connection
    connection.close()


def _risk(level: RiskLevel, session_id: str, acute: bool = False) -> EscalationRisk:
    return EscalationRisk(
        patient_id=PATIENT_ID,
        session_id=session_id,
        assessed_at=datetime.now(timezone.utc),
        risk_score=0.0,
        risk_level=level,
        acute_override=acute,
        contributing_features=[],
    )


def test_new_patient_starts_green(conn):
    status = classify_status(_risk(RiskLevel.LOW, "s1"), conn=conn)
    assert status.tier == RiskTier.GREEN


def test_single_high_reading_does_not_escalate(conn):
    """One bad reading alone must not flip the tier -- the whole point of hysteresis."""
    status = classify_status(_risk(RiskLevel.HIGH, "s1"), conn=conn)
    assert status.tier == RiskTier.GREEN
    assert status.consecutive_high_assessments == 1


def test_three_consecutive_moderate_escalates_green_to_yellow(conn):
    for i in range(3):
        status = classify_status(_risk(RiskLevel.MODERATE, f"s{i}"), conn=conn)
    assert status.tier == RiskTier.YELLOW
    assert status.consecutive_high_assessments == 0  # reset after stepping


def test_escalation_steps_one_tier_at_a_time_even_with_high_readings(conn):
    """3 consecutive HIGH readings from GREEN -> only reaches YELLOW, not RED."""
    for i in range(3):
        status = classify_status(_risk(RiskLevel.HIGH, f"s{i}"), conn=conn)
    assert status.tier == RiskTier.YELLOW


def test_full_escalation_to_red_requires_two_separate_streaks(conn):
    for i in range(3):
        classify_status(_risk(RiskLevel.HIGH, f"a{i}"), conn=conn)  # -> YELLOW
    for i in range(3):
        status = classify_status(_risk(RiskLevel.HIGH, f"b{i}"), conn=conn)  # -> RED
    assert status.tier == RiskTier.RED


def test_acute_override_forces_immediate_red_from_green(conn):
    status = classify_status(_risk(RiskLevel.LOW, "s1", acute=True), conn=conn)
    assert status.tier == RiskTier.RED
    assert status.previous_tier == RiskTier.GREEN


def test_streak_resets_on_interrupting_neutral_reading(conn):
    classify_status(_risk(RiskLevel.MODERATE, "s0"), conn=conn)
    classify_status(_risk(RiskLevel.MODERATE, "s1"), conn=conn)
    # Interrupted by a reading that matches current tier (GREEN) -- neutral, resets.
    classify_status(_risk(RiskLevel.LOW, "s2"), conn=conn)
    status = classify_status(_risk(RiskLevel.MODERATE, "s3"), conn=conn)
    assert status.tier == RiskTier.GREEN  # only 1 consecutive MODERATE since the reset
    assert status.consecutive_high_assessments == 1


def _escalate_to_red(conn) -> None:
    for i in range(6):
        classify_status(_risk(RiskLevel.HIGH, f"esc{i}"), conn=conn)


def test_red_deescalation_five_consecutive_low_readings(conn):
    _escalate_to_red(conn)
    for i in range(4):
        status = classify_status(_risk(RiskLevel.LOW, f"d{i}"), conn=conn)
        assert status.tier == RiskTier.RED  # not yet at weighted threshold 10
    status = classify_status(_risk(RiskLevel.LOW, "d4"), conn=conn)  # 5th LOW: 5*2=10
    assert status.tier == RiskTier.YELLOW


def test_red_deescalation_ten_consecutive_moderate_readings(conn):
    _escalate_to_red(conn)
    for i in range(9):
        status = classify_status(_risk(RiskLevel.MODERATE, f"d{i}"), conn=conn)
        assert status.tier == RiskTier.RED  # 9*1=9, not yet 10
    status = classify_status(_risk(RiskLevel.MODERATE, "d9"), conn=conn)  # 10th: 10*1=10
    assert status.tier == RiskTier.YELLOW


def test_red_deescalation_mixed_weighted_readings(conn):
    _escalate_to_red(conn)
    # 3 LOW (3*2=6) + 4 MODERATE (4*1=4) = 10 -> should clear threshold on the 7th.
    for level, i in [(RiskLevel.LOW, 0), (RiskLevel.LOW, 1), (RiskLevel.LOW, 2),
                      (RiskLevel.MODERATE, 3), (RiskLevel.MODERATE, 4), (RiskLevel.MODERATE, 5)]:
        status = classify_status(_risk(level, f"d{i}"), conn=conn)
        assert status.tier == RiskTier.RED  # total so far: 6 then 7,8,9 -- still under 10
    status = classify_status(_risk(RiskLevel.MODERATE, "d6"), conn=conn)  # total 10
    assert status.tier == RiskTier.YELLOW


def test_red_deescalation_resets_on_a_high_reading(conn):
    _escalate_to_red(conn)
    for i in range(4):
        classify_status(_risk(RiskLevel.LOW, f"d{i}"), conn=conn)  # 4*2=8, not yet 10
    status = classify_status(_risk(RiskLevel.HIGH, "interrupt"), conn=conn)  # neutral at RED -> reset
    assert status.tier == RiskTier.RED
    assert status.consecutive_high_assessments == 0
    # Now needs a fresh 5 LOW (or equivalent) from scratch.
    for i in range(4):
        status = classify_status(_risk(RiskLevel.LOW, f"e{i}"), conn=conn)
        assert status.tier == RiskTier.RED
    status = classify_status(_risk(RiskLevel.LOW, "e4"), conn=conn)
    assert status.tier == RiskTier.YELLOW