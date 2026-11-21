"""Offline circle checks with a disposable SQLite database and mocked Qwen."""

import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import Mock, patch


FOLDER = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("group_coordination_under_test", FOLDER / "group_coordination.py")
groups = importlib.util.module_from_spec(spec)
spec.loader.exec_module(groups)


class GroupCoordinationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Path(self.temp.name) / "still.db"
        env = patch.dict(os.environ, {"STILL_DB_PATH": str(self.db)})
        env.start()
        self.addCleanup(env.stop)
        groups.create_group("circle", "case-a", "Three friends", "consultant")
        self.incident = {"kind": "following", "summary": "Reported a bike following them",
                         "evidence_quote": "I saw a bike following me"}

    def accept(self, patient):
        groups.invite_member("circle", "consultant", patient)
        groups.respond_to_invitation("circle", patient, True, share_safety=True)

    def report(self, patient="friend1", turn="turn1", quote=None):
        incident = dict(self.incident)
        if quote:
            incident["evidence_quote"] = quote
        return groups.record_incident("circle", patient, "session", turn, incident, confirmed_firsthand=True)

    def count(self, table):
        with sqlite3.connect(self.db) as conn:
            return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]

    def test_invitation_requires_owner_acceptance_and_sharing_consent(self):
        with self.assertRaises(PermissionError):
            groups.invite_member("circle", "stranger", "friend1")
        groups.invite_member("circle", "consultant", "friend1")
        invitation = groups.list_invitations("friend1")[0]
        self.assertEqual(invitation["case_id"], "case-a")
        self.assertIn("Private chats", invitation["sharing_notice"])
        self.assertIsNone(groups.get_membership("friend1"))
        with self.assertRaises(ValueError):
            groups.respond_to_invitation("circle", "friend1", True)
        with self.assertRaises(PermissionError):
            self.report()
        groups.respond_to_invitation("circle", "friend1", True, share_safety=True)
        self.assertEqual(groups.get_membership("friend1")["group_id"], "circle")

    def test_declined_member_has_no_membership_or_delivery(self):
        self.accept("friend1")
        groups.invite_member("circle", "consultant", "friend2")
        groups.respond_to_invitation("circle", "friend2", False)
        self.report()
        self.assertEqual(groups.list_invitations("friend2"), [])
        self.assertIsNone(groups.get_membership("friend2"))
        self.assertEqual(groups.list_alerts("friend2"), [])

    def test_three_member_limit_and_single_case_binding(self):
        for patient in ("friend1", "friend2", "friend3"):
            self.accept(patient)
        groups.invite_member("circle", "consultant", "friend4")
        with self.assertRaisesRegex(ValueError, "three"):
            groups.respond_to_invitation("circle", "friend4", True, share_safety=True)
        groups.create_group("other", "case-b", "Other case", "consultant2")
        groups.invite_member("other", "consultant2", "friend1")
        with self.assertRaises(ValueError):
            groups.respond_to_invitation("other", "friend1", True, share_safety=True)
        groups.leave_group("circle", "friend1")
        with self.assertRaisesRegex(ValueError, "different case"):
            groups.respond_to_invitation("other", "friend1", True, share_safety=True)

    def test_delivery_only_to_accepted_peers_and_supervisor(self):
        self.accept("friend1")
        self.accept("friend2")
        groups.invite_member("circle", "consultant", "friend3")
        result = self.report()
        self.assertTrue(result["created"])
        self.assertEqual(groups.list_alerts("friend1"), [])
        self.assertEqual(groups.list_alerts("friend3"), [])
        self.assertEqual(groups.list_alerts("outsider"), [])
        peer = groups.list_alerts("friend2")[0]
        self.assertNotIn("source_patient_id", peer)
        self.assertNotIn("evidence_quote", peer)
        self.assertNotIn("summary", peer)
        self.assertIn("not verified", peer["message"])
        supervisor = groups.list_alerts("consultant", "supervisor")[0]
        self.assertEqual(supervisor["source_patient_id"], "friend1")
        self.assertEqual(supervisor["evidence_quote"], self.incident["evidence_quote"])

    def test_case_isolation_and_members_joining_after_alert(self):
        self.accept("friend1")
        self.report()
        self.accept("friend2")
        self.assertEqual(groups.list_alerts("friend2"), [])
        groups.create_group("other", "case-b", "Other case", "consultant2")
        groups.invite_member("other", "consultant2", "other-patient")
        groups.respond_to_invitation("other", "other-patient", True, share_safety=True)
        with self.assertRaises(PermissionError):
            groups.record_incident("other", "friend1", "s", "t", self.incident, confirmed_firsthand=True)
        self.assertEqual(groups.list_alerts("consultant2", "supervisor"), [])
        self.assertEqual(groups.list_alerts("other-patient"), [])

    def test_retries_and_repeated_wording_do_not_make_duplicate_alerts(self):
        self.accept("friend1")
        first = self.report()
        self.assertFalse(self.report()["created"])
        self.assertFalse(self.report(turn="another-turn")["created"])
        self.assertEqual(self.count("chatbot_safety_incidents"), 1)
        self.assertEqual(self.count("chatbot_group_alerts"), 1)
        self.assertEqual(groups.list_alerts("consultant", "supervisor")[0]["alert_id"], first["alert_id"])

    def test_pattern_counts_different_people_not_number_of_messages(self):
        for patient in ("friend1", "friend2", "friend3"):
            self.accept(patient)
        self.report()
        self.report(turn="turn2", quote="I saw the same bike again outside")
        self.assertEqual(groups.list_alerts("consultant", "supervisor")[-1]["independent_reporters"], 1)
        self.report(patient="friend2", turn="turn3", quote="A car followed me home")
        notices = groups.list_alerts("friend3")
        self.assertEqual(notices[-1]["independent_reporters"], 2)
        self.assertIn("2 different members", notices[-1]["message"])

    def test_read_acknowledgement_and_leaving_do_not_create_incidents(self):
        self.accept("friend1")
        self.accept("friend2")
        alert = self.report()["alert_id"]
        groups.mark_alert(alert, "friend2")
        self.assertIsNotNone(groups.list_alerts("friend2")[0]["delivered_at"])
        self.assertEqual(self.count("chatbot_safety_incidents"), 1)
        with self.assertRaises(PermissionError):
            groups.mark_alert(alert, "outsider", acknowledge=True)
        groups.mark_alert(alert, "friend2", acknowledge=True)
        self.assertEqual(groups.list_alerts("friend2"), [])
        self.assertEqual(len(groups.list_alerts("friend2", pending_only=False)), 1)
        groups.leave_group("circle", "friend2")
        self.assertEqual(groups.list_alerts("friend2", pending_only=False), [])
        self.report(turn="turn2", quote="A car followed me today")
        self.assertEqual(groups.list_alerts("friend2"), [])
        with self.assertRaises(PermissionError):
            groups.mark_alert(alert, "friend2", acknowledge=True)

    def test_confirmation_is_required_even_for_manual_demo_reports(self):
        self.accept("friend1")
        with self.assertRaises(ValueError):
            groups.record_incident("circle", "friend1", "s", "t", self.incident)
        self.assertEqual(self.count("chatbot_safety_incidents"), 0)

    def test_extractor_accepts_only_new_firsthand_related_evidence(self):
        group = {"case_id": "case-a", "name": "Three friends"}
        item = dict(self.incident, is_firsthand=True, case_related=True, is_new_report=True)
        llm = Mock(return_value=json.dumps({"incidents": [item]}))
        result = groups.extract_incidents(self.incident["evidence_quote"], group, llm)
        self.assertEqual(result, [self.incident])
        self.assertTrue(llm.call_args.kwargs["format_json"])
        for flag in ("is_firsthand", "case_related", "is_new_report"):
            llm.return_value = json.dumps({"incidents": [dict(item, **{flag: False})]})
            self.assertEqual(groups.extract_incidents(self.incident["evidence_quote"], group, llm), [])
        llm.return_value = json.dumps({"incidents": [dict(item, evidence_quote="invented quote")]})
        with self.assertRaisesRegex(ValueError, "exact quote"):
            groups.extract_incidents(self.incident["evidence_quote"], group, llm)
        for content in ('{}', '{"incidents": null}', 'not json'):
            llm.return_value = content
            with self.assertRaises(ValueError):
                groups.extract_incidents("demo", group, llm)

    def test_cli_invitations_and_acceptance(self):
        with patch("sys.stdout", new_callable=io.StringIO) as output:
            groups.main(["invite", "--group-id", "circle", "--supervisor-id", "consultant", "--patient-id", "friend1"])
            groups.main(["invitations", "--patient-id", "friend1"])
            groups.main(["accept", "--group-id", "circle", "--patient-id", "friend1", "--share-safety-alerts"])
        self.assertIn("Private chats", output.getvalue())
        self.assertEqual(groups.get_membership("friend1")["case_id"], "case-a")

    def test_patient_inbox_shows_latest_once_and_keeps_complete_history(self):
        for patient in ("friend1", "friend2", "friend3"):
            self.accept(patient)
        first = self.report()
        latest = self.report(patient="friend2", turn="turn2", quote="A car followed me home")
        with patch("sys.stdout", new_callable=io.StringIO) as output:
            groups.main(["inbox", "--recipient-id", "friend3"])
        self.assertEqual(output.getvalue().count("2 different members"), 1)
        self.assertNotIn(first["alert_id"], output.getvalue())
        self.assertIn(latest["alert_id"], output.getvalue())
        self.assertNotIn('"alert_id"', output.getvalue())
        with patch("sys.stdout", new_callable=io.StringIO) as output:
            groups.main(["inbox", "--recipient-id", "friend3"])
        self.assertEqual(output.getvalue().strip(), "No new case-circle notices.")
        with patch("sys.stdout", new_callable=io.StringIO) as output:
            groups.main(["inbox", "--recipient-id", "friend3", "--history", "--json"])
        history = json.loads(output.getvalue())
        self.assertEqual(len(history), 2)
        self.assertIsNone(history[0]["delivered_at"])
        self.assertIsNotNone(history[1]["delivered_at"])
        groups.mark_alert(latest["alert_id"], "friend3", acknowledge=True)
        self.assertEqual(groups.list_alerts("friend3", new_only=True, latest_only=True), [])

    def test_new_update_after_delivery_is_visible_and_categories_stay_separate(self):
        for patient in ("friend1", "friend2", "friend3"):
            self.accept(patient)
        initial = self.report()
        groups.mark_alert(initial["alert_id"], "friend3")
        update = self.report(patient="friend2", turn="turn2", quote="A car followed me home")
        threat = groups.record_incident("circle", "friend1", "s", "threat-turn", {
            "kind": "threat", "summary": "Reported a threat", "evidence_quote": "He threatened me",
        }, confirmed_firsthand=True)
        fresh = groups.list_alerts("friend3", new_only=True, latest_only=True)
        self.assertEqual({n["alert_id"] for n in fresh}, {update["alert_id"], threat["alert_id"]})

    def test_supervisor_keeps_individual_reports_and_json_is_not_printed_twice(self):
        for patient in ("friend1", "friend2", "friend3"):
            self.accept(patient)
        self.report()
        self.report(patient="friend2", turn="turn2", quote="A car followed me home")
        with patch("sys.stdout", new_callable=io.StringIO) as output:
            groups.main(["inbox", "--recipient-id", "consultant", "--role", "supervisor", "--json"])
        records = json.loads(output.getvalue())
        self.assertEqual(len(records), 2)
        self.assertEqual({r["source_patient_id"] for r in records}, {"friend1", "friend2"})
        self.assertTrue(all(r["delivered_at"] is not None for r in records))
        with patch("sys.stdout", new_callable=io.StringIO) as output:
            groups.main(["inbox", "--recipient-id", "consultant", "--role", "supervisor"])
        self.assertEqual(output.getvalue().strip(), "No new case-circle notices.")


if __name__ == "__main__":
    unittest.main()
