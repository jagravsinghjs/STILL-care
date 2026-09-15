from fastapi import APIRouter
from sqlalchemy import select
from backend.core.security import DB, Current, authorize_patient
from backend.db.models import Message
from backend.schemas.message import MessageRequest, MessageResponse
from backend.services.message_service import message_response, send_message

router=APIRouter(prefix='/api',tags=['Shared messages'])
@router.get('/messages/{patient_id}',response_model=list[MessageResponse],description='Shared: owner or assigned supervisor only.')
@router.get('/patients/{patient_id}/messages',response_model=list[MessageResponse],description='Shared: conversation access, never check-in content.')
def messages(patient_id:str,db:DB,user:Current):
    authorize_patient(db,user,patient_id)
    return [message_response(m) for m in db.scalars(select(Message).where(Message.patient_id==patient_id).order_by(Message.created_at))]

@router.post('/messages',response_model=MessageResponse,status_code=201,description='Shared: sends an authored message; receiver is assigned by server.')
def send(body:MessageRequest,db:DB,user:Current):
    return send_message(db,user,authorize_patient(db,user,body.patient_id),body.content)
