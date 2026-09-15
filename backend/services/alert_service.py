from backend.db.models import Alert
from .continuity_service import ORDER

def create_alert(db, checkin, previous, state, trend, mode, pipeline_alert=False):
    # Integrated decisions follow Module 16 exactly, including progress notifications.
    if mode == 'integrated':
        needed = pipeline_alert
    else:
        needed = (state != 'GREEN' and (not previous or ORDER[state] > ORDER[previous[0].attention_state])) or (trend == 'WORSENING' and previous and previous[0].trend == 'WORSENING')
    if needed:
        reason = 'Continuity improvement noted' if trend=='IMPROVING' else 'Supervisor attention recommended'
        db.add(Alert(patient_id=checkin.patient_id,checkin_id=checkin.id,attention_state=state,priority='high' if state=='RED' else 'normal',reason=reason))
