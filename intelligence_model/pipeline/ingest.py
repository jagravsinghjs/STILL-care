"""
pipeline/ingest.py

The single entry point Modules 6-9's integration layer calls into. Two
functions, deliberately kept separate (see this package's README):

- ingest_turn(): fires once per conversational turn. Only ever inserts.
- end_session_and_run(): fires once, explicitly, when the caller knows a
  session has closed. Marks the session ended and triggers the full
  Module 11-17 chain via orchestrator.run_pipeline().

Neither function commits the connection itself -- consistent with every
other module in this project (db/repository.py's functions never
auto-commit; the caller does). Production callers (api/, or whatever
wraps this) are expected to commit after a successful call, same as every
test fixture in this codebase already does.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from db.repository import create_session, end_session, get_session, insert_turn
from schemas.schemas import TurnRecord
from .orchestrator import PipelineResult, run_pipeline


def ingest_turn(turn: TurnRecord, conn=None) -> None:
    """
    Inserts one turn. If this is the first turn seen for turn.session_id,
    creates the sessions row first (get-or-create) -- there's no separate
    "start_session" entry point anywhere in pipeline/, so this is the only
    place a session can come into existence.
    """
    existing = get_session(turn.session_id, conn=conn)
    if existing is None:
        create_session(turn.session_id, turn.patient_id, turn.timestamp, conn=conn)
    insert_turn(turn, conn=conn)


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