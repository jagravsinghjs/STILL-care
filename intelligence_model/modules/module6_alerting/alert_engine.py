"""
modules/module6_alerting/alert_engine.py

Module 16 -- the only module permitted to write to `alerts`. Watches
risk_status before/after a Module 15 update plus the triggering
EscalationRisk's acute_override flag, and decides whether/what to alert.
Detect + notify only -- never acts autonomously, matching the PS's
requirement that alerts go to humans.

Alert.reason carries a category prefix ([ESCALATION] / [ACUTE] /
[PROGRESS]) since Alert's schema has no dedicated priority/category field
and is immutable -- this is a workaround, not a schema feature. Downstream
consumers (api/routes_alerts.py, the dashboard) can parse this prefix to
sort/style alerts differently. If a schema migration ever becomes
acceptable, a real `category`/`priority` column would be cleaner than
parsing a string prefix.

Rules (locked-in):
- acute_override -> always alerts, tagged [ACUTE], regardless of whether
  the tier actually changed (re-flagging matters even if already at RED).
- Tier gets worse (no acute_override) -> alerts, tagged [ESCALATION].
- Tier improves -> alerts, tagged [PROGRESS], encouraging tone -- lower
  priority than [ESCALATION]/[ACUTE] by convention, not by any field.
- No tier change and no acute_override -> no alert.
- No prior risk_status (patient's first-ever assessment) -> no alert;
  nothing to compare against yet.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from db.repository import insert_alert
from modules.module5_risk_classification.tier_classifier import TIER_ORDER
from schemas.schemas import Alert, EscalationRisk, RiskStatus
from .notifier import notify_alertd


def _escalation_reason(old_tier, new_tier) -> str:
    return f"[ESCALATION] Risk tier increased from {old_tier.value} to {new_tier.value}."


def _progress_reason(old_tier, new_tier) -> str:
    return (
        f"[PROGRESS] Encouraging news: risk tier improved from {old_tier.value} "
        f"to {new_tier.value}. Recent sessions show sustained improvement."
    )


def _acute_reason(session_id: str, tier_changed: bool, new_tier) -> str:
    if tier_changed:
        return (
            f"[ACUTE] Immediate high-risk language detected in session {session_id}, "
            f"escalating tier to {new_tier.value}."
        )
    return (
        f"[ACUTE] Immediate high-risk language detected in session {session_id} "
        f"while already at {new_tier.value} tier -- re-flagged for review."
    )


def check_and_alert(
    risk: EscalationRisk,
    old_status: Optional[RiskStatus],
    new_status: RiskStatus,
    conn=None,
) -> Optional[Alert]:
    """
    Compares old_status -> new_status (Module 15's before/after) plus
    risk.acute_override, inserts an Alert if warranted, and best-effort
    notifies alertd. Returns the Alert if one was created, else None.
    """
    tier_changed = old_status is not None and old_status.tier != new_status.tier

    if risk.acute_override:
        reason = _acute_reason(risk.session_id, tier_changed, new_status.tier)
    elif old_status is None:
        return None  # first-ever assessment -- nothing to compare against
    elif not tier_changed:
        return None  # stable, no acute flag -- nothing to alert on
    elif TIER_ORDER[new_status.tier] > TIER_ORDER[old_status.tier]:
        reason = _escalation_reason(old_status.tier, new_status.tier)
    else:
        reason = _progress_reason(old_status.tier, new_status.tier)

    alert = Alert(
        alert_id=str(uuid.uuid4()),
        patient_id=risk.patient_id,
        triggered_at=datetime.now(timezone.utc),
        tier=new_status.tier,
        reason=reason,
    )
    insert_alert(alert, conn=conn)
    notify_alertd(alert)  # best-effort; failure here never undoes the insert above
    return alert