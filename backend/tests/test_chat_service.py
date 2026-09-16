from __future__ import annotations

from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from backend.chat_service import end_session, generate_and_persist_reply, owned_open_session, persist_turn, start_session
from backend.database import connect, initialize_schema
from schemas.schemas import ArousalFeatures, ArousalLabel, EmotionScores


SOURCE_DB = Path(__file__).parents[2] / "intelligence_model" / "data" / "still.db"


class ChatSessionServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "still.db"
        shutil.copy2(SOURCE_DB, self.path)
        initialize_schema(self.path)
        self.conn = connect(self.path)

    def tearDown(self) -> None:
        self.conn.close()
        self.directory.cleanup()

    def test_persists_a_turn_and_ends_once(self) -> None:
        session_id = start_session(self.conn, "chat-patient")
        turn_id = persist_turn(self.conn, session_id=session_id, patient_id="chat-patient", transcript="I feel worried.",
            arousal=ArousalFeatures(pitch_mean=120, pitch_std=5, energy=.1, zero_crossing_rate=.02, pause_ratio=.1, arousal_label=ArousalLabel.MODERATE),
            emotion=EmotionScores(anger=0, disgust=0, fear=.4, joy=0, neutral=.6, sadness=0, surprise=0))
        self.assertIsNotNone(owned_open_session(self.conn, "chat-patient", session_id))
        self.assertEqual(self.conn.execute("SELECT transcript FROM turns WHERE turn_id = ?", (turn_id,)).fetchone()[0], "I feel worried.")
        with patch("backend.chat_service.end_session_and_run") as run:
            end_session(self.conn, session_id)
        run.assert_called_once()
        self.assertEqual(run.call_args.args[0], session_id)

    @patch("backend.chat_service.requests.post")
    def test_persists_assistant_reply_without_exposing_it_to_intelligence_turns(self, post) -> None:
        session_id = start_session(self.conn, "chat-patient")
        self.conn.execute("INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?)", ("message", session_id, "user", "hello", "2026-01-01T00:00:00+00:00"))
        post.return_value.json.return_value = {"message": {"content": "How has that been for you?"}}
        reply = generate_and_persist_reply(self.conn, session_id=session_id, patient_id="chat-patient")
        self.assertEqual(reply, "How has that been for you?")
        self.assertEqual(self.conn.execute("SELECT role FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC", (session_id,)).fetchone()[0], "assistant")


if __name__ == "__main__":
    unittest.main()
