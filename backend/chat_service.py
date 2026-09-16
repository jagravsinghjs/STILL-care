"""Server-side audio turn processing and persisted chat-session state."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import uuid
import requests

INTELLIGENCE_ROOT = Path(__file__).parents[1] / "intelligence_model"
if str(INTELLIGENCE_ROOT) not in sys.path:
    sys.path.insert(0, str(INTELLIGENCE_ROOT))

from schemas.schemas import ArousalFeatures, ArousalLabel, EmotionScores, TurnRecord
from pipeline.ingest import end_session_and_run, ingest_turn


_whisper = None
_emotion = None


def start_session(conn: sqlite3.Connection, patient_id: str) -> str:
    session_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO sessions (session_id, patient_id, start_time, turn_count) VALUES (?, ?, ?, 0)",
        (session_id, patient_id, datetime.now(timezone.utc).isoformat()),
    )
    return session_id


def owned_open_session(conn: sqlite3.Connection, patient_id: str, session_id: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM sessions WHERE session_id = ? AND patient_id = ? AND end_time IS NULL", (session_id, patient_id)
    ).fetchone()


def _models():
    global _whisper, _emotion
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel(os.environ.get("STILL_WHISPER_MODEL", "base.en"), compute_type="int8")
    if _emotion is None:
        from transformers import pipeline
        _emotion = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", top_k=None)
    return _whisper, _emotion


def _acoustic(path: str) -> tuple[ArousalFeatures, dict]:
    import librosa
    import numpy as np
    y, sr = librosa.load(path, sr=None, mono=True)
    if len(y) == 0:
        raise ValueError("The recording contains no audio.")
    f0, _, _ = librosa.pyin(y, fmin=75, fmax=450, sr=sr)
    voiced = f0[~np.isnan(f0)]
    rms = librosa.feature.rms(y=y)[0]
    pause = 1 - sum(e - s for s, e in librosa.effects.split(y, top_db=25)) / len(y)
    pitch_std, energy_std = float(np.std(voiced)) if len(voiced) else 0.0, float(np.std(rms))
    score = int(pitch_std > 40) + int(energy_std > .02) - int(pause > .3)
    label = ArousalLabel.HIGH if score >= 2 else ArousalLabel.LOW if score <= -1 else ArousalLabel.MODERATE
    return ArousalFeatures(pitch_mean=float(np.mean(voiced)) if len(voiced) else 0., pitch_std=pitch_std,
        energy=float(np.mean(rms)), zero_crossing_rate=float(np.mean(librosa.feature.zero_crossing_rate(y)[0])),
        pause_ratio=max(0., min(1., float(pause))), arousal_label=label), {}


def process_audio(audio: bytes, suffix: str) -> tuple[str, ArousalFeatures, EmotionScores]:
    if not audio:
        raise ValueError("The recording is empty.")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as file:
        file.write(audio)
        path = file.name
    try:
        whisper, emotion = _models()
        segments, _ = whisper.transcribe(path, language="en")
        transcript = " ".join(s.text.strip() for s in segments if s.text.strip()).strip()
        if not transcript:
            raise ValueError("No speech could be transcribed from this recording.")
        arousal, _ = _acoustic(path)
        labels = emotion(transcript)[0]
        values = {str(item["label"]).lower(): float(item["score"]) for item in labels}
        scores = EmotionScores(**{key: values.get(key, 0.) for key in EmotionScores.model_fields})
        return transcript, arousal, scores
    finally:
        Path(path).unlink(missing_ok=True)


def persist_turn(conn: sqlite3.Connection, *, session_id: str, patient_id: str, transcript: str,
                 arousal: ArousalFeatures, emotion: EmotionScores) -> str:
    turn_id = str(uuid.uuid4())
    ingest_turn(TurnRecord(turn_id=turn_id, session_id=session_id, patient_id=patient_id,
        timestamp=datetime.now(timezone.utc), transcript=transcript, arousal=arousal, emotion=emotion), conn=conn)
    conn.execute("INSERT INTO chat_messages VALUES (?, ?, 'user', ?, ?)",
        (str(uuid.uuid4()), session_id, transcript, datetime.now(timezone.utc).isoformat()))
    return turn_id


def generate_and_persist_reply(conn: sqlite3.Connection, *, session_id: str, patient_id: str) -> str:
    """Use only this patient's persisted context; never send it to other users."""
    context_row = conn.execute("SELECT case_facts_path FROM patients WHERE patient_id = ?", (patient_id,)).fetchone()
    case_context = ""
    if context_row and context_row["case_facts_path"]:
        path = Path(context_row["case_facts_path"])
        if path.is_file():
            facts = json.loads(path.read_text(encoding="utf-8"))
            case_context = facts.get("status_summary", "")
    messages = conn.execute("SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at", (session_id,)).fetchall()
    payload = {
        "model": os.environ.get("STILL_OLLAMA_MODEL", "qwen2.5:7b-instruct"),
        "stream": False,
        "messages": [{"role": "system", "content": "You are STILL, a warm non-diagnostic listener. Reply in 2-3 short sentences, acknowledge the user, and ask one open question. Do not mention hidden analysis or case context." + (f" Background context: {case_context}" if case_context else "")}] + [dict(row) for row in messages],
    }
    response = requests.post(os.environ.get("STILL_OLLAMA_URL", "http://127.0.0.1:11434/api/chat"), json=payload, timeout=120)
    response.raise_for_status()
    reply = response.json().get("message", {}).get("content", "").strip()
    if not reply:
        raise RuntimeError("The assistant did not return a reply.")
    conn.execute("INSERT INTO chat_messages VALUES (?, ?, 'assistant', ?, ?)",
        (str(uuid.uuid4()), session_id, reply, datetime.now(timezone.utc).isoformat()))
    return reply


def end_session(conn: sqlite3.Connection, session_id: str) -> None:
    count = conn.execute("SELECT COUNT(*) FROM turns WHERE session_id = ?", (session_id,)).fetchone()[0]
    if count == 0:
        raise ValueError("A session needs at least one turn before it can end.")
    end_session_and_run(session_id, datetime.now(timezone.utc), count, conn=conn)
