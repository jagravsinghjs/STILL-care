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
from modules.module1_session_analysis import generate_report
from schemas.schemas import SessionSummary
from .deps import get_current_supervisor, get_db

router = APIRouter(prefix="/reports", tags=["reports"])


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