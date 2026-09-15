from .conftest import login,checkin
from backend.db.models import User,SupervisorProfile
from backend.core.security import hash_password,issue_token
import secrets

FORBIDDEN={'raw_reflection','transcript','audio_path','audio_url','raw_audio','raw_llm_response','confidence','risk_score','distress_score'}
def assert_safe(value):
    if isinstance(value,dict):
        assert not (FORBIDDEN & value.keys())
        for child in value.values(): assert_safe(child)
    if isinstance(value,list):
        for child in value: assert_safe(child)
    if isinstance(value,str): assert 'PRIVATE_SENTINEL' not in value

def test_all_supervisor_responses_private(client):
    result=checkin(client,'[mock:red] PRIVATE_SENTINEL family')
    ident=result.json()['id']; auth=login(client,'meera')
    for path in ['/api/supervisor/patients','/api/supervisor/patients/ananya','/api/supervisor/patients/ananya/summaries','/api/supervisor/patients/ananya/trends','/api/supervisor/recommendations','/api/supervisor/alerts','/api/supervisor/messages','/api/messages/ananya']:
        response=client.get(path,headers=auth)
        assert response.status_code==200,response.text
        assert_safe(response.json())
    for path in ['/api/patients/ananya/checkins','/api/patients/ananya/reports',f'/api/checkins/{ident}/report']:
        response=client.get(path,headers=auth)
        assert response.status_code==403
        assert_safe(response.json())

def test_unassigned_supervisor_cannot_access(client):
    with client.app.state.sessions() as db:
        other=User(id='other',name='Other Supervisor',email='other@still.example',role='SUPERVISOR',password_hash=hash_password(secrets.token_urlsafe(24)))
        db.add(other);db.flush();db.add(SupervisorProfile(id='other'));db.commit()
        token=issue_token(other,client.app.state.settings)
    auth={'Authorization':'Bearer '+token}
    assert client.get('/api/supervisor/patients',headers=auth).json()==[]
    for path in ['/api/supervisor/patients/ananya/summaries','/api/messages/ananya']:
        assert client.get(path,headers=auth).status_code==403
