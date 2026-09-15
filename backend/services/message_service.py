from backend.db.models import Message
from backend.schemas.message import MessageResponse

def message_response(m):
    return MessageResponse(id=m.id,patient_id=m.patient_id,sender_id=m.sender_id,receiver_id=m.receiver_id,sender='user' if m.sender_id==m.patient_id else 'supervisor',content=m.content,created_at=m.created_at,read_at=m.read_at)

def send_message(db,user,patient,content):
    receiver=patient.supervisor_id if user.id==patient.id else patient.id
    message=Message(patient_id=patient.id,sender_id=user.id,receiver_id=receiver,content=content)
    db.add(message); db.commit(); db.refresh(message)
    return message_response(message)
