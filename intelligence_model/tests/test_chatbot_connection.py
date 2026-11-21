"""Real chatbot → SQLite → numerical pipeline → API, with only generation mocked.

Run with unittest; no pytest dependency, live models, microphone or production DB.
"""

import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
from types import ModuleType
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "intelligence_model"))

from fastapi.testclient import TestClient
from api.main import app
from api.deps import get_db, get_current_supervisor
from db.connection import get_conn, init_schema
from db.repository import get_turns_for_session, get_chatbot_report
from schemas.schemas import ArousalFeatures, EmotionScores


def load_voice():
    # Skip optional NLP initialization, retaining real ingestion/finalization.
    case = ModuleType("case_profile")
    case.extract_and_merge_case_facts = Mock()
    missing = object()
    previous = sys.modules.get("case_profile", missing)
    sys.modules["case_profile"] = case
    try:
        with patch.object(sys, "path", [str(ROOT / "chatbot/05_voice_chat"), *sys.path]):
            spec = importlib.util.spec_from_file_location("connected_voice", ROOT / "chatbot/05_voice_chat/voice_chat.py")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
        return module
    finally:
        if previous is missing:
            sys.modules.pop("case_profile", None)
        else:
            sys.modules["case_profile"] = previous


class ChatbotConnectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.voice = load_voice()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.db_path = self.root / "still.db"
        init_schema(self.db_path)
        for context in (
            patch("db.connection.DB_PATH", self.db_path),
            patch.dict(os.environ, {"STILL_DB_PATH": str(self.db_path)}),
            patch("modules.module6_alerting.alert_engine.notify_alertd", return_value=False),
        ):
            context.start()
            self.addCleanup(context.stop)
        self.supervisor = "consultant1"

        def database():
            with get_conn(self.db_path) as conn:
                yield conn

        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_supervisor] = lambda: self.supervisor
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.acoustic = {
            "pitch_mean_hz": 0., "pitch_std_hz": 0., "energy_mean": .02,
            "zero_crossing_rate": .01, "pause_ratio": .1,
            "pitch_available": False, "audio_status": "ok",
        }
        self.emotion = {"neutral": .52, "sadness": .48}

    def seed_session(self):
        m = self.voice
        self.assertTrue(m.push_turn_to_intelligence_model(
            "session1", "friend1", "PRIVATE_TRANSCRIPT_MARKER calm demo", self.acoustic,
            "unknown", self.emotion, turn_id="turn1"))
        turn = {"turn_index": 0, "turn_id": "turn1", "elapsed_seconds": 1.,
                "text": "PRIVATE_TRANSCRIPT_MARKER calm demo", "acoustic_features": self.acoustic,
                "arousal_label": "unknown", "text_emotion": self.emotion,
                "text_emotion_status": "uncertain", "ingested": True}
        result = {"turns": [{"turn_index": 0, "distress_score": 4, "note": "demo"}],
                  "clinician_summary": "Conversational summary", "patient_message": "PRIVATE_CLOSING_MARKER"}
        with patch.object(m, "call_ollama_chat", return_value=json.dumps(result)):
            outcome = m.finalize_session([turn], "session1", "friend1", None, None, str(self.root / "session"))
        self.assertEqual(outcome["monitoring"], "completed")
        self.assertEqual(outcome["report_database"], "saved")

    def seed_group(self):
        groups = self.voice.group_coordination
        groups.create_group("circle", "case-a", "Three friends", "consultant1")
        for patient in ("friend1", "friend2", "friend3"):
            groups.invite_member("circle", "consultant1", patient)
            groups.respond_to_invitation("circle", patient, True, share_safety=True)
        return groups.record_incident("circle", "friend1", "session1", "turn1", {
            "kind": "following", "summary": "Reported being followed", "evidence_quote": "A bike followed me",
        }, confirmed_firsthand=True)["alert_id"]

    def test_real_session_report_and_quality_flags_reach_api(self):
        self.seed_session()
        response = self.client.get("/reports/session1/combined")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["conversation_report"]["clinician_summary"], "Conversational summary")
        self.assertEqual(data["conversation_report"]["score_scale"]["max"], 10)
        self.assertEqual(data["monitoring_score_scale"]["max"], 100)
        self.assertEqual(data["session_summary"]["turn_count"], 1)
        self.assertFalse(data["analysis_quality"][0]["pitch_available"])
        self.assertEqual(data["analysis_quality"][0]["emotion_status"], "uncertain")
        self.assertEqual(data["analysis_quality"][0]["emotion_source"], "text")
        self.assertNotIn("PRIVATE_TRANSCRIPT_MARKER", response.text)
        self.assertNotIn("PRIVATE_CLOSING_MARKER", response.text)
        self.assertTrue((self.root / "session/mental_state.png").exists())

    def test_insufficient_history_stays_insufficient(self):
        self.seed_session()
        response = self.client.get("/supervisor-view/friend1/status")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["distress_trend"], "insufficient_data")

    def test_group_alerts_and_acknowledgments_are_shared_with_cli(self):
        alert_id = self.seed_group()
        groups = self.voice.group_coordination
        groups.mark_alert(alert_id, "consultant1", role="supervisor")
        self.assertEqual(self.client.get("/case-groups").json()[0]["case_id"], "case-a")
        alerts = self.client.get("/case-groups/alerts").json()
        self.assertEqual(alerts[0]["alert_id"], alert_id)
        self.assertEqual(alerts[0]["evidence_quote"], "A bike followed me")
        self.assertEqual(self.client.patch(f"/case-groups/alerts/{alert_id}/acknowledge").status_code, 204)
        self.assertEqual(groups.list_alerts("consultant1", "supervisor"), [])
        self.assertEqual(self.client.get("/case-groups/alerts").json(), [])
        self.assertEqual(len(self.client.get("/case-groups/alerts?history=true").json()), 1)
        self.assertEqual(len(groups.list_alerts("friend3")), 1)

    def test_group_api_rejects_other_supervisors_and_unauthenticated_calls(self):
        alert_id = self.seed_group()
        self.supervisor = "different-consultant"
        self.assertEqual(self.client.get("/case-groups").json(), [])
        self.assertEqual(self.client.get("/case-groups/alerts").json(), [])
        self.assertEqual(self.client.patch(f"/case-groups/alerts/{alert_id}/acknowledge").status_code, 404)
        del app.dependency_overrides[get_current_supervisor]
        self.assertEqual(self.client.get("/case-groups/alerts").status_code, 401)
        self.assertEqual(self.client.get("/reports/session1/combined").status_code, 401)

    def test_unknown_sessions_and_old_feature_payloads(self):
        self.assertEqual(self.client.get("/reports/missing/combined").status_code, 404)
        arousal = ArousalFeatures(pitch_mean=0, pitch_std=0, energy=0,
                                 zero_crossing_rate=0, pause_ratio=0, arousal_label="moderate")
        emotion = EmotionScores(anger=0, disgust=0, fear=0, joy=0, neutral=1, sadness=0, surprise=0)
        self.assertIsNone(arousal.pitch_available)
        self.assertIsNone(emotion.analysis_status)

    def test_first_turn_review_is_visible_in_supervisor_api(self):
        self.assertTrue(self.voice.push_turn_to_intelligence_model(
            "session1", "friend1", "He hits me when I refuse his work", self.acoustic,
            "unknown", self.emotion, turn_id="turn1"))
        response = self.client.get("/alerts?patient_id=friend1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        alert = response.json()[0]
        self.assertEqual(alert["priority"], "urgent")
        self.assertIn("needs a supervisor check-in now", alert["reason"])
        self.assertIn("physical harm", alert["reason"])

    def test_one_session_cannot_accept_another_patients_turn(self):
        m = self.voice
        self.assertTrue(m.push_turn_to_intelligence_model("s", "friend1", "demo", self.acoustic,
                                                         "unknown", self.emotion, turn_id="t1"))
        self.assertFalse(m.push_turn_to_intelligence_model("s", "friend2", "demo", self.acoustic,
                                                          "unknown", self.emotion, turn_id="t2"))
        with get_conn(self.db_path) as conn:
            self.assertEqual(len(get_turns_for_session("s", conn=conn)), 1)

    def test_database_report_failure_keeps_local_artifacts(self):
        with patch.object(self.voice, "save_conversation_report", side_effect=RuntimeError("DB unavailable")):
            # Exercise finalization's failure independently of successful monitoring.
            self.assertTrue(self.voice.push_turn_to_intelligence_model(
                "session1", "friend1", "calm demo", self.acoustic, "unknown", self.emotion, turn_id="turn1"))
            turn = {"turn_index": 0, "turn_id": "turn1", "elapsed_seconds": 1., "text": "calm demo",
                    "acoustic_features": self.acoustic, "arousal_label": "unknown", "text_emotion": self.emotion,
                    "ingested": True}
            result = {"turns": [{"turn_index": 0, "distress_score": 3, "note": "demo"}],
                      "clinician_summary": "summary", "patient_message": "message"}
            with patch.object(self.voice, "call_ollama_chat", return_value=json.dumps(result)):
                outcome = self.voice.finalize_session([turn], "session1", "friend1", None, None,
                                                      str(self.root / "session"))
        self.assertEqual(outcome["report"], "saved")
        self.assertEqual(outcome["report_database"], "failed")
        self.assertTrue((self.root / "session/report.json").exists())
        with get_conn(self.db_path) as conn:
            self.assertIsNone(get_chatbot_report("session1", conn=conn))


if __name__ == "__main__":
    unittest.main()
