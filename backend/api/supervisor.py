from fastapi import APIRouter
from sqlalchemy import select
from backend.core.security import DB, Supervisor, authorize_patient
from backend.db.models import PatientProfile, CheckInSession, Message, SupervisorAction
from backend.schemas.patient import PatientResponse
from backend.schemas.checkin import SupervisorSessionSummary
from backend.schemas.message import MessageRequest, MessageResponse
from backend.schemas.alert import ActionRequest, ActionResponse
from backend.services.patient_service import patient_response, observations
from backend.services.report_service import supervisor_summary
from backend.services.message_service import message_response, send_message

router=APIRouter(prefix='/api/supervisor',tags=['Supervisor-only'])
@router.get('/patients',response_model=list[PatientResponse],description='Supervisor-only: assigned users, no private reflection fields.')
def patients(db:DB,user:Supervisor):
    return [patient_response(db,p) for p in db.scalars(select(PatientProfile).where(PatientProfile.supervisor_id==user.id))]

@router.get('/patients/{patient_id}',response_model=PatientResponse)
def patient(patient_id:str,db:DB,user:Supervisor): return patient_response(db,authorize_patient(db,user,patient_id))

@router.get('/patients/{patient_id}/summaries',response_model=list[SupervisorSessionSummary])
def summaries(patient_id:str,db:DB,user:Supervisor):
    authorize_patient(db,user,patient_id)
    return [supervisor_summary(c) for c in db.scalars(select(CheckInSession).where(CheckInSession.patient_id==patient_id).order_by(CheckInSession.created_at.desc()))]

@router.get('/recommendations',response_model=list[SupervisorSessionSummary])
def recommendations(db:DB,user:Supervisor):
    result=[]
    for p in db.scalars(select(PatientProfile).where(PatientProfile.supervisor_id==user.id)):
        latest=next(iter(observations(db,p.id)),None)
        if latest: result.append(supervisor_summary(latest.checkin))
    return result

@router.get('/messages',response_model=list[MessageResponse])
def messages(db:DB,user:Supervisor):
    query=select(Message).join(PatientProfile).where(PatientProfile.supervisor_id==user.id).order_by(Message.created_at)
    return [message_response(m) for m in db.scalars(query)]

@router.post('/messages',response_model=MessageResponse,status_code=201)
def send(body:MessageRequest,db:DB,user:Supervisor):
    return send_message(db,user,authorize_patient(db,user,body.patient_id),body.content)

@router.post('/actions',response_model=ActionResponse,status_code=201)
def action(body:ActionRequest,db:DB,user:Supervisor):
    authorize_patient(db,user,body.patient_id)
    row=SupervisorAction(patient_id=body.patient_id,supervisor_id=user.id,action=body.action)
    db.add(row); db.commit(); db.refresh(row)
    return ActionResponse(id=row.id,patient_id=row.patient_id,supervisor_id=row.supervisor_id,action=row.action,created_at=row.created_at)

@router.get('/patients/{patient_id}/actions',response_model=list[ActionResponse])
def actions(patient_id:str,db:DB,user:Supervisor):
    authorize_patient(db,user,patient_id)
    return [ActionResponse(id=a.id,patient_id=a.patient_id,supervisor_id=a.supervisor_id,action=a.action,created_at=a.created_at) for a in db.scalars(select(SupervisorAction).where(SupervisorAction.patient_id==patient_id).order_by(SupervisorAction.created_at.desc()))]
