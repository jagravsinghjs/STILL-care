from fastapi import APIRouter
from backend.core.security import DB, Current, Supervisor, authorize_patient
from backend.schemas.trend import TrendPoint
from backend.services.patient_service import observations

router=APIRouter(prefix='/api',tags=['Qualitative continuity'])
def points(db,pid): return [TrendPoint(checkin_id=o.checkin_id,created_at=o.created_at,attention_state=o.attention_state,trend=o.trend) for o in reversed(observations(db,pid))]
@router.get('/patients/{patient_id}/trends',response_model=list[TrendPoint],description='User-only: own qualitative continuity.')
def patient_trends(patient_id:str,db:DB,user:Current):
    authorize_patient(db,user,patient_id,private=True)
    return points(db,patient_id)
@router.get('/supervisor/patients/{patient_id}/trends',response_model=list[TrendPoint],description='Supervisor-only: assigned user qualitative continuity.')
def supervisor_trends(patient_id:str,db:DB,user:Supervisor):
    authorize_patient(db,user,patient_id)
    return points(db,patient_id)
