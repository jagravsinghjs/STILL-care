from fastapi import APIRouter
from sqlalchemy import select
from backend.core.security import DB, Current, authorize_patient
from backend.db.models import CheckInSession
from backend.schemas.patient import PatientResponse
from backend.schemas.auth import UserResponse
from backend.schemas.checkin import PatientCheckInResponse
from backend.services.patient_service import patient_response
from backend.services.report_service import patient_report

router=APIRouter(prefix='/api/patients',tags=['Patient-private'])
@router.get('/{patient_id}',response_model=PatientResponse,description='User-only: own basic profile.')
def profile(patient_id:str,db:DB,user:Current): return patient_response(db,authorize_patient(db,user,patient_id,private=True))

@router.get('/{patient_id}/checkins',response_model=list[PatientCheckInResponse],description='User-only: own private history.')
def checkins(patient_id:str,db:DB,user:Current):
    authorize_patient(db,user,patient_id,private=True)
    return [patient_report(c) for c in db.scalars(select(CheckInSession).where(CheckInSession.patient_id==patient_id).order_by(CheckInSession.created_at.desc()))]

@router.get('/{patient_id}/supervisor',response_model=UserResponse,description='User-only: assigned supervisor.')
def supervisor(patient_id:str,db:DB,user:Current):
    p=authorize_patient(db,user,patient_id,private=True)
    return UserResponse(id=p.supervisor.id,name=p.supervisor.user.name,role='SUPERVISOR')
