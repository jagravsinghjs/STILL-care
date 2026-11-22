"""Patient ownership and persisted-data tests; temporary SQLite/files only."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from api.main import app
from api.deps import get_current_patient, get_db
from db.connection import get_conn, init_schema


class PatientApiTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.db = self.root / "test.db"
        init_schema(self.db)
        self.output = self.root / "output"
        self.output.mkdir()
        self.identity = "patient-a"
        def database():
            with get_conn(self.db) as conn:
                yield conn
        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_patient] = lambda: self.identity
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        context = patch("api.routes_patient.OUTPUT_ROOT", self.output)
        context.start()
        self.addCleanup(context.stop)

    def seed(self, session="saved-a", patient="patient-a", score=70):
        with get_conn(self.db) as conn:
            conn.execute("INSERT INTO sessions VALUES (?,?,?,?,?)", (session, patient, "2026-11-22T10:00:00+00:00", "2026-11-22T10:10:00+00:00", 1))
            conn.execute("INSERT INTO session_summary VALUES (?,?,?,?,?,?,?,?)", (session, patient, score, score, score, 0, 0, "2026-11-22T10:10:00+00:00"))

    def add_turn_and_report(self):
        with get_conn(self.db) as conn:
            conn.execute("INSERT INTO turns (turn_id,session_id,patient_id,timestamp,transcript,arousal_json,emotion_json,turn_score) VALUES (?,?,?,?,?,?,?,?)", ("turn-a", "saved-a", "patient-a", "2026-11-22T10:01:00+00:00", "My saved words", "{}", "{}", 70))
            conn.execute("INSERT INTO chatbot_session_reports VALUES (?,?,?,?,?)", ("saved-a", "patient-a", "qwen", "2026-11-22T10:10:00+00:00", json.dumps({"clinician_summary": "Saved summary", "patient_message": "Saved closing message", "turns": [{"elapsed_seconds": 6, "distress_score": 7}]})))

    def checkpoint(self, patient="patient-a"):
        directory = self.output / "session_test"
        directory.mkdir(exist_ok=True)
        (directory / "turns.json").write_text(json.dumps({"patient_id": patient, "session_id": "saved-a", "turns": [{"turn_id": "turn-a", "text": "My saved words", "reply": "Saved assistant reply"}]}))
        (directory / "mental_state.png").write_bytes(b"test-graph-file")
        return directory

    def test_new_patient_is_empty_and_reads_do_not_create_sessions(self):
        for _ in range(2):
            response = self.client.get("/patient/sessions")
            self.assertEqual(response.json(), {"sessions": []})
            self.assertEqual(response.headers["cache-control"], "no-store")
        with get_conn(self.db) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0], 0)

    def test_only_owned_sessions_are_listed_and_arbitrary_ids_are_denied(self):
        self.seed()
        self.seed("saved-b", "patient-b", 20)
        data = self.client.get("/patient/sessions?patient_id=patient-b").json()
        self.assertEqual([row["id"] for row in data["sessions"]], ["saved-a"])
        self.assertEqual(data["sessions"][0]["mean_score"], 70)
        for path in ("/patient/sessions/saved-b", "/patient/sessions/saved-b/graph", "/patient/sessions/unknown"):
            self.assertEqual(self.client.get(path).status_code, 404)

    def test_verified_identity_required_headers_cannot_supply_it(self):
        self.seed()
        del app.dependency_overrides[get_current_patient]
        for path in ("/patient/sessions", "/patient/sessions/saved-a", "/patient/sessions/saved-a/graph"):
            self.assertEqual(self.client.get(path, headers={"X-Patient-ID": "patient-a"}).status_code, 401)

    def test_saved_messages_report_and_graph_are_returned_without_regeneration(self):
        self.seed()
        self.add_turn_and_report()
        self.checkpoint()
        response = self.client.get("/patient/sessions/saved-a")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual([m["text"] for m in data["messages"]], ["My saved words", "Saved assistant reply"])
        self.assertTrue(data["conversation_complete"])
        self.assertEqual(data["report"]["timeline"], [{"seconds": 6, "score": 7}])
        self.assertEqual(data["report"]["summary"], "Saved summary")
        self.assertNotIn(str(self.root), response.text)
        graph = self.client.get("/patient/sessions/saved-a/graph")
        self.assertEqual(graph.content, b"test-graph-file")
        self.assertEqual(graph.headers["cache-control"], "no-store")

    def test_foreign_checkpoint_cannot_fill_missing_conversation_or_graph(self):
        self.seed()
        self.add_turn_and_report()
        self.checkpoint("patient-b")
        data = self.client.get("/patient/sessions/saved-a").json()
        self.assertEqual(len(data["messages"]), 1)
        self.assertFalse(data["conversation_complete"])
        self.assertFalse(data["graph_available"])
        self.assertEqual(self.client.get("/patient/sessions/saved-a/graph").status_code, 404)

    def test_missing_reports_and_invalid_score_remain_unassessed(self):
        self.seed(score=150)
        data = self.client.get("/patient/sessions/saved-a").json()
        self.assertIsNone(data["mean_score"])
        self.assertIsNone(data["report"])
        self.assertEqual(data["messages"], [])

    def test_graph_symlink_cannot_escape_its_session_directory(self):
        self.seed()
        directory = self.checkpoint()
        graph = directory / "mental_state.png"
        graph.unlink()
        secret = self.root / "private.png"
        secret.write_bytes(b"private")
        graph.symlink_to(secret)
        self.assertEqual(self.client.get("/patient/sessions/saved-a/graph").status_code, 404)

    def test_invalid_saved_report_is_an_error_not_empty_history(self):
        self.seed()
        self.add_turn_and_report()
        with get_conn(self.db) as conn:
            conn.execute("UPDATE chatbot_session_reports SET report_json = 'broken'")
        self.assertEqual(self.client.get("/patient/sessions/saved-a").status_code, 500)


if __name__ == "__main__":
    unittest.main()
