from .conftest import login,checkin

def test_longitudinal_alerts_actions(client):
    assert checkin(client,'[mock:green]').json()['trend']=='NO_CLEAR_CHANGE'
    second=checkin(client,'[mock:yellow] Daily work')
    assert second.json()['trend']=='WORSENING'
    assert checkin(client,'[mock:red]').json()['trend']=='WORSENING'
    assert checkin(client,'[mock:green]').json()['trend']=='IMPROVING'
    auth=login(client,'meera')
    alerts=client.get('/api/supervisor/alerts',headers=auth).json()
    assert len(alerts)==2
    assert alerts[0]['priority']=='high'
    assert client.patch('/api/supervisor/alerts/'+alerts[0]['id'],headers=auth,json={'status':'resolved'}).json()['status']=='resolved'
    action=client.post('/api/supervisor/actions',headers=auth,json={'patient_id':'ananya','action':'contacted'})
    assert action.status_code==201
    assert len(client.get('/api/supervisor/patients/ananya/actions',headers=auth).json())==2
    assert len(client.get('/api/supervisor/patients/ananya/trends',headers=auth).json())==4

def test_messaging_and_sender_control(client):
    own=login(client)
    response=client.post('/api/messages',headers=own,json={'patient_id':'ananya','content':'Can we talk?'})
    assert response.status_code==201
    assert response.json()['receiver_id']=='meera'
    auth=login(client,'meera')
    reply=client.post('/api/supervisor/messages',headers=auth,json={'patient_id':'ananya','content':'Yes, let us make time.'})
    assert reply.json()['sender_id']=='meera'
    assert len(client.get('/api/messages/ananya',headers=own).json())==2
    assert client.get('/api/messages/ananya',headers=login(client,'rohan')).status_code==403
    assert client.post('/api/messages',headers=own,json={'patient_id':'ananya','content':'hi','sender_id':'meera'}).status_code==422
