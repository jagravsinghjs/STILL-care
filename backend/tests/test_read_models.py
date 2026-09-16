from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import shutil
import tempfile
import unittest

from backend.database import connect, initialize_schema
from backend.read_models import report_for_patient, report_for_supervisor, status_for, trend_for


SOURCE_DB = Path(__file__).parents[2] / "intelligence_model" / "data" / "still.db"


class IntelligenceReadModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.db_path = Path(self.directory.name) / "still.db"
        shutil.copy2(SOURCE_DB, self.db_path)
        initialize_schema(self.db_path)
        self.conn = connect(self.db_path)
        now = datetime.now(timezone.utc).isoformat()
        self.conn.execute("INSERT INTO sessions VALUES (?, ?, ?, ?, ?)", ("api-session", "api-patient", now, now, 1))
        self.conn.execute("INSERT INTO session_summary VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ("api-session", "api-patient", 42, 42, 42, 0, 0, now))
        self.conn.execute("INSERT INTO turns (turn_id, session_id, patient_id, timestamp, transcript, arousal_json, emotion_json) VALUES (?, ?, ?, ?, ?, ?, ?)", ("api-turn", "api-session", "api-patient", now, "private words", "{}", "{}"))
        self.conn.execute("INSERT INTO risk_status VALUES (?, ?, ?, ?, ?)", ("api-patient", "yellow", now, "green", 1))
        self.conn.execute("INSERT INTO distress_trend VALUES (?, ?, ?, ?, ?, ?)", ("api-patient", now, 3, 1.2, "worsening", .8))
        self.conn.execute("INSERT INTO escalation_risk VALUES (?, ?, ?, ?, ?, ?, ?)", ("api-patient", "api-session", now, 50, "moderate", 0, "[]"))
        self.conn.execute("INSERT INTO risk_explanation VALUES (?, ?, ?, ?)", ("api-patient", "api-session", now, '[{"description":"Recent distress increased"}]'))
        self.conn.commit()

    def tearDown(self) -> None:
        self.conn.close()
        self.directory.cleanup()

    def test_status_trend_and_reports_are_privacy_scoped(self) -> None:
        self.assertEqual(status_for(self.conn, "new-patient")["tier"], "not_assessed")
        self.assertEqual(trend_for(self.conn, "api-patient")[0]["trend_label"], "worsening")
        patient = report_for_patient(self.conn, "api-patient", "api-session")
        supervisor = report_for_supervisor(self.conn, "api-patient", "api-session")
        self.assertEqual(patient["reflection"][0]["transcript"], "private words")
        self.assertNotIn("reflection", supervisor)
        self.assertEqual(supervisor["risk_explanation"]["factors"][0]["description"], "Recent distress increased")


if __name__ == "__main__":
    unittest.main()
