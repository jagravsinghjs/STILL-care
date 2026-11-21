"""
api/routes_reports.py — Module 11 surface.

Endpoints for fetching a session's SessionSummary or PDF report.
Read-only: this reconstructs a SessionSummary from already-persisted
rows (session_summary + turns), it never re-runs analyze_session() --
recomputing on every GET would be wasteful and would silently diverge
from whatever the pipeline actually stored if scoring logic changes.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse

from db.repository import get_session, get_session_summary_row, get_turn_scores_for_session
from db.repository import (
    get_chatbot_report, get_turns_for_session, get_escalation_risk, get_risk_explanation,
    get_risk_status, get_latest_distress_trend,
)
from modules.module1_session_analysis import generate_report
from schemas.schemas import SessionSummary
from .deps import get_current_supervisor, get_db

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{session_id}/combined")
def get_combined_report(session_id: str, conn=Depends(get_db), _=Depends(get_current_supervisor)):
    session = get_session(session_id, conn=conn)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    patient_id = session["patient_id"]
    conversation = get_chatbot_report(session_id, conn=conn)
    if conversation is not None:
        report = conversation.pop("report")
        conversation.update({
            "score_scale": {"min": 0, "max": 10, "method": "LLM estimate"},
            "clinician_summary": report.get("clinician_summary"),
            "turns": report.get("turns", report.get("segments", [])),
        })
        # Patient closing message and raw transcript are not part of this view.
    return {
        "session_id": session_id, "patient_id": patient_id,
        "conversation_report": conversation,
        "monitoring_score_scale": {"min": 0, "max": 100, "method": "heuristic numeric core"},
        "session_summary": _load_session_summary(session_id, conn),
        "session_risk": get_escalation_risk(patient_id, session_id, conn=conn),
        "session_explanation": get_risk_explanation(patient_id, session_id, conn=conn),
        "current_patient_status": get_risk_status(patient_id, conn=conn),
        "latest_patient_trend": get_latest_distress_trend(patient_id, conn=conn),
        "analysis_quality": [{"turn_id": t.turn_id,
                              "pitch_available": t.arousal.pitch_available,
                              "audio_status": t.arousal.audio_status,
                              "emotion_status": t.emotion.analysis_status,
                              "emotion_source": t.emotion.source}
                             for t in get_turns_for_session(session_id, conn=conn)],
    }


def _load_session_summary(session_id: str, conn) -> Optional[SessionSummary]:
    session_row = get_session(session_id, conn=conn)
    if session_row is None:
        return None
    summary_row = get_session_summary_row(session_id, conn=conn)
    if summary_row is None:
        return None  # session exists but was never summarized (e.g. zero-turn skip)

    timeline = get_turn_scores_for_session(session_id, conn=conn)
    return SessionSummary(
        session_id=session_id,
        patient_id=session_row["patient_id"],
        start_time=session_row["start_time"],
        end_time=session_row["end_time"],
        turn_count=len(timeline),
        mean_score=summary_row["mean_score"],
        max_score=summary_row["max_score"],
        min_score=summary_row["min_score"],
        volatility=summary_row["volatility"],
        within_session_trend=summary_row["within_session_trend"],
        timeline=timeline,
    )


@router.get("/{session_id}/summary", response_model=SessionSummary)
def get_summary(session_id: str, conn=Depends(get_db), _=Depends(get_current_supervisor)):
    summary = _load_session_summary(session_id, conn)
    if summary is None:
        raise HTTPException(status_code=404, detail=f"No summary available for session {session_id!r}")
    return summary


@router.get("/{session_id}/pdf")
def get_pdf(session_id: str, background_tasks: BackgroundTasks,
            conn=Depends(get_db), _=Depends(get_current_supervisor)):
    summary = _load_session_summary(session_id, conn)
    if summary is None:
        raise HTTPException(status_code=404, detail=f"No summary available for session {session_id!r}")

    # Written to a temp file rather than held in memory as bytes --
    # generate_report()'s existing signature takes a path, and reusing it
    # unchanged avoids a second code path for PDF generation.
    tmp_path = Path(tempfile.mkstemp(suffix=".pdf")[1])
    generate_report(summary, str(tmp_path))
    background_tasks.add_task(tmp_path.unlink, missing_ok=True)  # cleanup after response is sent

    return FileResponse(
        tmp_path,
        media_type="application/pdf",
        filename=f"session_{session_id}_report.pdf",
    )
