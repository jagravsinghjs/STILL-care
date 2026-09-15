from backend.integrations.intelligence_adapter import classify
from .continuity_service import compare

def analyze(data, checkin, previous, db, mode):
    raw=db.connection().connection.driver_connection
    result=classify(data,checkin.id,checkin.patient_id,checkin.created_at,raw,mode)
    if result['trend'] is None:
        result['trend']=compare(previous[0].attention_state if previous else None,result['state'])
    return result
