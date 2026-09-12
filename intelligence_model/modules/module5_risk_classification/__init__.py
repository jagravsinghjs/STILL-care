"""
Module 15 (Status & Risk Classification) -- package entry point.

Consumes: an EscalationRisk (Module 13's output).
Produces: one persisted RiskStatus per patient, updated in place --
the green/yellow/red tier supervisors actually look at, with hysteresis
so it doesn't flicker on noisy single-session data.
"""

from __future__ import annotations

from datetime import datetime, timezone

from db.repository import get_risk_status, upsert_risk_status
from schemas.schemas import EscalationRisk, RiskStatus
from .hysteresis import apply_hysteresis
from .tier_classifier import candidate_tier


def classify_status(risk: EscalationRisk, conn=None) -> RiskStatus:
    current = get_risk_status(risk.patient_id, conn=conn)
    candidate = candidate_tier(risk.risk_level)
    now = datetime.now(timezone.utc)

    new_status = apply_hysteresis(
        patient_id=risk.patient_id,
        candidate=candidate,
        acute_override=risk.acute_override,
        current=current,
        now=now,
    )
    upsert_risk_status(new_status, conn=conn)
    return new_status


__all__ = ["classify_status"]