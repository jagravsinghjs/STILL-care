from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from backend.core.security import DB, Supervisor, authorize_patient
from backend.db.models import Alert, PatientProfile, SupervisorAction
from backend.schemas.alert import AlertResponse, AlertUpdate

router=APIRouter(prefix='/api/supervisor/alerts',tags=['Supervisor-only'])
def response(a): return AlertResponse(id=a.id,patient_id=a.patient_id,checkin_id=a.checkin_id,attention_state=a.attention_state,priority=a.priority,reason=a.reason,status=a.status,created_at=a.created_at)
@router.get('',response_model=list[AlertResponse])
def alerts(db:DB,user:Supervisor):
    return [response(a) for a in db.scalars(select(Alert).join(PatientProfile).where(PatientProfile.supervisor_id==user.id).order_by(Alert.created_at.desc()))]

@router.patch('/{alert_id}',response_model=AlertResponse)
def update(alert_id:str,body:AlertUpdate,db:DB,user:Supervisor):
    a=db.get(Alert,alert_id)
    if not a: raise HTTPException(404,'Record not found')
    authorize_patient(db,user,a.patient_id)
    if a.status=='resolved' and body.status!='resolved': raise HTTPException(409,'Resolved alerts cannot be reopened')
    a.status=body.status
    db.add(SupervisorAction(patient_id=a.patient_id,supervisor_id=user.id,action='alert_'+body.status))
    db.commit(); db.refresh(a)
    return response(a)
