"""
api/deps.py

Shared FastAPI dependencies for every router in api/. Not listed in the
original architecture doc's file breakdown (which only names main.py +
the four routes_*.py files), but the doc's own README requirement --
"auth notes: expects an already-authenticated supervisor/patient identity
... passed via dependency injection" -- needs somewhere concrete to live.
Splitting it out here (rather than inlining into main.py) keeps every
routes_*.py importing from one place.
"""

from __future__ import annotations

from typing import Iterator

from fastapi import HTTPException, Request

from db.connection import get_conn


def get_db() -> Iterator:
    """
    Yields a connection via db.connection.get_conn() -- which commits on
    clean exit and rolls back on any exception. This is deliberately
    different from every module/pipeline function in this codebase (which
    take conn= and never commit themselves): the API layer is the actual
    top-level caller in production, so this is where that responsibility
    finally lands, rather than being pushed to yet another caller.
    """
    with get_conn() as conn:
        yield conn


def get_current_supervisor(request: Request) -> str:
    """
    Returns the authenticated supervisor's identifier. THIS LAYER DOES NO
    AUTH ITSELF -- per architecture.md, identity is expected to already be
    verified upstream (by the main Setu backend's own auth layer, before
    a request ever reaches a mounted sub-application) and attached to
    request.state by that layer's middleware.

    request.state.supervisor_id is NOT set by anything in this codebase --
    it's the seam the main backend is responsible for filling in. See
    api/README.md's wiring section for exactly what the main backend
    needs to do for this to work.
    """
    supervisor_id = getattr(request.state, "supervisor_id", None)
    if supervisor_id is None:
        raise HTTPException(
            status_code=401,
            detail="No authenticated supervisor identity found on request.state. "
            "This API expects the main Setu backend to attach it before routing here.",
        )
    return supervisor_id