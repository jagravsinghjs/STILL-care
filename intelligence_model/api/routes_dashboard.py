"""
api/routes_dashboard.py — the supervisor dashboard's patient-detail view.

Endpoints for a patient's current RiskStatus, latest DistressTrend, and
recent session history (for charting a trend line).
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db.repository import get_latest_distress_trend, get_recent_session_summaries, get_risk_status
from schemas.schemas import DistressTrend, RiskStatus
from .deps import get_current_supervisor, get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class SessionHistoryPoint(BaseModel):
    """
    Deliberately NOT the full SessionSummary (no timeline) -- the
    dashboard's trend chart only needs enough per-session data to plot a
    line, not every turn score. Keeps this endpoint's payload small for
    what's likely a frequently-polled view.
    """
    session_id: str
    computed_at: str
    mean_score: float
    volatility: float


@router.get("/{patient_id}/status", response_model=Optional[RiskStatus])
def get_status(patient_id: str, conn=Depends(get_db), _=Depends(get_current_supervisor)):
    status = get_risk_status(patient_id, conn=conn)
    if status is None:
        raise HTTPException(status_code=404, detail=f"No risk status yet for patient {patient_id!r}")
    return status


@router.get("/{patient_id}/trend", response_model=Optional[DistressTrend])
def get_trend(patient_id: str, conn=Depends(get_db), _=Depends(get_current_supervisor)):
    trend = get_latest_distress_trend(patient_id, conn=conn)
    if trend is None:
        raise HTTPException(status_code=404, detail=f"No distress trend yet for patient {patient_id!r}")
    return trend


@router.get("/{patient_id}/history", response_model=list[SessionHistoryPoint])
def get_history(
    patient_id: str,
    limit: int = Query(default=10, ge=1, le=50),
    conn=Depends(get_db),
    _=Depends(get_current_supervisor),
):
    rows = get_recent_session_summaries(patient_id, limit=limit, conn=conn)
    return [
        SessionHistoryPoint(
            session_id=row["session_id"],
            computed_at=row["computed_at"],
            mean_score=row["mean_score"],
            volatility=row["volatility"],
        )
        for row in rows
    ]