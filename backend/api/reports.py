from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from backend.core.security import DB, Current, authorize_patient
from backend.db.models import CheckInSession
from backend.schemas.checkin import PatientCheckInResponse
from backend.services.report_service import patient_report

router=APIRouter(prefix='/api',tags=['Private reports'])
@router.get('/patients/{patient_id}/reports',response_model=list[PatientCheckInResponse],description='User-only: own reports. Supervisors use the dedicated summaries endpoint.')
def reports(patient_id:str,db:DB,user:Current):
    authorize_patient(db,user,patient_id,private=True)
    return [patient_report(c) for c in db.scalars(select(CheckInSession).where(CheckInSession.patient_id==patient_id).order_by(CheckInSession.created_at.desc()))]

@router.get('/checkins/{checkin_id}/report',response_model=PatientCheckInResponse,description='User-only: own reflection and continuity report.')
def report(checkin_id:str,db:DB,user:Current):
    item=db.get(CheckInSession,checkin_id)
    if not item: raise HTTPException(404,'Record not found')
    authorize_patient(db,user,item.patient_id,private=True)
    return patient_report(item)
