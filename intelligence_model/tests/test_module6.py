"""tests/test_module6.py -- Module 16 (alert & escalation)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from db.connection import get_raw_connection, init_schema
from db.repository import get_unacknowledged_alerts
from modules.module6_alerting import check_and_alert
from modules.module6_alerting.notifier import notify_alertd
from schemas.schemas import Alert, AlertStatus, EscalationRisk, RiskLevel, RiskStatus, RiskTier

PATIENT_ID = "patient-001"
NOW = datetime.now(timezone.utc)


@pytest.fixture
def conn(tmp_path):
    db_path = tmp_path / "test_still.db"
    init_schema(db_path=db_path)
    connection = get_raw_connection(db_path=db_path)
    yield connection
    connection.close()


def _status(tier: RiskTier, previous: RiskTier | None = None) -> RiskStatus:
    return RiskStatus(
        patient_id=PATIENT_ID, tier=tier, tier_since=NOW,
        previous_tier=previous, consecutive_high_assessments=0,
    )


def _risk(level: RiskLevel, acute: bool = False, session_id: str = "s1") -> EscalationRisk:
    return EscalationRisk(
        patient_id=PATIENT_ID, session_id=session_id, assessed_at=NOW,
        risk_score=0.0, risk_level=level, acute_override=acute, contributing_features=[],
    )


def test_no_prior_status_no_alert(conn):
    alert = check_and_alert(_risk(RiskLevel.LOW), old_status=None, new_status=_status(RiskTier.GREEN), conn=conn)
    assert alert is None


def test_no_tier_change_no_alert(conn):
    alert = check_and_alert(
        _risk(RiskLevel.MODERATE),
        old_status=_status(RiskTier.YELLOW),
        new_status=_status(RiskTier.YELLOW),
        conn=conn,
    )
    assert alert is None


def test_escalation_creates_high_priority_alert(conn):
    alert = check_and_alert(
        _risk(RiskLevel.HIGH),
        old_status=_status(RiskTier.YELLOW),
        new_status=_status(RiskTier.RED, previous=RiskTier.YELLOW),
        conn=conn,
    )
    assert alert is not None
    assert alert.tier == RiskTier.RED
    assert alert.reason.startswith("[ESCALATION]")
    assert alert.status == AlertStatus.UNACKNOWLEDGED

    stored = get_unacknowledged_alerts(PATIENT_ID, conn=conn)
    assert len(stored) == 1


def test_deescalation_creates_low_priority_progress_alert(conn):
    alert = check_and_alert(
        _risk(RiskLevel.MODERATE),
        old_status=_status(RiskTier.RED),
        new_status=_status(RiskTier.YELLOW, previous=RiskTier.RED),
        conn=conn,
    )
    assert alert is not None
    assert alert.tier == RiskTier.YELLOW
    assert alert.reason.startswith("[PROGRESS]")


def test_acute_override_alerts_even_without_tier_change(conn):
    """Already at RED, another acute match arrives -- must still alert."""
    alert = check_and_alert(
        _risk(RiskLevel.HIGH, acute=True),
        old_status=_status(RiskTier.RED),
        new_status=_status(RiskTier.RED),  # no tier change
        conn=conn,
    )
    assert alert is not None
    assert alert.tier == RiskTier.RED
    assert alert.reason.startswith("[ACUTE]")
    assert "already at" in alert.reason


def test_acute_override_alerts_with_tier_change(conn):
    alert = check_and_alert(
        _risk(RiskLevel.HIGH, acute=True),
        old_status=_status(RiskTier.GREEN),
        new_status=_status(RiskTier.RED, previous=RiskTier.GREEN),
        conn=conn,
    )
    assert alert is not None
    assert alert.reason.startswith("[ACUTE]")
    assert "escalating tier" in alert.reason


def test_notify_alertd_never_raises_when_alertd_absent():
    """alertd doesn't exist yet -- this must fail gracefully, not raise."""
    alert = Alert(
        alert_id="a1", patient_id=PATIENT_ID, triggered_at=NOW,
        tier=RiskTier.RED, reason="[ESCALATION] test",
    )
    result = notify_alertd(alert)  # should not raise
    assert result is False