"""Early review alerts use real ingestion/scoring and an isolated database."""

from datetime import datetime, timedelta, timezone
import importlib.util
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db.connection import init_schema, get_raw_connection
from db.repository import acknowledge_alert, get_risk_status, get_unacknowledged_alerts
from modules.module6_alerting import check_session_review
from pipeline.ingest import ingest_turn, end_session_and_run
from schemas.schemas import ArousalFeatures, EmotionScores, RiskTier, TurnRecord


class EarlyReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        path = Path(self.temp.name) / "still.db"
        self.db_path = path
        init_schema(path)
        self.conn = get_raw_connection(path)
        self.addCleanup(self.conn.close)
        notification = patch("modules.module6_alerting.alert_engine.notify_alertd", return_value=False)
        self.notify = notification.start()
        self.addCleanup(notification.stop)
        self.now = datetime(2026, 11, 22, 9, tzinfo=timezone.utc)

    def turn(self, text="I had a quiet day", session="s1", index=0, high=False):
        return TurnRecord(
            turn_id=f"{session}-t{index}", session_id=session, patient_id="solo",
            timestamp=self.now + timedelta(minutes=index), transcript=text,
            arousal=ArousalFeatures(pitch_mean=200, pitch_std=20, energy=.02,
                                   zero_crossing_rate=.01, pause_ratio=.2 if high else .1,
                                   arousal_label="high" if high else "low"),
            emotion=EmotionScores(anger=1 if high else 0, disgust=0, fear=0,
                                  joy=0, neutral=0 if high else 1, sadness=0, surprise=0),
        )

    def test_high_first_turn_alerts_before_session_end_without_changing_tier(self):
        alert = ingest_turn(self.turn(high=True), conn=self.conn)
        self.assertIsNotNone(alert)
        self.assertEqual(alert.priority, "urgent")
        self.assertIn("high numerical turn score", alert.reason)
        self.assertIn("needs a supervisor check-in now", alert.reason)
        self.assertIsNone(get_risk_status("solo", conn=self.conn))
        result = end_session_and_run("s1", self.now + timedelta(minutes=1), 1, conn=self.conn)
        # Diluted risk can be LOW; the early review still exists independently.
        self.assertEqual(result.new_status.tier, RiskTier.GREEN)
        self.assertEqual(result.alert.alert_id, alert.alert_id)
        self.assertEqual(len(get_unacknowledged_alerts("solo", conn=self.conn)), 1)
        self.assertEqual(self.notify.call_count, 1)

    def test_second_session_does_not_wait_for_third_assessment(self):
        self.assertIsNone(ingest_turn(self.turn(), conn=self.conn))
        end_session_and_run("s1", self.now + timedelta(minutes=1), 1, conn=self.conn)
        alert = ingest_turn(self.turn(session="s2", high=True), conn=self.conn)
        self.assertIsNotNone(alert)
        self.assertEqual(alert.priority, "urgent")
        self.assertEqual(get_risk_status("solo", conn=self.conn).tier, RiskTier.GREEN)

    def test_low_score_harm_and_coercion_still_request_review(self):
        for text, priority in [
            ("He forces everything on me", "prompt"),
            ("He hits me when I refuse", "urgent"),
            ("I am extremely stressed", "urgent"),
            ("I can't cope", "urgent"),
        ]:
            with self.subTest(text=text):
                session = f"s-{priority}-{len(text)}"
                alert = ingest_turn(self.turn(text, session=session), conn=self.conn)
                self.assertIsNotNone(alert)
                self.assertEqual(alert.priority, priority)
                self.assertIn("Evidence:", alert.reason)

    def test_acknowledged_prompt_alert_reopens_if_harm_is_disclosed(self):
        first = ingest_turn(self.turn("He forces me to do his assignments"), conn=self.conn)
        self.assertEqual(first.priority, "prompt")
        acknowledge_alert(first.alert_id, "consultant", self.now, conn=self.conn)
        self.assertEqual(get_unacknowledged_alerts("solo", conn=self.conn), [])
        upgraded = ingest_turn(self.turn("He hits me when I refuse", index=1), conn=self.conn)
        self.assertEqual(upgraded.alert_id, first.alert_id)
        self.assertEqual(upgraded.priority, "urgent")
        self.assertIsNone(upgraded.acknowledged_at)
        self.assertEqual(len(get_unacknowledged_alerts("solo", conn=self.conn)), 1)
        self.assertEqual(self.notify.call_count, 2)

    def test_repeated_checks_do_not_repeat_push_or_reopen_same_alert(self):
        first = ingest_turn(self.turn("He hits me"), conn=self.conn)
        self.assertIsNone(check_session_review("s1", conn=self.conn))
        self.assertIsNone(ingest_turn(self.turn("He hits me", index=1), conn=self.conn))
        acknowledge_alert(first.alert_id, "consultant", self.now, conn=self.conn)
        self.assertIsNone(check_session_review("s1", conn=self.conn))
        self.assertEqual(get_unacknowledged_alerts("solo", conn=self.conn), [])
        self.assertEqual(self.notify.call_count, 1)

    def test_new_session_can_raise_another_review(self):
        first = ingest_turn(self.turn("He hits me"), conn=self.conn)
        second = ingest_turn(self.turn("He hits me", session="s2"), conn=self.conn)
        self.assertNotEqual(first.alert_id, second.alert_id)
        self.assertEqual(len(get_unacknowledged_alerts("solo", conn=self.conn)), 2)

    def test_calm_and_simple_negated_reports_do_not_raise_review(self):
        for index, text in enumerate([
            "I had a quiet day", "Nobody threatened me", "He never hits me",
            "He does not hit me", "I am not extremely stressed", "My friend is being bullied",
        ]):
            with self.subTest(text=text):
                self.assertIsNone(ingest_turn(self.turn(text, session=f"s{index}"), conn=self.conn))
        self.assertEqual(get_unacknowledged_alerts("solo", conn=self.conn), [])

    def test_acute_language_keeps_one_urgent_alert_through_finalization(self):
        first = ingest_turn(self.turn("I want to die"), conn=self.conn)
        self.assertTrue(first.reason.startswith("[ACUTE]"))
        result = end_session_and_run("s1", self.now + timedelta(minutes=1), 1, conn=self.conn)
        self.assertEqual(result.new_status.tier, RiskTier.RED)
        self.assertEqual(result.alert.priority, "urgent")
        self.assertEqual(result.alert.alert_id, first.alert_id)
        self.assertEqual(len(get_unacknowledged_alerts("solo", conn=self.conn)), 1)
        self.assertEqual(self.notify.call_count, 1)

    def test_local_supervisor_queue_displays_urgent_review(self):
        ingest_turn(self.turn("He hits me"), conn=self.conn)
        self.conn.commit()
        script = Path(__file__).resolve().parents[1] / "scripts/view_alerts.py"
        spec = importlib.util.spec_from_file_location("view_alerts_under_test", script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with patch("db.connection.DB_PATH", self.db_path), \
                patch("sys.stdout", new_callable=io.StringIO) as output:
            module.main(["--patient-id", "solo"])
        self.assertIn("[URGENT] Patient solo", output.getvalue())
        self.assertIn("needs a supervisor check-in now", output.getvalue())


if __name__ == "__main__":
    unittest.main()
