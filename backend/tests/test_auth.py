from .conftest import login

def test_login_and_protection(client):
    user=login(client)
    assert client.get('/api/auth/me',headers=user).json()['role']=='STUDENT'
    assert client.get('/api/supervisor/patients',headers=user).status_code==403
    assert client.get('/api/supervisor/patients').status_code==401
    assert client.get('/api/patients/rohan',headers=user).status_code==403
    assert client.post('/api/auth/login',json={'email':'ananya@still.example','password':'wrong'}).status_code==401
    assert client.get('/api/auth/me',headers={'Authorization':'Bearer forged'}).status_code==401
    assert client.get('/api/auth/me',headers=login(client,'meera')).json()['role']=='SUPERVISOR'


def test_registration_persists_and_protects_roles(client):
    import secrets
    password=secrets.token_urlsafe(18)
    body={'user_id':'new.student','name':'Fictional Student','password':password}
    response=client.post('/api/auth/register',json=body)
    assert response.status_code==201
    assert response.json()=={'id':'new.student','name':'Fictional Student','role':'STUDENT'}
    assert client.post('/api/auth/register',json=body).status_code==409
    assert client.post('/api/auth/register',json={**body,'user_id':'another','role':'SUPERVISOR'}).status_code==422
    signed=client.post('/api/auth/login',json={'email':'new.student','password':password})
    assert signed.status_code==200
    headers={'Authorization':'Bearer '+signed.json()['access_token']}
    assert client.get('/api/patients/new.student/checkins',headers=headers).json()==[]
    assert client.get('/api/patients/ananya/checkins',headers=headers).status_code==403
    assert client.get('/api/supervisor/patients',headers=headers).status_code==403
    assert any(p['id']=='new.student' for p in client.get('/api/supervisor/patients',headers=login(client,'meera')).json())
    with client.app.state.sessions() as db:
        from backend.db.models import User
        from backend.core.security import verify_password
        saved=db.get(User,'new.student')
        assert saved.password_hash!=password
        assert verify_password(password,saved.password_hash)


def test_registration_validation_and_supervisor_setup(client):
    import secrets
    body={'user_id':'new.student','name':'Test Student','password':secrets.token_urlsafe(18)}
    for change in ({'name':'   '},{'user_id':'bad id'},{'password':''}):
        assert client.post('/api/auth/register',json={**body,**change}).status_code==422
    client.app.state.settings.signup_supervisor_id='unconfigured'
    assert client.post('/api/auth/register',json=body).status_code==503
