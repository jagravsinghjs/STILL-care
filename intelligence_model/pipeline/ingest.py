"""
pipeline/ingest.py

The single entry point Modules 6-9's integration layer calls into. Two
functions, deliberately kept separate (see this package's README):

- ingest_turn(): stores a turn and immediately checks supervisor-review triggers.
- end_session_and_run(): fires once, explicitly, when the caller knows a
  session has closed. Marks the session ended and triggers the full
  Module 11-17 chain via orchestrator.run_pipeline().

With conn=None, repository operations open, commit and close their own
connections. When a connection is supplied, the caller owns its transaction.
save_conversation_report() stores an existing LLM report without rescoring it.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
import logging

from db.repository import create_session, end_session, get_session, insert_turn, upsert_chatbot_report
from schemas.schemas import Alert, TurnRecord
from .orchestrator import PipelineResult, run_pipeline
from modules.module6_alerting import check_session_review


def ingest_turn(turn: TurnRecord, conn=None) -> Optional[Alert]:
    """
    Inserts one turn. If this is the first turn seen for turn.session_id,
    creates the sessions row first (get-or-create) -- there's no separate
    "start_session" entry point anywhere in pipeline/, so this is the only
    place a session can come into existence. Returns a new/upgraded review
    alert if warranted; ordinary repeats do not produce another notification.
    """
    existing = get_session(turn.session_id, conn=conn)
    if existing is None:
        create_session(turn.session_id, turn.patient_id, turn.timestamp, conn=conn)
    elif existing["patient_id"] != turn.patient_id:
        raise ValueError("Session belongs to a different patient")
    insert_turn(turn, conn=conn)
    try:
        return check_session_review(turn.session_id, conn=conn)
    except Exception as error:
        # A stored turn must not be reported as failed ingestion. Finalization
        # retries alert assessment, and this warning exposes the failed check.
        logging.getLogger(__name__).warning("Turn saved, but early supervisor-review check failed: %s", error)
        return None


def save_conversation_report(session_id: str, report: dict, model: str, conn=None) -> None:
    """Public chatbot-to-intelligence entry point for an already-generated report."""
    upsert_chatbot_report(session_id, report, model, datetime.now(timezone.utc), conn=conn)


def end_session_and_run(
    session_id: str,
    end_time: datetime,
    turn_count: int,
    conn=None,
) -> Optional[PipelineResult]:
    """
    Marks session_id ended, then runs the full Module 11-17 chain via
    orchestrator.run_pipeline(). end_time and turn_count come from the
    caller (Modules 6-9's integration layer) -- this function has no way
    to know either on its own, matching end_session()'s own required
    signature in db/repository.py.
    """
    end_session(session_id, end_time, turn_count, conn=conn)
    return run_pipeline(session_id, conn=conn)
