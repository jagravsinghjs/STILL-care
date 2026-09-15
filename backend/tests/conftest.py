import secrets
import pytest
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.core.config import Settings
from backend.db.seed import seed

@pytest.fixture
def client(tmp_path):
    settings=Settings(database_url='sqlite:///'+str(tmp_path/'test.db'),mode='mock',jwt_secret=secrets.token_urlsafe(48))
    app=create_app(settings)
    passwords={name:secrets.token_urlsafe(18) for name in ('meera','ananya','rohan','isha')}
    with TestClient(app,raise_server_exceptions=False) as client:
        with app.state.sessions() as db: seed(db,passwords,settings,include_checkins=False)
        client.passwords=passwords
        yield client

def login(client,name='ananya'):
    response=client.post('/api/auth/login',json={'email':name+'@still.example','password':client.passwords[name]})
    assert response.status_code==200,response.text
    return {'Authorization':'Bearer '+response.json()['access_token']}

def checkin(client,content='PRIVATE_SENTINEL',name='ananya',mode='written'):
    return client.post('/api/checkins',headers=login(client,name),json={'patient_id':name,'mode':mode,'content':content})
