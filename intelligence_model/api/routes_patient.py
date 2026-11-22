"""Read-only patient access to persisted sessions. No generation or session creation.

Every query is scoped to the upstream-verified patient identity. These routes
cannot be used anonymously by running the intelligence app standalone.
"""
import json
import math
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse

from .deps import get_current_patient, get_db

router = APIRouter(prefix="/patient", tags=["patient"])
OUTPUT_ROOT = Path(__file__).resolve().parents[2] / "chatbot/05_voice_chat/output"


def _checkpoint(patient_id, session_id):
    """Find only a checkpoint matching both verified ownership and session.

    Old sessions have no DB artifact path. Never accept a browser-supplied path,
    follow a symlink outside this trusted directory, or publish output statically.
    """
    root = OUTPUT_ROOT.resolve()
    for candidate in sorted(root.glob("session_*/turns.json"), reverse=True):
        if not candidate.resolve().is_relative_to(root):
            continue
        try:
            if candidate.stat().st_size > 5_000_000:
                continue
            data = json.loads(candidate.read_text(encoding="utf-8"))
            if isinstance(data, dict) and data.get("patient_id") == patient_id and data.get("session_id") == session_id and isinstance(data.get("turns"), list):
                return candidate.parent, data["turns"]
        except (OSError, ValueError):
            continue
    return None, []


def _graph(directory):
    if directory is None:
        return None
    path = directory / "mental_state.png"
    if path.is_file() and path.resolve().is_relative_to(directory.resolve()) and path.resolve().is_relative_to(OUTPUT_ROOT.resolve()):
        return path
    return None


def _score(value, maximum=100):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return value if math.isfinite(value) and 0 <= value <= maximum else None


def _session(row):
    return {
        "id": row["session_id"], "started_at": row["start_time"],
        "ended_at": row["end_time"], "turn_count": row["turn_count"],
        "mean_score": _score(row["mean_score"]),
    }


SESSION_QUERY = """
    SELECT s.session_id, s.start_time, s.end_time, s.turn_count, m.mean_score
    FROM sessions s LEFT JOIN session_summary m
      ON m.session_id = s.session_id AND m.patient_id = s.patient_id
    WHERE s.patient_id = ?
"""


@router.get("/sessions")
def sessions(response: Response, patient_id=Depends(get_current_patient), conn=Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    rows = conn.execute(SESSION_QUERY + " ORDER BY s.start_time DESC, s.session_id DESC", (patient_id,)).fetchall()
    return {"sessions": [_session(row) for row in rows]}


@router.get("/sessions/{session_id}")
def session_detail(session_id: str, response: Response,
                   patient_id=Depends(get_current_patient), conn=Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    row = conn.execute(SESSION_QUERY + " AND s.session_id = ?", (patient_id, session_id)).fetchone()
    if row is None:
        # Same response for another person's session and an unknown ID.
        raise HTTPException(status_code=404, detail="Session not found")
    turns = conn.execute("""SELECT turn_id, timestamp, transcript, turn_score FROM turns
        WHERE patient_id = ? AND session_id = ? ORDER BY timestamp, turn_id""",
        (patient_id, session_id)).fetchall()
    report_row = conn.execute("""SELECT report_json FROM chatbot_session_reports
        WHERE patient_id = ? AND session_id = ?""", (patient_id, session_id)).fetchone()
    report = None
    if report_row:
        try:
            saved = json.loads(report_row["report_json"])
            if not isinstance(saved, dict):
                raise ValueError("Invalid persisted report")
            points = []
            for turn in saved.get("turns", []):
                score = _score(turn.get("distress_score"), 10)
                elapsed = turn.get("elapsed_seconds")
                if score is not None and isinstance(elapsed, (int, float)) and not isinstance(elapsed, bool) and math.isfinite(elapsed) and elapsed >= 0:
                    points.append({"seconds": elapsed, "score": score})
            report = {
                "summary": saved.get("clinician_summary") if isinstance(saved.get("clinician_summary"), str) else None,
                "message": saved.get("patient_message") if isinstance(saved.get("patient_message"), str) else None,
                "timeline": sorted(points, key=lambda point: point["seconds"]),
            }
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(status_code=500, detail="Saved report could not be read")
    directory, checkpoint_turns = _checkpoint(patient_id, session_id)
    replies = {t.get("turn_id"): t for t in checkpoint_turns if isinstance(t, dict) and isinstance(t.get("turn_id"), str)}
    messages = []
    complete = bool(turns)
    for turn in turns:
        messages.append({"id": turn["turn_id"], "role": "patient", "text": turn["transcript"], "timestamp": turn["timestamp"]})
        checkpoint = replies.get(turn["turn_id"], {})
        reply = checkpoint.get("reply")
        if checkpoint.get("text") == turn["transcript"] and isinstance(reply, str) and reply.strip():
            messages.append({"id": turn["turn_id"] + ":reply", "role": "assistant", "text": reply, "timestamp": None})
        else:
            complete = False
    return {
        **_session(row),
        "messages": messages, "conversation_complete": complete,
        "graph_available": _graph(directory) is not None,
        "report": report,
    }


@router.get("/sessions/{session_id}/graph")
def session_graph(session_id: str, patient_id=Depends(get_current_patient), conn=Depends(get_db)):
    if conn.execute("SELECT 1 FROM sessions WHERE patient_id = ? AND session_id = ?", (patient_id, session_id)).fetchone() is None:
        raise HTTPException(status_code=404, detail="Session not found")
    directory, _ = _checkpoint(patient_id, session_id)
    path = _graph(directory)
    if path is None:
        raise HTTPException(status_code=404, detail="Graph not available")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "no-store"})
