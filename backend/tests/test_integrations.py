import sqlite3
import sys
from datetime import datetime, timezone
from types import SimpleNamespace, ModuleType
from backend.core.config import ROOT
from backend.integrations.intelligence_adapter import classify
from backend.integrations.chatbot_adapter import process_checkin, IntegrationUnavailable
from backend.services.report_service import safe_report
import pytest

def test_original_hysteresis_rules():
    sys.path.insert(0,str(ROOT/'intelligence_model'))
    from modules.module5_risk_classification.hysteresis import apply_hysteresis
    from schemas.schemas import RiskTier
    state=None
    now=datetime.now(timezone.utc)
    for _ in range(2):
        state=apply_hysteresis('p',RiskTier.RED,False,state,now)
        assert state.tier==RiskTier.GREEN
    state=apply_hysteresis('p',RiskTier.RED,False,state,now)
    assert state.tier==RiskTier.YELLOW
    state=apply_hysteresis('p',RiskTier.RED,True,state,now)
    assert state.tier==RiskTier.RED

def test_integrated_bridge_allowlist(monkeypatch):
    # Verify the actual adapter calls the inspected bridge contract without loading model weights.
    bridge=ModuleType('bridge.chatbot_adapter')
    seen=[]
    def ingest(segments,session_id,patient_id,created_at,conn):
        seen.append((segments,session_id,patient_id))
        return SimpleNamespace(new_status=SimpleNamespace(tier=SimpleNamespace(value='yellow')),trend=SimpleNamespace(trend_label=SimpleNamespace(value='stable')),alert=None,risk=SimpleNamespace(risk_score=99),explanation='PRIVATE_SENTINEL')
    bridge.ingest_from_chatbot_segments=ingest
    monkeypatch.setitem(sys.modules,'bridge.chatbot_adapter',bridge)
    with sqlite3.connect(':memory:') as conn:
        result=classify({'text':'PRIVATE_SENTINEL work','segments':[{'text':'PRIVATE_SENTINEL'}]},'c','p',datetime.now(timezone.utc),conn,'integrated')
    assert seen[0][1:] == ('c','p')
    assert result=={'state':'YELLOW','trend':'NO_CLEAR_CHANGE','themes':['daily responsibilities'],'alert':False}
    assert 'PRIVATE_SENTINEL' not in str(safe_report(result['state'],result['trend'],result['themes'],'integrated'))

def test_worker_failure_is_redacted(monkeypatch):
    monkeypatch.setattr('backend.integrations.chatbot_adapter.subprocess.run',lambda *a,**k:SimpleNamespace(returncode=1,stdout='SECRET',stderr='PRIVATE_SENTINEL'))
    with pytest.raises(IntegrationUnavailable) as exc: process_checkin('written',text='PRIVATE_SENTINEL',mode='integrated')
    assert 'PRIVATE_SENTINEL' not in str(exc.value)
