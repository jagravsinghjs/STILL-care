"""
modules/module4_explainability/explainer.py

Module 14 -- converts an EscalationRisk's contributing_features (numeric,
weighted) into a RiskExplanation with ranked, plain-language
ExplanationFactors. No computation happens here -- pure translation from
numbers to sentences, per architecture.md.
"""

from __future__ import annotations

from datetime import datetime, timezone

from db.repository import get_latest_distress_trend, insert_risk_explanation
from schemas.schemas import EscalationRisk, ExplanationFactor, RiskExplanation
from .phrase_templates import phrase_for


def explain_risk(risk: EscalationRisk, conn=None) -> RiskExplanation:
    """
    Ranks contributing_features by |weight| (highest contribution first)
    and translates each into an ExplanationFactor. If `conn` is given,
    optionally enriches the trend_slope phrase with the exact
    window_sessions count from the patient's latest DistressTrend --
    degrades gracefully to a generic phrase if conn is omitted or no
    trend row exists yet.
    """
    window_sessions = None
    if conn is not None:
        trend = get_latest_distress_trend(risk.patient_id, conn=conn)
        if trend is not None:
            window_sessions = trend.window_sessions

    ranked = sorted(risk.contributing_features, key=lambda f: abs(f.weight), reverse=True)

    top_factors = [
        ExplanationFactor(
            description=phrase_for(f.name, f.value, window_sessions),
            contribution=f.weight,
        )
        for f in ranked
    ]

    explanation = RiskExplanation(
        patient_id=risk.patient_id,
        session_id=risk.session_id,
        generated_at=datetime.now(timezone.utc),
        top_factors=top_factors,
    )
    insert_risk_explanation(explanation, conn=conn)
    return explanation