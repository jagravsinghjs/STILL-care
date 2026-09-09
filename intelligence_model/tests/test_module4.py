"""tests/test_module4.py -- Module 14 (explainability)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from db.connection import get_raw_connection, init_schema
from db.repository import create_session, insert_escalation_risk
from modules.module4_explainability import explain_risk
from schemas.schemas import ContributingFeature, EscalationRisk, RiskLevel

PATIENT_ID = "patient-001"


@pytest.fixture
def conn(tmp_path):
    db_path = tmp_path / "test_still.db"
    init_schema(db_path=db_path)
    connection = get_raw_connection(db_path=db_path)
    yield connection
    connection.close()


def _risk(conn, features: list[ContributingFeature], acute: bool = False, session_id: str = "s1") -> EscalationRisk:
    """
    Builds an EscalationRisk AND persists the full FK chain it depends on:
    escalation_risk.session_id -> REFERENCES sessions(session_id), and
    risk_explanation (patient_id, session_id) -> REFERENCES
    escalation_risk(patient_id, session_id). Both are real, enforced FKs
    (PRAGMA foreign_keys = ON in connection.py) -- skipping the sessions
    row is what broke the previous version of this helper.
    """
    now = datetime.now(timezone.utc)
    create_session(session_id, PATIENT_ID, now, conn=conn)

    risk = EscalationRisk(
        patient_id=PATIENT_ID,
        session_id=session_id,
        assessed_at=now,
        risk_score=75.0,
        risk_level=RiskLevel.HIGH,
        acute_override=acute,
        contributing_features=features,
    )
    insert_escalation_risk(risk, conn=conn)
    conn.commit()
    return risk


def test_ranks_by_absolute_weight_descending(conn):
    risk = _risk(conn, [
        ContributingFeature(name="recent_volatility", value=30.0, weight=0.25),
        ContributingFeature(name="trend_slope", value=-4.0, weight=0.36),
        ContributingFeature(name="session_mean_score", value=80.0, weight=0.35),
    ])
    explanation = explain_risk(risk, conn=conn)

    weights_in_order = [round(f.contribution, 6) for f in explanation.top_factors]
    assert weights_in_order == sorted(weights_in_order, reverse=True)
    assert weights_in_order[0] == pytest.approx(0.36)


def test_acute_override_produces_dedicated_phrase(conn):
    risk = _risk(
        conn,
        [ContributingFeature(name="acute_override", value=1.0, weight=1.0)],
        acute=True,
    )
    explanation = explain_risk(risk, conn=conn)
    assert "acute-risk" in explanation.top_factors[0].description


def test_unknown_feature_name_falls_back_gracefully(conn):
    risk = _risk(conn, [ContributingFeature(name="some_future_feature", value=42.0, weight=0.5)])
    explanation = explain_risk(risk, conn=conn)
    assert "42.00" in explanation.top_factors[0].description


def test_persisted_and_retrievable(conn):
    from db.repository import get_risk_explanation

    risk = _risk(conn, [ContributingFeature(name="trend_slope", value=-2.0, weight=0.4)])
    explain_risk(risk, conn=conn)

    stored = get_risk_explanation(PATIENT_ID, "s1", conn=conn)
    assert stored is not None
    assert len(stored.top_factors) == 1