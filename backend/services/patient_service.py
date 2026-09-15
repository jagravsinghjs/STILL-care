from sqlalchemy import select
from backend.db.models import ContinuityObservation
from backend.schemas.patient import PatientResponse

def observations(db, patient_id):
    return list(db.scalars(select(ContinuityObservation).where(ContinuityObservation.patient_id==patient_id).order_by(ContinuityObservation.created_at.desc(),ContinuityObservation.id.desc())))

def patient_response(db, patient):
    latest = next(iter(observations(db, patient.id)), None)
    return PatientResponse(id=patient.id,name=patient.user.name,initials=''.join(n[0] for n in patient.user.name.split()),context=patient.context,supervisor_id=patient.supervisor_id,last_checkin=latest.created_at if latest else None,attention_state=latest.attention_state if latest else None,trend=latest.trend if latest else 'NO_CLEAR_CHANGE',summary=latest.summary if latest else 'No check-ins yet.')
