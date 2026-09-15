from .conftest import login,checkin
from backend.services.report_service import normalize_report

def test_private_report(client):
    result=checkin(client)
    ident=result.json()['id']
    report=client.get(f'/api/checkins/{ident}/report',headers=login(client))
    assert report.status_code==200
    assert report.json()['raw_reflection']=='PRIVATE_SENTINEL'
    assert client.get(f'/api/checkins/{ident}/report',headers=login(client,'rohan')).status_code==403
    assert client.get('/api/patients/ananya/reports',headers=login(client)).json()[0]['id']==ident

def test_raw_model_report_not_published():
    assert normalize_report({'clinician_summary':'PRIVATE_SENTINEL','confidence':99,'transcript':'SECRET'})=={'report_generated':True}
    assert normalize_report('```json\n{"clinician_summary":"SECRET"}\n```')=={'report_generated':True}
