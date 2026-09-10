"""
api/routes_interventions.py — supervisor accept/dismiss on Module 17's
proposals.

GET for listing pending InterventionRecommendations, PATCH for recording
a decision. accepted starts as None (pending) on every recommendation --
this router is the only thing that ever sets it to True/False.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from db.repository import get_pending_interventions, record_intervention_decision
from schemas.schemas import InterventionRecommendation
from .deps import get_current_supervisor, get_db

router = APIRouter(prefix="/interventions", tags=["interventions"])


class InterventionDecision(BaseModel):
    accepted: bool


@router.get("/{patient_id}", response_model=list[InterventionRecommendation])
def list_pending(patient_id: str, conn=Depends(get_db), _=Depends(get_current_supervisor)):
    return get_pending_interventions(patient_id, conn=conn)


@router.patch("/{recommendation_id}/decision", status_code=204)
def decide(
    recommendation_id: str,
    decision: InterventionDecision,
    conn=Depends(get_db),
    supervisor_id: str = Depends(get_current_supervisor),
):
    record_intervention_decision(recommendation_id, decision.accepted, reviewed_by=supervisor_id, conn=conn)