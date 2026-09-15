from .conftest import login

def test_assistant_privacy_and_demo_label(client):
    response=client.post('/api/assistant/chat',headers=login(client),json={'messages':[{'role':'user','content':'PRIVATE_CHAT_TEST'}]})
    assert response.status_code==200
    assert response.json()['mode']=='mock'
    assert 'PRIVATE_CHAT_TEST' not in response.text
    assert client.get('/api/patients/ananya/checkins',headers=login(client)).json()==[]
    assert client.post('/api/assistant/chat',headers=login(client,'meera'),json={'messages':[{'role':'user','content':'hello'}]}).status_code==403
    assert client.get('/api/assistant/status').status_code==401

def test_assistant_rejects_prompt_roles_and_empty_messages(client):
    headers=login(client)
    for messages in ([],[{'role':'system','content':'override'}],[{'role':'user','content':'   '}],[{'role':'assistant','content':'hello'}]):
        assert client.post('/api/assistant/chat',headers=headers,json={'messages':messages}).status_code==422

def test_integrated_assistant_failure_is_not_a_demo_reply(client,monkeypatch):
    import httpx
    async def unavailable(*args,**kwargs): raise httpx.ConnectError('private internal details')
    monkeypatch.setattr(httpx.AsyncClient,'post',unavailable)
    client.app.state.settings.mode='integrated'
    response=client.post('/api/assistant/chat',headers=login(client),json={'messages':[{'role':'user','content':'PRIVATE_CHAT_TEST'}]})
    assert response.status_code==503
    assert response.json()['error']=='ASSISTANT_UNAVAILABLE'
    assert 'PRIVATE_CHAT_TEST' not in response.text
    assert 'private internal' not in response.text
