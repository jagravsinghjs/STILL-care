"""Read chatbot 07's confirmed notices through the supervisor's own inbox."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from db.repository import (
    acknowledge_group_alert, get_supervisor_case_groups, get_supervisor_group_alerts,
)
from .deps import get_current_supervisor, get_db

router = APIRouter(prefix="/case-groups", tags=["case-groups"])


@router.get("")
def list_groups(conn=Depends(get_db), supervisor_id=Depends(get_current_supervisor)):
    return get_supervisor_case_groups(supervisor_id, conn=conn)


@router.get("/alerts")
def list_group_alerts(history: bool = False, conn=Depends(get_db),
                      supervisor_id=Depends(get_current_supervisor)):
    # Polling does not acknowledge notices, and CLI delivery does not hide them.
    return get_supervisor_group_alerts(supervisor_id, pending_only=not history, conn=conn)


@router.patch("/alerts/{alert_id}/acknowledge", status_code=204)
def acknowledge(alert_id: str, conn=Depends(get_db),
                supervisor_id=Depends(get_current_supervisor)):
    if not acknowledge_group_alert(alert_id, supervisor_id, datetime.now(timezone.utc), conn=conn):
        raise HTTPException(status_code=404, detail="Group alert not found in this supervisor's inbox")
