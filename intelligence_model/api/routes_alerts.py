"""
api/routes_alerts.py — supervisor interaction with Module 16's output.

GET for listing unacknowledged alerts, PATCH for acknowledging one. This
is the write path this layer is explicitly permitted -- unlike
module6_alerting, which is the only code allowed to INSERT into `alerts`,
this router is fine updating status/acknowledged_by/acknowledged_at on an
existing row, since that's a supervisor action, not new alert creation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from db.repository import acknowledge_alert, get_unacknowledged_alerts
from schemas.schemas import Alert
from .deps import get_current_supervisor, get_db

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[Alert])
def list_alerts(
    patient_id: Optional[str] = Query(default=None),
    conn=Depends(get_db),
    _=Depends(get_current_supervisor),
):
    """patient_id omitted -> every unacknowledged alert across all patients
    (the main alert queue view); provided -> scoped to one patient."""
    return get_unacknowledged_alerts(patient_id, conn=conn)


@router.patch("/{alert_id}/acknowledge", status_code=204)
def acknowledge(
    alert_id: str,
    conn=Depends(get_db),
    supervisor_id: str = Depends(get_current_supervisor),
):
    acknowledge_alert(alert_id, acknowledged_by=supervisor_id, acknowledged_at=datetime.now(timezone.utc), conn=conn)