def test_health_docs_cors(client):
    assert client.get('/api/health').json()=={'status':'ok','mode':'mock'}
    assert client.get('/docs').status_code==200
    assert client.get('/redoc').status_code==200
    assert '/api/checkins' in client.get('/openapi.json').json()['paths']
    allowed=client.options('/api/checkins',headers={'Origin':'http://localhost:5173','Access-Control-Request-Method':'POST'})
    assert allowed.headers['access-control-allow-origin']=='http://localhost:5173'
    rejected=client.options('/api/checkins',headers={'Origin':'https://untrusted.example','Access-Control-Request-Method':'POST'})
    assert 'access-control-allow-origin' not in rejected.headers
