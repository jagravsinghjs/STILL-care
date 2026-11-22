import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_patient_api import PatientApiTests
from api.main import app
from api.deps import get_current_supervisor
from api.routes_consultant import csrf, create_assignment_request
from db.connection import get_conn

class ConsultantTests(PatientApiTests):
    def setUp(self):
        super().setUp()
        app.dependency_overrides[get_current_supervisor] = lambda: 'consultant-a'
        app.dependency_overrides[csrf] = lambda: None
        with get_conn(self.db) as conn:
            conn.execute("INSERT INTO consultant_accounts VALUES ('consultant-a','Counsellor A','a@example.test',1)")
            conn.execute("INSERT INTO consultant_accounts VALUES ('consultant-b','Counsellor B','b@example.test',1)")
    def pending(self, patient='patient-a', consultant='consultant-a'):
        with get_conn(self.db) as conn:
            return create_assignment_request(conn, patient, consultant, patient)
    def decide(self, id, accept=True):
        return self.client.post(f'/consultant/requests/{id}/decision', json={'accept':accept})
    def test_accept_reject_duplicate_and_real_counts(self):
        self.assertEqual(self.client.get('/consultant/patients').json(), {'patients':[]})
        id=self.pending()
        self.assertEqual(self.client.get('/consultant/notifications').json()['unread_count'],1)
        self.assertEqual(self.decide(id).status_code,200)
        self.assertEqual(self.decide(id).status_code,409)
        self.assertEqual(len(self.client.get('/consultant/patients').json()['patients']),1)
        id=self.pending('patient-b')
        self.assertEqual(self.decide(id,False).status_code,200)
        self.assertEqual(len(self.client.get('/consultant/patients').json()['patients']),1)
        self.assertEqual(self.client.get('/consultant/notifications').json()['unread_count'],0)
    def test_reports_require_assignment_and_omit_transcripts(self):
        self.seed();self.add_turn_and_report();self.checkpoint()
        path='/consultant/patients/patient-a/sessions/saved-a'
        self.assertEqual(self.client.get(path).status_code,404)
        self.decide(self.pending())
        result=self.client.get(path)
        self.assertEqual(result.status_code,200)
        self.assertNotIn('My saved words',result.text)
        self.assertNotIn('Saved closing message',result.text)
        self.assertEqual(self.client.get(path+'/graph').status_code,200)
        app.dependency_overrides[get_current_supervisor]=lambda:'consultant-b'
        self.assertEqual(self.client.get(path).status_code,404)
        self.assertEqual(self.client.get(path+'/graph').status_code,404)
    def test_real_alerts_scoped_acknowledged(self):
        self.decide(self.pending())
        with get_conn(self.db) as conn:
            for id,patient in [('a','patient-a'),('b','patient-b')]:
                conn.execute("INSERT INTO alerts (alert_id,patient_id,triggered_at,tier,reason) VALUES (?,?,?,'green','[REVIEW] [URGENT] Needs review')",(id,patient,'2026-11-22T10:00:00Z'))
        data=self.client.get('/consultant/notifications').json()
        self.assertEqual([a['alert_id'] for a in data['alerts']],['a'])
        self.assertEqual(self.client.post('/consultant/alerts/b/acknowledge',json={}).status_code,404)
        self.assertEqual(self.client.post('/consultant/alerts/a/acknowledge',json={}).status_code,200)
        self.assertEqual(self.client.get('/consultant/notifications').json()['unread_count'],0)
    def test_identity_csrf_and_wrong_request_owner(self):
        id=self.pending(consultant='consultant-b')
        self.assertEqual(self.decide(id).status_code,404)
        del app.dependency_overrides[csrf]
        self.assertEqual(self.decide(id).status_code,403)
        del app.dependency_overrides[get_current_supervisor]
        self.assertEqual(self.client.get('/consultant/patients',headers={'X-Supervisor-ID':'consultant-a'}).status_code,401)
