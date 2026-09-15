import pytest
from fastapi.testclient import TestClient
from backend.core.config import Settings
from backend.main import create_app


@pytest.mark.parametrize('development', [True, False])
def test_localhost_cors_is_opt_in(development):
    settings = Settings(database_url='sqlite:///:memory:', origins=['https://app.example'], cors_allow_localhost=development)
    with TestClient(create_app(settings)) as client:
        for origin in ['http://localhost:5175', 'http://127.0.0.1:5180', 'https://localhost:6000', 'http://127.0.0.1:5176']:
            response = client.options('/api/checkins', headers={'Origin': origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type'})
            assert (response.headers.get('access-control-allow-origin') == origin) == development
            assert 'access-control-allow-credentials' not in response.headers
        for origin in ['http://localhost.evil.example:5180', 'http://127.0.0.1.evil.example', 'https://untrusted.example']:
            response = client.get('/api/health', headers={'Origin': origin})
            assert 'access-control-allow-origin' not in response.headers
        response = client.get('/api/health', headers={'Origin': 'https://app.example'})
        assert response.headers['access-control-allow-origin'] == 'https://app.example'
