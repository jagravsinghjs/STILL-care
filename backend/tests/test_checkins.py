from sqlalchemy import select, func
from backend.db.models import CheckInSession
from backend.integrations.chatbot_adapter import IntegrationUnavailable
from .conftest import login,checkin

def test_written_and_voice_text(client):
    result=checkin(client)
    assert result.status_code==201,result.text
    assert result.json()['status']=='processed'
    assert result.json()['attention_state']=='GREEN'
    assert 'PRIVATE_SENTINEL' not in result.text
    assert checkin(client,'Voice-derived words',mode='voice').status_code==201

def test_validation_and_ownership(client):
    auth=login(client)
    assert client.post('/api/checkins',headers=auth,json={'patient_id':'rohan','mode':'written','content':'PRIVATE_SENTINEL'}).status_code==403
    for content in ['  ','x'*10001]:
        response=checkin(client,content)
        assert response.status_code==422
        assert content not in response.text
    response=client.post('/api/checkins',headers=auth,json={'patient_id':'ananya','content':'hello','audio_path':'SECRET'})
    assert response.status_code==422 and 'SECRET' not in response.text

def test_failure_rolls_back_and_redacts(client,monkeypatch):
    def fail(*args,**kwargs): raise RuntimeError('PRIVATE_SENTINEL C:/secret/audio.wav')
    monkeypatch.setattr('backend.services.checkin_service.analyze',fail)
    response=checkin(client)
    assert response.status_code==503 and 'PRIVATE_SENTINEL' not in response.text
    with client.app.state.sessions() as db: assert db.scalar(select(func.count()).select_from(CheckInSession))==0

def test_mock_audio_does_not_fake_transcription(client):
    response=client.post('/api/checkins/audio',headers=login(client),data={'patient_id':'ananya'},files={'audio':('../../secret.wav',b'RIFF0000WAVE','audio/wav')})
    assert response.status_code==503
    assert response.json()['error']=='AUDIO_UNAVAILABLE'

def test_integrated_unavailable_is_not_silent_fallback(client,monkeypatch):
    def unavailable(*args,**kwargs): raise IntegrationUnavailable()
    monkeypatch.setattr('backend.services.checkin_service.process_checkin',unavailable)
    assert checkin(client).json()['error']=='PIPELINE_UNAVAILABLE'
