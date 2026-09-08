"""
modules/module3_escalation_prediction/heuristic_model.py

Module 13 -- day-1 heuristic fallback. Calls still_core.RiskAggregator
with feature_extractor's RiskInputs to produce and persist an
EscalationRisk. Zero training-data dependency -- this is what runs before
trained_model.py exists.

risk_level cutoffs (locked-in, safety-skewed):
    risk_score <= 40           -> LOW
    40 < risk_score <= 65       -> MODERATE
    risk_score > 65             -> HIGH
acute_override forces risk_score=100.0 in risk_aggregation.cpp itself, so
it always lands in the HIGH bucket here by construction -- no special-
casing needed in this file to satisfy "acute override always forces HIGH".
"""

from __future__ import annotations

from datetime import datetime, timezone

import still_core

from db.repository import insert_escalation_risk
from schemas.schemas import ContributingFeature, EscalationRisk, RiskLevel
from .feature_extractor import build_risk_inputs

_aggregator = still_core.RiskAggregator()  # defaults from risk_aggregation.h


def _risk_level_from_score(score: float) -> RiskLevel:
    if score <= 40.0:
        return RiskLevel.LOW
    if score <= 65.0:
        return RiskLevel.MODERATE
    return RiskLevel.HIGH


def assess_risk(patient_id: str, session_id: str, conn=None) -> EscalationRisk:
    risk_inputs = build_risk_inputs(patient_id, session_id, conn=conn)
    result = _aggregator.aggregate(risk_inputs)

    risk = EscalationRisk(
        patient_id=patient_id,
        session_id=session_id,
        assessed_at=datetime.now(timezone.utc),
        risk_score=result.risk_score,
        risk_level=_risk_level_from_score(result.risk_score),
        acute_override=risk_inputs.acute_override,
        contributing_features=[
            ContributingFeature(name=f.name, value=f.value, weight=f.weight)
            for f in result.contributing_features
        ],
    )
    insert_escalation_risk(risk, conn=conn)
    return risk