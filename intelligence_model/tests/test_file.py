"""
tests/test_db_layer.py

Pytest coverage for db/connection.py + db/repository.py. Each test gets a
fresh, isolated SQLite file (via pytest's tmp_path fixture) with schema.sql
applied — no test touches your real data/still.db, and tests never
interfere with each other.

Run with:
    pytest tests/test_db_layer.py -v
"""

from datetime import datetime, timedelta

import pytest

from db.connection import get_raw_connection, init_schema
from db import repository as repo
from schemas.schemas import (
    Alert,
    AlertStatus,
    ArousalFeatures,
    ArousalLabel,
    ContributingFeature,
    DistressTrend,
    EmotionScores,
    EscalationRisk,
    ExplanationFactor,
    InterventionCategory,
    InterventionRecommendation,
    RiskExplanation,
    RiskLevel,
    RiskStatus,
    RiskTier,
    SessionSummary,
    TrendLabel,
    TurnRecord,
)

NOW = datetime(2026, 9, 6, 10, 0, 0)


@pytest.fixture
def conn(tmp_path):
    """A single connection to a fresh, schema-initialized temp DB."""
    db_path = tmp_path / "test_still.db"
    init_schema(db_path=db_path)
    connection = get_raw_connection(db_path=db_path)
    yield connection
    connection.close()


def _sample_arousal() -> ArousalFeatures:
    return ArousalFeatures(
        pitch_mean=120.0, pitch_std=15.0, energy=0.6,
        zero_crossing_rate=0.1, pause_ratio=0.3, arousal_label=ArousalLabel.HIGH,
    )


def _sample_emotion() -> EmotionScores:
    return EmotionScores(anger=0.2, disgust=0.05, fear=0.4, joy=0.05, neutral=0.1, sadness=0.15, surprise=0.05)


# --------------------------------------------------------------------------
# sessions + turns
# --------------------------------------------------------------------------

def test_session_lifecycle(conn):
    repo.create_session("sess1", "pat1", NOW, conn=conn)
    row = repo.get_session("sess1", conn=conn)
    assert row["patient_id"] == "pat1"
    assert row["end_time"] is None
    assert row["turn_count"] == 0

    repo.end_session("sess1", NOW + timedelta(minutes=20), turn_count=3, conn=conn)
    row = repo.get_session("sess1", conn=conn)
    assert row["turn_count"] == 3
    assert row["end_time"] is not None


def test_get_recent_sessions_ordered_newest_first(conn):
    repo.create_session("sess_old", "pat1", NOW - timedelta(days=1), conn=conn)
    repo.create_session("sess_new", "pat1", NOW, conn=conn)
    recent = repo.get_recent_sessions("pat1", conn=conn)
    assert [r["session_id"] for r in recent] == ["sess_new", "sess_old"]


def test_insert_turn_and_update_score(conn):
    repo.create_session("sess1", "pat1", NOW, conn=conn)
    turn = TurnRecord(
        turn_id="t1", session_id="sess1", patient_id="pat1", timestamp=NOW,
        transcript="hello", arousal=_sample_arousal(), emotion=_sample_emotion(),
    )
    repo.insert_turn(turn, conn=conn)

    turns_back = repo.get_turns_for_session("sess1", conn=conn)
    assert len(turns_back) == 1
    assert turns_back[0].transcript == "hello"
    assert turns_back[0].arousal.arousal_label == ArousalLabel.HIGH

    # unscored turns are excluded from the timeline until Module 11 scores them
    assert repo.get_turn_scores_for_session("sess1", conn=conn) == []

    repo.update_turn_score("t1", 72.5, flagged_high_pause=True, conn=conn)
    scores = repo.get_turn_scores_for_session("sess1", conn=conn)
    assert len(scores) == 1
    assert scores[0].score == 72.5
    assert scores[0].flagged_high_pause is True


def test_turns_ordered_chronologically(conn):
    repo.create_session("sess1", "pat1", NOW, conn=conn)
    for i, minute in enumerate([10, 0, 5]):  # inserted out of order
        turn = TurnRecord(
            turn_id=f"t{i}", session_id="sess1", patient_id="pat1",
            timestamp=NOW + timedelta(minutes=minute), transcript=f"turn {i}",
            arousal=_sample_arousal(), emotion=_sample_emotion(),
        )
        repo.insert_turn(turn, conn=conn)
    ordered = repo.get_turns_for_session("sess1", conn=conn)
    assert [t.turn_id for t in ordered] == ["t1", "t2", "t0"]  # minute 0, 5, 10


# --------------------------------------------------------------------------
# session_summary
# --------------------------------------------------------------------------

def test_session_summary_upsert_and_recent(conn):
    repo.create_session("sess1", "pat1", NOW, conn=conn)
    summary = SessionSummary(
        session_id="sess1", patient_id="pat1", start_time=NOW,
        end_time=NOW + timedelta(minutes=20), turn_count=1, mean_score=72.5,
        max_score=72.5, min_score=72.5, volatility=0.0, within_session_trend=0.0,
        timeline=[],
    )
    repo.upsert_session_summary(summary, computed_at=NOW, conn=conn)
    row = repo.get_session_summary_row("sess1", conn=conn)
    assert row["mean_score"] == 72.5

    # upsert again with a changed value -- should update, not duplicate
    summary.mean_score = 80.0
    repo.upsert_session_summary(summary, computed_at=NOW + timedelta(minutes=1), conn=conn)
    row = repo.get_session_summary_row("sess1", conn=conn)
    assert row["mean_score"] == 80.0

    recent = repo.get_recent_session_summaries("pat1", conn=conn)
    assert len(recent) == 1


# --------------------------------------------------------------------------
# distress_trend
# --------------------------------------------------------------------------

def test_distress_trend_latest_wins(conn):
    older = DistressTrend(
        patient_id="pat1", computed_at=NOW - timedelta(days=1), window_sessions=2,
        slope=0.1, trend_label=TrendLabel.IMPROVING, confidence=0.5,
    )
    newer = DistressTrend(
        patient_id="pat1", computed_at=NOW, window_sessions=3,
        slope=-0.5, trend_label=TrendLabel.WORSENING, confidence=0.7,
    )
    repo.insert_distress_trend(older, conn=conn)
    repo.insert_distress_trend(newer, conn=conn)
    latest = repo.get_latest_distress_trend("pat1", conn=conn)
    assert latest.trend_label == TrendLabel.WORSENING
    assert latest.confidence == 0.7


# --------------------------------------------------------------------------
# escalation_risk
# --------------------------------------------------------------------------

def test_escalation_risk_round_trip_with_features(conn):
    repo.create_session("sess1", "pat1", NOW, conn=conn)
    risk = EscalationRisk(
        patient_id="pat1", session_id="sess1", assessed_at=NOW, risk_score=68.0,
        risk_level=RiskLevel.HIGH, acute_override=False,
        contributing_features=[
            ContributingFeature(name="trend_slope", value=-0.5, weight=0.6),
            ContributingFeature(name="recent_volatility", value=12.0, weight=0.4),
        ],
    )
    repo.insert_escalation_risk(risk, conn=conn)

    fetched = repo.get_escalation_risk("pat1", "sess1", conn=conn)
    assert fetched.risk_score == 68.0
    assert len(fetched.contributing_features) == 2
    assert fetched.contributing_features[0].name == "trend_slope"

    latest = repo.get_latest_escalation_risk("pat1", conn=conn)
    assert latest.session_id == "sess1"


def test_escalation_risk_acute_override_flag_persists(conn):
    repo.create_session("sess1", "pat1", NOW, conn=conn)
    risk = EscalationRisk(
        patient_id="pat1", session_id="sess1", assessed_at=NOW, risk_score=95.0,
        risk_level=RiskLevel.HIGH, acute_override=True, contributing_features=[],
    )
    repo.insert_escalation_risk(risk, conn=conn)
    fetched = repo.get_escalation_risk("pat1", "sess1", conn=conn)
    assert fetched.acute_override is True


# --------------------------------------------------------------------------
# risk_explanation
# --------------------------------------------------------------------------

def test_risk_explanation_round_trip(conn):
    repo.create_session("sess1", "pat1", NOW, conn=conn)
    # risk_explanation has a real FK to escalation_risk(patient_id, session_id) --
    # Module 14 explains Module 13's output, so that row must exist first.
    repo.insert_escalation_risk(
        EscalationRisk(
            patient_id="pat1", session_id="sess1", assessed_at=NOW, risk_score=68.0,
            risk_level=RiskLevel.HIGH, acute_override=False, contributing_features=[],
        ),
        conn=conn,
    )
    explanation = RiskExplanation(
        patient_id="pat1", session_id="sess1", generated_at=NOW,
        top_factors=[
            ExplanationFactor(description="Three sessions of worsening trend", contribution=0.6),
            ExplanationFactor(description="High recent volatility", contribution=0.3),
        ],
    )
    repo.insert_risk_explanation(explanation, conn=conn)
    fetched = repo.get_risk_explanation("pat1", "sess1", conn=conn)
    assert fetched.top_factors[0].description == "Three sessions of worsening trend"
    assert fetched.top_factors[0].contribution > fetched.top_factors[1].contribution


# --------------------------------------------------------------------------
# risk_status
# --------------------------------------------------------------------------

def test_risk_status_upsert_and_hysteresis_fields(conn):
    status = RiskStatus(
        patient_id="pat1", tier=RiskTier.YELLOW, tier_since=NOW,
        previous_tier=RiskTier.GREEN, consecutive_high_assessments=1,
    )
    repo.upsert_risk_status(status, conn=conn)
    fetched = repo.get_risk_status("pat1", conn=conn)
    assert fetched.tier == RiskTier.YELLOW
    assert fetched.consecutive_high_assessments == 1

    # a second upsert (e.g. next session's assessment) should update in place
    status.consecutive_high_assessments = 2
    repo.upsert_risk_status(status, conn=conn)
    fetched = repo.get_risk_status("pat1", conn=conn)
    assert fetched.consecutive_high_assessments == 2


def test_get_risk_status_missing_patient_returns_none(conn):
    assert repo.get_risk_status("nobody", conn=conn) is None


# --------------------------------------------------------------------------
# alerts
# --------------------------------------------------------------------------

def test_alert_lifecycle_unacked_to_acked(conn):
    alert = Alert(
        alert_id="al1", patient_id="pat1", triggered_at=NOW,
        tier=RiskTier.YELLOW, reason="tier transition green->yellow",
    )
    repo.insert_alert(alert, conn=conn)

    unacked = repo.get_unacknowledged_alerts("pat1", conn=conn)
    assert len(unacked) == 1
    assert unacked[0].status == AlertStatus.UNACKNOWLEDGED

    repo.acknowledge_alert("al1", "supervisor_1", NOW + timedelta(minutes=1), conn=conn)
    assert repo.get_unacknowledged_alerts("pat1", conn=conn) == []

    repo.resolve_alert("al1", conn=conn)  # shouldn't raise


def test_get_unacknowledged_alerts_without_patient_filter(conn):
    repo.insert_alert(Alert(alert_id="a1", patient_id="pat1", triggered_at=NOW, tier=RiskTier.YELLOW, reason="r1"), conn=conn)
    repo.insert_alert(Alert(alert_id="a2", patient_id="pat2", triggered_at=NOW, tier=RiskTier.RED, reason="r2"), conn=conn)
    all_unacked = repo.get_unacknowledged_alerts(conn=conn)  # no patient_id -> all patients
    assert {a.alert_id for a in all_unacked} == {"a1", "a2"}


# --------------------------------------------------------------------------
# intervention_recommendation
# --------------------------------------------------------------------------

def test_intervention_recommendation_pending_then_decided(conn):
    rec = InterventionRecommendation(
        recommendation_id="rec1", patient_id="pat1", generated_at=NOW,
        categories=[InterventionCategory.COUNSELLING, InterventionCategory.LEGAL_AID],
        rationale=["Worsening trend suggests counselling", "Acute keyword suggests legal aid"],
    )
    repo.insert_intervention_recommendation(rec, conn=conn)

    pending = repo.get_pending_interventions("pat1", conn=conn)
    assert len(pending) == 1
    assert pending[0].accepted is None
    assert pending[0].categories == [InterventionCategory.COUNSELLING, InterventionCategory.LEGAL_AID]
    assert pending[0].rationale[1] == "Acute keyword suggests legal aid"

    repo.record_intervention_decision("rec1", accepted=True, reviewed_by="supervisor_1", conn=conn)
    assert repo.get_pending_interventions("pat1", conn=conn) == []