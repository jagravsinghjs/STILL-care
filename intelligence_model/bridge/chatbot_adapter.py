"""
bridge/chatbot_adapter.py

The missing piece between chatbot/ (Modules 6-9: Whisper -> acoustic
metrics -> speech emotion -> chat_llm) and intelligence_model's
pipeline.ingest.

WHERE THIS RUNS: needs `intelligence_model` installed (`pip install -e
/path/to/intelligence_model`, per its INTEGRATION.md) and STILL_DB_PATH
set to the same file the rest of Still uses. Whichever process actually
owns "a check-in just finished" (today: whoever calls chat_llm.py; in
the real product: probably 05_voice_chat.py or Setu's own backend) is
the one that should call ingest_from_chatbot_segments() below.

WHAT THIS DOES NOT DO: it does not touch chat_llm.py's LLM-generated
distress_score / clinician_summary / patient_message. See the docstring
on ingest_from_chatbot_segments() for why, and treat that as an open
decision, not a settled one -- flag it back to me if you disagree.

THREE MAPPING DECISIONS I MADE THAT YOU SHOULD SANITY-CHECK:

1. arousal_label ("high_arousal"/"neutral"/"low_arousal"/"unknown" ->
   HIGH/MODERATE/LOW). Your classifier never emits "moderate" itself,
   so I mapped "neutral" -> MODERATE as the middle bucket. "unknown"
   (empty audio segment) defaults to MODERATE rather than LOW, on the
   logic that "we don't know" shouldn't silently read as "definitely
   calm" in a system whose whole job is not missing distress. Change
   AROUSAL_LABEL_MAP / UNKNOWN_AROUSAL_DEFAULT below if you'd rather
   default elsewhere.

2. Emotion labels: your wav2vec2 model
   (ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition) emits 8
   RAVDESS-style labels; EmotionScores has 7 fixed fields. I've mapped
   the 7 that line up directly (angry->anger, fearful->fear,
   happy->joy, sad->sadness, surprised->surprise, disgust/neutral
   unchanged) and folded "calm"'s probability into "neutral" rather
   than dropping it, since both represent a non-distressed state and
   EmotionScores doesn't require the 7 fields to sum to 1.
   VERIFY model.config.id2label actually is this label set before
   trusting EMOTION_LABEL_MAP blindly -- I'm going from what this
   specific HF model is documented to output, not from a value I
   pulled from your actual JSON.

3. energy_std and spectral_centroid (from acoustic_metric.py) have no
   home in ArousalFeatures as currently defined -- they're computed
   and then silently dropped by this adapter. If that's real signal
   you want in the risk math, that's a schemas.py change (add fields
   to ArousalFeatures, extend TurnScorer to use them), not something
   this adapter should decide unilaterally given your own note that
   schemas.py is personally-maintained, ask-before-assuming.

IDEMPOTENCY NOTE: turns.turn_id is a plain INSERT with no upsert path
(db/repository.py's insert_turn). turn_id here is deterministic
(f"{session_id}::seg::{i:04d}"), which means re-running this adapter
over the same segments a second time will fail on a UNIQUE constraint,
not silently double-insert. That's arguably the right failure mode
(loud, not silently duplicated data) but it does mean "just re-run the
demo script" isn't automatically safe if a session was already ingested.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from schemas.schemas import ArousalFeatures, ArousalLabel, EmotionScores, TurnRecord
from pipeline.ingest import end_session_and_run, ingest_turn
from pipeline.orchestrator import PipelineResult

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. arousal_label mapping
# ---------------------------------------------------------------------------

AROUSAL_LABEL_MAP: dict[str, ArousalLabel] = {
    "high_arousal": ArousalLabel.HIGH,
    "neutral": ArousalLabel.MODERATE,
    "low_arousal": ArousalLabel.LOW,
}
UNKNOWN_AROUSAL_DEFAULT = ArousalLabel.MODERATE  # see decision (1) above


def _map_arousal_label(raw_label: str) -> ArousalLabel:
    if raw_label not in AROUSAL_LABEL_MAP:
        logger.warning(
            "chatbot_adapter: unrecognized arousal_label %r (expected one of "
            "%s) -- defaulting to %s. This should not happen against "
            "acoustic_metric.py's current classify_arousal(); if it does, "
            "something upstream changed.",
            raw_label, list(AROUSAL_LABEL_MAP), UNKNOWN_AROUSAL_DEFAULT.name,
        )
        return UNKNOWN_AROUSAL_DEFAULT
    return AROUSAL_LABEL_MAP[raw_label]


# ---------------------------------------------------------------------------
# 2. emotion label mapping
# ---------------------------------------------------------------------------
# Keys are this specific wav2vec2 model's id2label values. VERIFY these
# against model.config.id2label in your own environment before trusting
# this -- see decision (2) in the module docstring.
EMOTION_LABEL_MAP: dict[str, str] = {
    "angry": "anger",
    "disgust": "disgust",
    "fearful": "fear",
    "happy": "joy",
    "neutral": "neutral",
    "sad": "sadness",
    "surprised": "surprise",
    # "calm" has no direct EmotionScores field -- folded into "neutral"
    # below rather than mapped here directly.
}
_EMOTION_FIELDS = ("anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise")


def _map_emotion_probs(raw_probs: dict[str, float]) -> EmotionScores:
    scores = {field: 0.0 for field in _EMOTION_FIELDS}
    unrecognized = []

    for raw_label, prob in raw_probs.items():
        if raw_label == "calm":
            scores["neutral"] += prob  # decision (2): fold calm into neutral
            continue
        mapped = EMOTION_LABEL_MAP.get(raw_label)
        if mapped is None:
            unrecognized.append(raw_label)
            continue
        scores[mapped] += prob

    if unrecognized:
        logger.warning(
            "chatbot_adapter: unrecognized emotion label(s) %s in model output "
            "-- their probability mass was dropped, not folded anywhere. "
            "Update EMOTION_LABEL_MAP if the model's label set has changed.",
            unrecognized,
        )

    # Individual EmotionScores fields are only constrained 0.0-1.0 each
    # (Pydantic will reject out-of-range), never required to sum to 1 --
    # folding "calm" into "neutral" can only ever raise a value that was
    # already going to be checked per-field, so no extra clamping needed
    # here beyond what Pydantic already enforces on construction.
    return EmotionScores(**scores)


# ---------------------------------------------------------------------------
# 3. per-segment TurnRecord assembly
# ---------------------------------------------------------------------------

def _segment_to_turn_record(
    segment: dict,
    index: int,
    session_id: str,
    patient_id: str,
    session_start: datetime,
) -> TurnRecord:
    """
    One entry from transcript_with_emotions.json (the merged output of
    01_speech_to_text -> 02_acoustic_metrics -> 03_adding_emotions) ->
    one TurnRecord.

    Mapping assumption: one Whisper segment = one "turn". A single
    check-in (one recorded reflection) becomes one Still `session`
    with N turns, one per Whisper segment -- this is what makes
    within_session_trend (first-third vs last-third of the *segments in
    this recording*) meaningful. If your actual product definition of
    "session" is different (e.g. spans multiple check-ins), stop and
    tell me before wiring this up -- it changes what session_id means
    everywhere downstream.
    """
    acoustic = segment["acoustic_features"]

    arousal = ArousalFeatures(
        pitch_mean=acoustic["pitch_mean_hz"],
        pitch_std=acoustic["pitch_std_hz"],
        energy=acoustic["energy_mean"],
        zero_crossing_rate=acoustic["zero_crossing_rate"],
        pause_ratio=acoustic["pause_ratio"],
        arousal_label=_map_arousal_label(segment["arousal_label"]),
    )
    emotion = _map_emotion_probs(segment.get("speech_emotion", {}))

    return TurnRecord(
        turn_id=f"{session_id}::seg::{index:04d}",
        session_id=session_id,
        patient_id=patient_id,
        timestamp=session_start + timedelta(seconds=segment["start"]),
        transcript=segment["text"],
        arousal=arousal,
        emotion=emotion,
    )


# ---------------------------------------------------------------------------
# public entry point
# ---------------------------------------------------------------------------

def ingest_from_chatbot_segments(
    segments: list[dict],
    session_id: str,
    patient_id: str,
    session_start: datetime,
    conn=None,
) -> Optional[PipelineResult]:
    """
    Takes the merged segment list (transcript_with_emotions.json's
    top-level list -- after 01+02+03 have run, before or independent of
    04_chat_llm), ingests every segment as a turn, ends the session, and
    runs the full Module 11-17 chain.

    Deliberately does NOT call or depend on chat_llm.py. That module's
    per-segment `distress_score` (0-10, LLM-judged) is a second,
    independent answer to "how distressed is this person" alongside
    still_core.TurnScorer's deterministic arousal+emotion formula --
    and nothing in this project defines a relationship between the two.
    My recommendation: keep still_core/TurnScorer as the ONLY numeric
    input to the Module 11-17 risk math (deterministic, auditable,
    no LLM latency/cost/hallucination risk on the safety-critical path
    -- matching the same reasoning your own acute_keyword_detector.py
    README already gives for being rule-based, not ML-based). Treat
    chat_llm.py's clinician_summary / patient_message as a SEPARATE,
    purely presentational artifact -- e.g. attached to the session for
    a human to read -- never fed into EscalationRisk/RiskStatus. This
    is a product call, not something I should decide for you; if you
    want the LLM score to inform risk instead of (or in addition to)
    TurnScorer, that's a real schemas.py + still_core change, not a
    two-line adapter tweak.

    Returns None if the session had zero turns (segments was empty) --
    matches Module 11's own zero-turn contract; nothing gets written.
    """
    if not segments:
        logger.info(
            "chatbot_adapter: ingest_from_chatbot_segments called with zero "
            "segments for session_id=%r -- nothing to ingest.", session_id,
        )
        return None

    for i, segment in enumerate(segments):
        turn = _segment_to_turn_record(segment, i, session_id, patient_id, session_start)
        ingest_turn(turn, conn=conn)

    last_segment_end = segments[-1]["end"]
    end_time = session_start + timedelta(seconds=last_segment_end)

    return end_session_and_run(
        session_id=session_id,
        end_time=end_time,
        turn_count=len(segments),
        conn=conn,
    )


if __name__ == "__main__":
    # Minimal manual smoke test against a real transcript_with_emotions.json,
    # so you can sanity-check the mapping before wiring this into anything
    # real. Does NOT call chat_llm.py.
    import json
    import sys
    import uuid

    from db.connection import get_conn

    if len(sys.argv) != 2:
        print(f"usage: python {sys.argv[0]} path/to/transcript_with_emotions.json")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        segs = json.load(f)

    demo_session_id = f"demo-{uuid.uuid4()}"
    demo_patient_id = "demo-patient"

    with get_conn() as demo_conn:
        result = ingest_from_chatbot_segments(
            segs, demo_session_id, demo_patient_id, datetime.now(), conn=demo_conn,
        )

    if result is None:
        print("Zero segments, nothing ingested.")
    else:
        print(f"session_id={result.session_id}")
        print(f"summary: mean_score={result.summary.mean_score:.1f}" if result.summary else "no summary")
        print(f"trend: {result.trend.trend_label.value if result.trend else 'n/a'}")
        print(f"risk: {result.risk.risk_level.value if result.risk else 'n/a'} "
              f"(acute_override={result.risk.acute_override if result.risk else 'n/a'})")
        print(f"tier: {result.new_status.tier.value if result.new_status else 'n/a'}")
        print(f"alert: {result.alert.reason if result.alert else 'none'}")
        print(f"recommendation: {result.recommendation.categories if result.recommendation else 'none'}")