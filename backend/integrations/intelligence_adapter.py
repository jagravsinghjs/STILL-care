import sys
import sqlite3
from backend.core.config import ROOT
from .chatbot_adapter import IntegrationUnavailable

THEMES = {'daily responsibilities':('work','deadline','assignment','exam','attendance','placement','internship','academic'), 'relationships':('friend','relationship','peer'), 'family responsibilities':('family','caregiving'), 'financial pressure':('money','financial'), 'rest and routine':('sleep','rest','routine')}

def extract_themes(text):
    text=text.casefold()
    return [name for name,words in THEMES.items() if any(w in text for w in words)]

def classify(data, checkin_id, patient_id, created_at, conn, mode):
    themes=extract_themes(data['text'])
    if mode=='mock':
        # Explicit scenario tags, NOT mental-health analysis or a trained model.
        text=data['text'].lower()
        state='RED' if '[mock:red]' in text else 'YELLOW' if '[mock:yellow]' in text else 'GREEN'
        return {'state':state,'themes':themes,'trend':None,'alert':False}
    try:
        model_root=str(ROOT/'intelligence_model')
        if model_root not in sys.path: sys.path.insert(0,model_root)
        from bridge.chatbot_adapter import ingest_from_chatbot_segments
        import modules.module6_alerting.alert_engine as alert_engine
        # Backend stores alerts for authenticated retrieval, never sends to external alertd.
        alert_engine.notify_alertd=lambda *_: None
        old_factory=conn.row_factory
        conn.row_factory=sqlite3.Row
        try:
            result=ingest_from_chatbot_segments(data['segments'],checkin_id,patient_id,created_at,conn=conn)
        finally:
            conn.row_factory=old_factory
        if result is None or result.new_status is None: raise IntegrationUnavailable()
        raw_trend=result.trend.trend_label.value if result.trend else 'insufficient_data'
        return {'state':result.new_status.tier.value.upper(),'themes':themes,'trend':{'improving':'IMPROVING','worsening':'WORSENING'}.get(raw_trend,'NO_CLEAR_CHANGE'),'alert':result.alert is not None}
    except Exception:
        raise IntegrationUnavailable() from None
