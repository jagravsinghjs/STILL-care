"""
modules/module3_escalation_prediction/feature_extractor.py

Module 13 -- turns a patient's latest DistressTrend + the triggering
session's SessionSummary + that session's transcript text into a
still_core.RiskInputs, the shared input shape both heuristic_model.py and
(eventually) trained_model.py consume identically.
"""

from __future__ import annotations

import still_core

from db.repository import get_latest_distress_trend, get_session_summary_row, get_turns_for_session
from .acute_keyword_detector import detect_acute_risk


def build_risk_inputs(patient_id: str, session_id: str, conn=None) -> "still_core.RiskInputs":
    """
    Raises ValueError if either the patient has no DistressTrend yet, or
    `session_id` has no session_summary row -- both are precondition
    violations (Modules 12 and 11 respectively must have already run for
    this call to make sense), not states to silently paper over given
    this feeds a safety-relevant risk score.
    """
    trend = get_latest_distress_trend(patient_id, conn=conn)
    if trend is None:
        raise ValueError(
            f"build_risk_inputs: no DistressTrend found for patient_id={patient_id!r} "
            "-- Module 12 must run before Module 13."
        )

    summary_row = get_session_summary_row(session_id, conn=conn)
    if summary_row is None:
        raise ValueError(
            f"build_risk_inputs: no session_summary row for session_id={session_id!r} "
            "-- Module 11 must run before Module 13."
        )

    turns = get_turns_for_session(session_id, conn=conn)
    transcript_text = " ".join(t.transcript for t in turns)
    acute_override = detect_acute_risk(transcript_text)

    return still_core.RiskInputs(
        trend_slope=trend.slope,
        trend_confidence=trend.confidence,
        session_mean_score=summary_row["mean_score"],
        session_volatility=summary_row["volatility"],
        session_within_trend=summary_row["within_session_trend"],
        acute_override=acute_override,
    )