"""
tests/test_pipeline_integration.py

End-to-end: feeds a multi-session synthetic patient timeline through
ingest.py + orchestrator.py and asserts the final risk_status/alerts/
intervention_recommendation rows match expectations. Unlike the
per-module test files, this one never calls a module function directly
-- everything goes through ingest_turn()/end_session_and_run(), the same
way Modules 6-9's integration layer would.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from db.connection import get_raw_connection, init_schema
from db.repository import get_risk_status, get_unacknowledged_alerts, get_pending_interventions
from pipeline.ingest import end_session_and_run, ingest_turn
from schemas.schemas import ArousalFeatures, ArousalLabel, EmotionScores, RiskTier, TurnRecord

PATIENT_ID = "patient-001"
BASE_DAY = datetime(2026, 1, 1, 9, 0, 0)


@pytest.fixture
def conn(tmp_path):
    db_path = tmp_path / "test_still.db"
    init_schema(db_path=db_path)
    connection = get_raw_connection(db_path=db_path)
    yield connection
    connection.close()


def _run_one_session(conn, session_id: str, day_offset: int, pause_ratio: float,
                      transcript: str = "placeholder"):
    """Ingests one single-turn session through ingest.py end to end."""
    ts = BASE_DAY + timedelta(days=day_offset)
    turn = TurnRecord(
        turn_id=f"{session_id}-t0", session_id=session_id, patient_id=PATIENT_ID,
        timestamp=ts, transcript=transcript,
        arousal=ArousalFeatures(pitch_mean=0.0, pitch_std=0.0, energy=0.0,
                                 zero_crossing_rate=0.0, pause_ratio=pause_ratio,
                                 arousal_label=ArousalLabel.LOW),
        emotion=EmotionScores(anger=0, disgust=0, fear=0, joy=0, neutral=0, sadness=0, surprise=0),
    )
    ingest_turn(turn, conn=conn)
    conn.commit()
    result = end_session_and_run(session_id, ts, 1, conn=conn)
    conn.commit()
    return result


def test_first_session_creates_full_chain(conn):
    result = _run_one_session(conn, "s1", day_offset=0, pause_ratio=0.1)

    assert result.summary is not None
    assert result.trend is not None  # INSUFFICIENT_DATA (only 1 session), but still produced
    assert result.risk is not None
    assert result.explanation is not None
    assert result.new_status is not None
    assert result.old_status is None  # first-ever assessment -- nothing to compare against
    assert result.alert is None  # no prior status -> Module 16 can't detect a transition


def test_ingest_turn_auto_creates_session_row(conn):
    """No explicit 'start session' call exists anywhere -- ingest_turn
    must create the sessions row itself on first sight of a new session_id."""
    from db.repository import get_session

    assert get_session("brand-new-session", conn=conn) is None
    ts = BASE_DAY
    turn = TurnRecord(
        turn_id="t0", session_id="brand-new-session", patient_id=PATIENT_ID,
        timestamp=ts, transcript="hi",
        arousal=ArousalFeatures(pitch_mean=0.0, pitch_std=0.0, energy=0.0,
                                 zero_crossing_rate=0.0, pause_ratio=0.1,
                                 arousal_label=ArousalLabel.LOW),
        emotion=EmotionScores(anger=0, disgust=0, fear=0, joy=0, neutral=0, sadness=0, surprise=0),
    )
    ingest_turn(turn, conn=conn)
    conn.commit()
    assert get_session("brand-new-session", conn=conn) is not None


def test_escalating_patient_reaches_red_and_alerts(conn):
    """Six sessions of steadily worsening severity, same shape as
    test_module3.py's escalation scenario, run entirely through ingest.py
    this time -- should drive tier to RED and fire an [ESCALATION] alert
    somewhere along the way."""
    stages = [0.1, 0.3, 0.5, 0.7, 0.9, 1.0]
    last_result = None
    for i, pause in enumerate(stages):
        last_result = _run_one_session(conn, f"esc-s{i}", day_offset=i, pause_ratio=pause)

    final_status = get_risk_status(PATIENT_ID, conn=conn)
    assert final_status is not None
    assert final_status.tier == RiskTier.RED

    # At least one [ESCALATION] alert should have fired somewhere in this run.
    alerts = get_unacknowledged_alerts(PATIENT_ID, conn=conn)
    assert any(a.reason.startswith("[ESCALATION]") for a in alerts)

    # RED tier -> Module 17 should have proposed COUNSELLING + PROTECTION_RELOCATION.
    pending = get_pending_interventions(PATIENT_ID, conn=conn)
    assert len(pending) >= 1


def test_acute_language_triggers_full_chain_to_red(conn):
    """A single session with acute-risk language should end-to-end: force
    RED tier, fire an [ACUTE] alert, and recommend MEDICAL."""
    result = _run_one_session(
        conn, "acute-s1", day_offset=0, pause_ratio=0.1,
        transcript="I feel okay today but sometimes I want to end it all.",
    )

    assert result.risk.acute_override is True
    assert result.new_status.tier == RiskTier.RED

    alerts = get_unacknowledged_alerts(PATIENT_ID, conn=conn)
    assert any(a.reason.startswith("[ACUTE]") for a in alerts)

    pending = get_pending_interventions(PATIENT_ID, conn=conn)
    assert any("MEDICAL" in [c.value.upper() for c in rec.categories] for rec in pending)


def test_zero_turn_session_short_circuits_entire_pipeline(conn):
    """A session that gets ended with zero turns (no ingest_turn call at
    all) should produce a PipelineResult with everything but
    session_id/patient_id set to None -- Module 11's skip propagates all
    the way through."""
    from db.repository import create_session

    create_session("empty-session", PATIENT_ID, BASE_DAY, conn=conn)
    conn.commit()

    result = end_session_and_run("empty-session", BASE_DAY, 0, conn=conn)
    conn.commit()

    assert result.summary is None
    assert result.trend is None
    assert result.risk is None
    assert result.new_status is None

def _run_one_session(conn, session_id: str, day_offset: int, pause_ratio: float,
                      arousal_label: ArousalLabel = ArousalLabel.LOW,
                      emotion_mass: float = 0.0,
                      transcript: str = "placeholder"):
    """Ingests one single-turn session through ingest.py end to end."""
    ts = BASE_DAY + timedelta(days=day_offset)
    turn = TurnRecord(
        turn_id=f"{session_id}-t0", session_id=session_id, patient_id=PATIENT_ID,
        timestamp=ts, transcript=transcript,
        arousal=ArousalFeatures(pitch_mean=0.0, pitch_std=0.0, energy=0.0,
                                 zero_crossing_rate=0.0, pause_ratio=pause_ratio,
                                 arousal_label=arousal_label),
        emotion=EmotionScores(anger=min(emotion_mass, 1.0), disgust=0, fear=0, joy=0,
                               neutral=0, sadness=0, surprise=0),
    )
    ingest_turn(turn, conn=conn)
    conn.commit()
    result = end_session_and_run(session_id, ts, 1, conn=conn)
    conn.commit()
    print(f"  {session_id}: risk_score={result.risk.risk_score:.1f} "
          f"level={result.risk.risk_level.value} tier={result.new_status.tier.value}")
    return result


def test_escalating_patient_reaches_red_and_alerts(conn):
    """Ramp then hold at max severity -- long enough to clear BOTH
    3-in-a-row thresholds (GREEN->YELLOW, then YELLOW->RED) back to back.
    Print output (run with `pytest -s`) shows the real risk_score/level/
    tier per session so the exact escalation point is visible rather than
    hand-computed."""
    stages = [
        (ArousalLabel.LOW,      0.1, 0.0),
        (ArousalLabel.LOW,      0.3, 0.2),
        (ArousalLabel.MODERATE, 0.5, 0.4),
        (ArousalLabel.MODERATE, 0.6, 0.5),
        (ArousalLabel.MODERATE, 0.7, 0.6),
        (ArousalLabel.HIGH,     0.8, 0.7),
        (ArousalLabel.HIGH,     0.9, 0.9),
        (ArousalLabel.HIGH,     1.0, 1.0),
        (ArousalLabel.HIGH,     1.0, 1.0),
        (ArousalLabel.HIGH,     1.0, 1.0),
    ]
    for i, (label, pause, mass) in enumerate(stages):
        _run_one_session(conn, f"esc-s{i}", day_offset=i, pause_ratio=pause,
                          arousal_label=label, emotion_mass=mass)

    final_status = get_risk_status(PATIENT_ID, conn=conn)
    assert final_status is not None
    assert final_status.tier == RiskTier.RED

    alerts = get_unacknowledged_alerts(PATIENT_ID, conn=conn)
    assert any(a.reason.startswith("[ESCALATION]") for a in alerts)

    pending = get_pending_interventions(PATIENT_ID, conn=conn)
    assert len(pending) >= 1