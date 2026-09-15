from sqlalchemy import text
from backend.db.models import CheckInSession, ContinuityObservation, Report, now, uid
from backend.integrations.chatbot_adapter import process_checkin
from .patient_service import observations
from .report_service import normalize_report, safe_report
from .intelligence_service import analyze
from .alert_service import create_alert

def submit(db, patient_id, mode, content, settings, audio_path=None):
    data=process_checkin(mode,text=content,audio_path=audio_path,patient_id=patient_id,mode=settings.mode,timeout=settings.pipeline_timeout)
    normalize_report(data['report'])
    # End read-only authorization transaction before taking a SQLite write lock.
    db.commit()
    try:
        db.execute(text('BEGIN IMMEDIATE'))
        previous=observations(db,patient_id)
        item=CheckInSession(id=uid(),patient_id=patient_id,mode=mode,raw_reflection=data['text'],created_at=now())
        db.add(item); db.flush()
        result=analyze(data,item,previous,db,settings.mode)
        report=safe_report(result['state'],result['trend'],result['themes'],settings.mode)
        db.add(Report(checkin_id=item.id,structured=report,processing_mode=settings.mode))
        db.add(ContinuityObservation(checkin_id=item.id,patient_id=patient_id,created_at=item.created_at,**report))
        create_alert(db,item,previous,result['state'],result['trend'],settings.mode,result['alert'])
        db.commit(); db.refresh(item)
        return item
    except Exception:
        db.rollback()
        raise
