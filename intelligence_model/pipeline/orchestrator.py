"""
pipeline/orchestrator.py

Chains Modules 11 through 17 in order for one finished session. This is
the one place in the whole project that hard-codes "what runs after a
session ends" -- every module it calls stays ignorant of what runs
before or after it, communicating only through the database.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from db.repository import get_risk_status, get_session
from modules.module1_session_analysis import analyze_session
from modules.module2_distress_monitoring import compute_trend
from modules.module3_escalation_prediction import assess_risk
from modules.module4_explainability import explain_risk
from modules.module5_risk_classification import classify_status
from modules.module6_alerting import check_and_alert
from modules.module7_intervention import recommend_interventions
from schemas.schemas import (
    Alert,
    DistressTrend,
    EscalationRisk,
    InterventionRecommendation,
    RiskExplanation,
    RiskStatus,
    SessionSummary,
)


@dataclass
class PipelineResult:
    """
    Every intermediate artifact produced by one run_pipeline() call.
    Mirrors exactly what scripts/run_pipeline_demo.py is described as
    needing to print: summary, trend, risk, explanation, tier
    (old_status/new_status), alert, recommendation.

    Fields beyond session_id/patient_id are None when the pipeline
    short-circuited (a zero-turn session) or when a given step legitimately
    produced nothing (e.g. no Alert fired, no InterventionRecommendation
    matched).
    """
    session_id: str
    patient_id: str
    summary: Optional[SessionSummary] = None
    trend: Optional[DistressTrend] = None
    risk: Optional[EscalationRisk] = None
    explanation: Optional[RiskExplanation] = None
    old_status: Optional[RiskStatus] = None
    new_status: Optional[RiskStatus] = None
    alert: Optional[Alert] = None
    recommendation: Optional[InterventionRecommendation] = None


def run_pipeline(session_id: str, conn=None) -> PipelineResult:
    """
    Runs Module 11 -> 12 -> 13 -> 14 -> {15 -> 16} -> 17 for session_id.

    If Module 11 returns None (a zero-turn session, skipped silently per
    that module's own contract), the entire chain short-circuits --
    there's no new SessionSummary for Module 13's feature_extractor to
    use, and nothing downstream would have anything meaningful to act on.
    Returns a PipelineResult with only session_id/patient_id populated in
    that case, everything else None.
    """
    session_row = get_session(session_id, conn=conn)
    if session_row is None:
        raise ValueError(f"run_pipeline: no session found for session_id={session_id!r}")
    patient_id = session_row["patient_id"]

    summary = analyze_session(session_id, conn=conn)
    if summary is None:
        return PipelineResult(session_id=session_id, patient_id=patient_id)

    trend = compute_trend(patient_id, conn=conn)
    risk = assess_risk(patient_id, session_id, conn=conn)
    explanation = explain_risk(risk, conn=conn)

    # Captured BEFORE classify_status() updates it -- Module 16 needs the
    # before/after pair to detect a tier transition.
    old_status = get_risk_status(patient_id, conn=conn)
    new_status = classify_status(risk, conn=conn)

    alert = check_and_alert(risk, old_status, new_status, conn=conn)
    recommendation = recommend_interventions(new_status, risk.acute_override, explanation, conn=conn)

    return PipelineResult(
        session_id=session_id,
        patient_id=patient_id,
        summary=summary,
        trend=trend,
        risk=risk,
        explanation=explanation,
        old_status=old_status,
        new_status=new_status,
        alert=alert,
        recommendation=recommendation,
    )