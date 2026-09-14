"""
api/routes_supervisor_view.py

A second, REDACTED read path alongside routes_dashboard.py /
routes_reports.py -- those two return the full numeric contract
(mean_score, risk_score, slope, volatility, ...) that Module 13/14 need
internally. This file is what should actually reach the frontend: it
returns exactly the shape src/types/index.ts already defines
(RiskLevel = 'green'|'yellow'|'red', a distress-trend label, a
plain-language reason) and NO raw floats.

Mount this alongside the existing routers in api/main.py:

    from .routes_supervisor_view import router as supervisor_view_router
    app.include_router(supervisor_view_router)

Don't delete routes_dashboard.py / routes_reports.py -- clinicians or a
future internal tool may legitimately want the numeric detail. This is
specifically the path the patient-privacy-conscious frontend should be
pointed at instead.

ONE THING THIS FILE ASSUMES YOU'LL DECIDE: src/types/index.ts currently
defines `DistressTrend = 'improving' | 'worsening'` (2 values) for BOTH
a single check-in's within-session trend (genuinely 2-valued -- a
session either trended up or it didn't) AND a patient's cross-session
trend (schemas.TrendLabel has 4 values: improving/stable/worsening/
insufficient_data). Collapsing those extra two into the existing 2
means either lying that a brand-new patient with one session is
"improving" (false reassurance) or "worsening" (needless alarm) when
really there's just no trend yet. My recommendation: extend the
frontend type instead of collapsing here -- see the chat message this
came with for the exact 1-line diff. PATIENT_TREND_LABEL_MAP below
implements the collapse as a fallback ONLY, in case you decide you'd
rather not touch the frontend type; swap callers to
_trend_label_passthrough if/when you do extend it.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.repository import (
    get_escalation_risk,
    get_latest_distress_trend,
    get_latest_escalation_risk,
    get_recent_sessions,
    get_risk_explanation,
    get_risk_status,
    get_session_summary_row,
)
from schemas.schemas import RiskTier, TrendLabel
from .deps import get_current_supervisor, get_db

router = APIRouter(prefix="/supervisor-view", tags=["supervisor-view"])


# ---------------------------------------------------------------------------
# response shapes -- deliberately mirror src/types/index.ts field-for-field
# ---------------------------------------------------------------------------

class PatientStatusView(BaseModel):
    """Shape for Patient.currentRiskLevel / Patient.distressTrend."""
    risk_level: str          # 'green' | 'yellow' | 'red' -- RiskTier.value, no translation needed
    distress_trend: str      # see PATIENT_TREND_LABEL_MAP below
    plain_language_reason: Optional[str] = None


class SessionView(BaseModel):
    """Shape for SupervisorSessionSummary (CheckInSession minus transcript)."""
    session_id: str
    risk_level: str
    distress_trend: str      # genuinely 2-valued here -- see module docstring
    plain_language_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# trend-label translation
# ---------------------------------------------------------------------------

# Fallback ONLY -- see module docstring. Prefer extending the frontend
# type over using this.
PATIENT_TREND_LABEL_MAP: dict[TrendLabel, str] = {
    TrendLabel.IMPROVING: "improving",
    TrendLabel.STABLE: "worsening",         # <- deliberately conservative,
    TrendLabel.WORSENING: "worsening",      #    not deliberately correct;
    TrendLabel.INSUFFICIENT_DATA: "worsening",  # see docstring, fix this
}
# The three-way collapse above biases toward over-flagging rather than
# under-flagging when forced into a 2-valued type, on the theory that a
# false "keep watching this" costs less than a false "all clear" in this
# domain. That is a real, debatable safety/UX tradeoff dressed up as a
# one-line dict -- it should not quietly ship this way. Extend the
# frontend type instead and swap to _trend_label_passthrough.


def _trend_label_passthrough(label: TrendLabel) -> str:
    """Use this once src/types/index.ts's DistressTrend includes all 4 values."""
    return label.value


def _patient_trend_label(label: TrendLabel) -> str:
    return PATIENT_TREND_LABEL_MAP[label]


def _session_trend_label(within_session_trend: float) -> str:
    """
    Genuinely 2-valued -- reuses the exact sign convention
    modules/module1_session_analysis/report_generator.py already uses
    (within_session_trend > 0 => worsening).
    """
    return "worsening" if within_session_trend > 0 else "improving"


# ---------------------------------------------------------------------------
# plain-language reason -- reuses Module 14's existing prose, doesn't
# regenerate it
# ---------------------------------------------------------------------------

def _top_reason(patient_id: str, session_id: Optional[str], conn) -> Optional[str]:
    """
    Pulls the highest-ranked ExplanationFactor.description already
    produced by Module 14 for this session, if one exists. Returns None
    if Module 14 hasn't run for this session yet (e.g. a session with a
    zero-turn skip) -- callers should degrade gracefully, not error.
    """
    if session_id is None:
        return None
    explanation = get_risk_explanation(patient_id, session_id, conn=conn)
    if explanation is None or not explanation.top_factors:
        return None
    return explanation.top_factors[0].description


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------

@router.get("/{patient_id}/status", response_model=PatientStatusView)
def get_patient_status_view(patient_id: str, conn=Depends(get_db), _=Depends(get_current_supervisor)):
    """
    The redacted equivalent of routes_dashboard.py's /status + /trend
    combined into one payload -- no tier_since timestamps, no slope, no
    confidence, no risk_score. Just what src/types/index.ts's Patient
    type actually declares.
    """
    status = get_risk_status(patient_id, conn=conn)
    if status is None:
        raise HTTPException(status_code=404, detail=f"No risk status yet for patient {patient_id!r}")

    trend = get_latest_distress_trend(patient_id, conn=conn)
    distress_trend = _patient_trend_label(trend.trend_label) if trend is not None else "worsening"
    # ^ same conservative-default reasoning as PATIENT_TREND_LABEL_MAP's
    # INSUFFICIENT_DATA case -- no trend row yet at all is the same
    # "don't know" situation, handled the same way for the same reason.

    latest_risk = get_latest_escalation_risk(patient_id, conn=conn)
    reason = None
    if latest_risk is not None:
        reason = _top_reason(patient_id, latest_risk.session_id, conn=conn)

    return PatientStatusView(
        risk_level=status.tier.value,
        distress_trend=distress_trend,
        plain_language_reason=reason,
    )


@router.get("/{patient_id}/sessions", response_model=list[SessionView])
def get_patient_sessions_view(patient_id: str, conn=Depends(get_db), _=Depends(get_current_supervisor)):
    """
    The redacted equivalent of routes_dashboard.py's /history -- one
    entry per recent session, risk_level + distress_trend + a
    plain-language reason, no mean_score/volatility floats.

    risk_level here is the RAW per-session EscalationRisk.risk_level
    (mapped straight across: LOW/MODERATE/HIGH share RiskTier's
    green/yellow/red vocabulary already), which is intentionally NOT
    the same value as the patient's overall RiskStatus.tier from
    get_patient_status_view() above -- that one is hysteresis-smoothed
    across sessions, this one is what THIS session's assessment alone
    said. Showing both is fine; just don't assume they always agree,
    that's the whole point of hysteresis existing.
    """
    session_rows = get_recent_sessions(patient_id, conn=conn)

    views: list[SessionView] = []
    for row in session_rows:
        session_id = row["session_id"]
        summary_row = get_session_summary_row(session_id, conn=conn)
        if summary_row is None:
            continue  # zero-turn session, Module 11 skipped it -- nothing to show

        risk = get_escalation_risk(patient_id, session_id, conn=conn)
        risk_level = risk.risk_level.value if risk is not None else None
        # risk_level values are 'low'/'moderate'/'high' (RiskLevel enum);
        # frontend expects 'green'/'yellow'/'red' (RiskTier vocabulary).
        # They're 1:1 via tier_classifier.candidate_tier -- reuse it
        # rather than re-encoding the same mapping a second time here.
        from modules.module5_risk_classification.tier_classifier import candidate_tier
        from schemas.schemas import RiskLevel as _RiskLevel

        mapped_risk_level = (
            candidate_tier(_RiskLevel(risk_level)).value if risk_level is not None else "green"
        )

        views.append(
            SessionView(
                session_id=session_id,
                risk_level=mapped_risk_level,
                distress_trend=_session_trend_label(summary_row["within_session_trend"]),
                plain_language_reason=_top_reason(patient_id, session_id, conn=conn),
            )
        )
    return views