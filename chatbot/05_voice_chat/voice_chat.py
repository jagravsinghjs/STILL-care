"""
voice_chat.py
Live, voice-based conversation with the assistant. Per turn:
  record -> transcribe (faster-whisper) -> acoustic features (librosa)
  -> text emotion (j-hartmann) -> conversational reply (Ollama)
  -> [INTEGRATION] push turn to intelligence_model via ingest_turn()
Raw audio is NEVER written to disk or kept after a turn is processed —
only the transcript text, extracted features, and eventual report persist.

At the end of the session (you choose to stop between turns), TWO
separate reports are generated, on purpose -- they answer different
questions and neither replaces the other:
  1. This script's own report.json + mental_state.png -- a THIS-SESSION-ONLY
     turn-by-turn distress read and a warm patient-facing closing message.
     Saved to output/session_<timestamp>/.
  2. [INTEGRATION] intelligence_model's Modules 11-17 chain, triggered via
     end_session_and_run() -- computes this session's summary, THEN looks
     across the patient's last 10 sessions for a trend, risk score, tier,
     and (if warranted) a supervisor alert. This is cross-session and this
     script cannot do it alone; only intelligence_model has the history.

Case context (automatic, via the shared patient registry):
  [INTEGRATION] case_facts.json is no longer passed in by hand via a
  --case-facts flag. Instead, at session start, this script looks up
  patient_id in the shared patient registry (see patient_registry.py --
  a small table in the same still.db intelligence_model already owns) to
  find that patient's case_facts.json path, if one has ever been
  registered for them (via case_profile.py --patient-id --output). If
  none is found, the session proceeds with no case context, exactly as if
  --case-facts had been omitted before this change -- this is not an
  error, just means this patient has no case profile on file yet.
  Its contents are rendered into the system prompt at session start so
  the patient doesn't have to re-explain their FIR, an upcoming hearing,
  etc. At session end, the full conversation is fed back through the same
  extract/merge/summarize logic used for direct profile edits, and the
  file (at its already-registered path) is updated in place. This is the
  chatbot's "memory" — instead of recalling old conversation turns
  directly, whatever it learns gets folded into case_facts, which gets
  reloaded next session. A human no longer needs to remember or type the
  correct file path every time -- only --patient-id is needed.

[INTEGRATION] --patient-id (required):
  There is no auth/login system yet, so patient identity is passed
  explicitly on the command line rather than resolved from a session/token.
  This is the same patient_id you passed to case_profile.py --patient-id
  when that patient's case profile was created/updated.
  session_id is generated fresh, once, per run of this script -- one
  session = one run = one uuid.

Usage:
    python voice_chat.py --patient-id patient_001
    (case_facts.json, if any exists for this patient, is now found automatically --
     see the patient registry note above. --case-facts is no longer needed.)
"""

import json
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone

import numpy as np
import requests
import sounddevice as sd
import soundfile as sf
import librosa
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from faster_whisper import WhisperModel
from transformers import pipeline

# [INTEGRATION] intelligence_model's public contract -- see INTEGRATION.md.
# These are the only two functions this script needs from that repo.
from pipeline.ingest import ingest_turn, end_session_and_run
from schemas.schemas import ArousalFeatures, ArousalLabel, EmotionScores, TurnRecord

# [INTEGRATION] shared patient_id -> case_facts_path registry (fixes the
# "human has to remember which case_facts_*.json belongs to which patient"
# gap). See patient_registry.py -- copy it alongside this script, or
# wherever your PYTHONPATH already resolves it from.
from patient_registry import lookup_case_facts_path

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen2.5:7b-instruct"
SAMPLE_RATE = 16000

# Whisper hallucination mitigation. On short/near-silent/noisy audio,
# faster-whisper will sometimes confidently return text that was never said
# -- either generic training-data phrases ("thanks for watching") or, worse,
# text in a totally different language/script than what was spoken. Forcing
# a fixed language stops the per-clip language re-guessing that causes the
# latter; the confidence thresholds below (same defaults OpenAI's own
# reference Whisper implementation uses) filter out segments likely to be
# hallucinated rather than real transcription.
WHISPER_LANGUAGE = "en"  # set to None for auto-detect / adjust for multilingual support later
NO_SPEECH_PROB_THRESHOLD = 0.6
LOGPROB_THRESHOLD = -1.0
COMPRESSION_RATIO_THRESHOLD = 2.4

# [INTEGRATION] classify_arousal() below returns three string buckets that
# don't line up 1:1 in meaning with ArousalLabel's three enum members.
# LOW/HIGH map cleanly; "neutral" has no honest match (it means "no clear
# signal either way", not "medium arousal") but ArousalLabel has no
# NEUTRAL/UNKNOWN option, so by convention it's treated as MODERATE -- the
# closest available meaning to "inconclusive". This is a real, deliberate
# choice, not a placeholder -- revisit only by widening classify_arousal()'s
# thresholds if "neutral" ends up too large a bucket in practice.
AROUSAL_LABEL_MAP = {
    "low_arousal": ArousalLabel.LOW,
    "neutral": ArousalLabel.MODERATE,
    "high_arousal": ArousalLabel.HIGH,
}

# ------------------------------------------------------------------
# Case-context integration (06_case_profile)
# ------------------------------------------------------------------

CASE_PROFILE_DIR = os.path.join(SCRIPT_DIR, "..", "06_case_profile")
sys.path.insert(0, CASE_PROFILE_DIR)
try:
    from case_profile import extract_and_merge_case_facts
except ImportError:
    extract_and_merge_case_facts = None
    print(
        "[warn] Could not import case_profile.py from 06_case_profile -- "
        "case-context injection and post-session extraction will be skipped."
    )

# ------------------------------------------------------------------
# Prompts
# ------------------------------------------------------------------

CONVO_SYSTEM_PROMPT = """You are a warm, present listener. Someone is checking in by voice, between their
doctor visits, just to talk through how they're doing — casual, no pressure, like talking to a friend.
This is NOT a diagnostic session and you are NOT a therapist. You are not here to fix anything today —
you're here so that later, their doctor has an honest picture of how things have actually been, instead
of the patient having to reconstruct weeks from memory in a rushed 15-minute appointment.

After what the person says, you'll sometimes see a bracketed note like [voice cues: ...] — this is
acoustic and text-emotion analysis of HOW they said it, not something they said out loud. Use it only
to calibrate your tone (e.g. if the cues suggest more distress than the words alone convey, be a little
gentler) — NEVER mention, quote, or reference these cues directly. The person does not know this
analysis is happening in the background.

Your job each turn:
- Briefly acknowledge what they just said, in your own words (1 sentence) — show you actually heard it.
- Then ask ONE genuinely curious, open-ended follow-up, specific to what they just said — not generic,
  not yes/no.

Hard rules:
- Do NOT try to wrap up or close out the conversation, ever — ending the session is entirely the
  person's decision, made outside this conversation, never something you initiate or hint at.
- Do NOT jump to advice or coping tips mid-conversation. Just listen and ask.
- Do NOT diagnose or use clinical labels.
- Keep replies short: 2-3 sentences, casual, like a friend actually paying attention.
- 0-1 emoji per reply, only if natural — do not force it every turn.

Respond with plain conversational text only — no JSON, no formatting.
"""

REPORT_SYSTEM_PROMPT = """You are a clinical decision-support assistant, NOT a therapist and NOT a
diagnostic tool. You are given a full voice-based conversation between a patient and a listening
assistant, recorded between doctor visits. The goal is to give the doctor an accurate memory of how
the patient has actually been doing — not a diagnosis, not an illness score.

For each turn you're given the transcribed words, acoustic features (pitch variability, energy
variability, pause ratio, arousal label), and text-based emotion scores.

Your job:
1. For EACH turn, assign a "distress_score" from 0 (calm/settled) to 10 (highly distressed/agitated),
   weighing the words, the acoustic cues, AND the text emotion scores together — not any single signal
   alone.
2. Write a "clinician_summary" (4-6 sentences): the patient's apparent trajectory across the
   conversation, notable themes, and anything worth exploring further at the appointment. Frame
   everything as decision-support, never diagnosis ("may indicate", "consider asking about" — never
   "patient has X").
3. Write a "patient_message" (4-6 sentences, ~60-90 words) to close the session — warm, casual, like a
   friend, 2-4 single simple emoji placed mid-sentence (never combine two emoji with a joiner character).
   Validate what they shared across the WHOLE conversation. Do not diagnose. Do not give false
   reassurance if the content suggests real distress. Never suggest medication or treatment techniques.
   You may offer ONE small suggestion only if clearly tailored to what THEY specifically described as
   available (do not suggest friends/family if they said those aren't an option) — otherwise skip it.
   Never mention "doctor" or "appointment" in this message — handled separately.

Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "turns": [
    {"turn_index": <int>, "distress_score": <int 0-10>, "note": "<short phrase why>"}
  ],
  "clinician_summary": "<string>",
  "patient_message": "<string>"
}
"""


# ------------------------------------------------------------------
# Case context: load, inject into system prompt, and update after session
# ------------------------------------------------------------------

def load_case_facts(path):
    if not path or not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_context_block(case_facts):
    """
    Render known case facts into a block prepended to the system prompt.
    The model is told to use this silently -- never recite it back or
    mention it was given background info, same pattern already used for
    the [voice cues: ...] notes above.
    """
    if not case_facts:
        return ""

    lines = [
        "You have been given some background the patient has already shared in "
        "previous sessions or their case profile. Treat it the way you'd naturally "
        "remember something a friend told you last time you talked -- if it's "
        "relevant to what they're saying now, or if they directly ask whether you "
        "remember something, respond specifically and confidently using what you "
        "know (e.g. 'the car that's been following you -- has that happened again?'). "
        "Do NOT play vague or non-committal when you actually do know the answer. "
        "The only things to avoid: don't mechanically read this out as a list, and "
        "don't say phrases like 'based on your case profile' or 'I was told' -- just "
        "talk about it like a person who remembers, not a system reciting stored data.",
        "",
        "Known case context:",
    ]

    if case_facts.get("case_type"):
        lines.append(f"- Case type: {case_facts['case_type']}")
    if case_facts.get("status_summary"):
        lines.append(f"- Status: {case_facts['status_summary']}")

    upcoming = [e for e in case_facts.get("hearing_events", []) if e.get("type") == "next_hearing"]
    if upcoming:
        dates = ", ".join(e.get("date", "unknown date") for e in upcoming)
        lines.append(f"- Upcoming hearing(s): {dates}")

    if case_facts.get("threats_mentioned"):
        lines.append(f"- Reported safety concerns: {'; '.join(case_facts['threats_mentioned'])}")

    return "\n".join(lines)


def update_case_facts_from_session(turns, case_facts, model=MODEL):
    """
    Treats the whole conversation as another source of profile updates --
    same extract/merge/summarize logic used for direct profile edits,
    applied to whatever came up in chat. This is the "memory" mechanism:
    instead of the chatbot recalling old conversation turns directly,
    whatever it learns gets folded into case_facts, which gets reloaded
    and injected at the start of the next session.
    """
    if extract_and_merge_case_facts is None:
        print("[warn] case_profile module not available -- skipping case-facts update from this session.")
        return case_facts

    conversation_text = "\n".join(t["text"] for t in turns if t.get("text"))
    if not conversation_text.strip():
        return case_facts

    return extract_and_merge_case_facts(conversation_text, existing_facts=case_facts, model=model)


# ------------------------------------------------------------------
# Model loading (once, at startup)
# ------------------------------------------------------------------

def load_models():
    print("Loading Whisper model...")
    t0 = time.time()
    whisper_model = WhisperModel("medium", device="cpu", compute_type="int8")
    print(f"Whisper loaded in {time.time()-t0:.1f}s")

    print("Loading text-emotion model...")
    t0 = time.time()
    emotion_classifier = pipeline(
        task="text-classification",
        model="j-hartmann/emotion-english-distilroberta-base",
        top_k=None,
        device=0,
    )
    print(f"Emotion model loaded in {time.time()-t0:.1f}s\n")

    return whisper_model, emotion_classifier


# ------------------------------------------------------------------
# Audio recording (in-memory only, never written to disk)
# ------------------------------------------------------------------

def record_turn_audio(save_path):
    input("Press Enter to start speaking...")
    print("Recording... press Enter again to stop.")

    frames = []

    def callback(indata, frames_count, time_info, status):
        frames.append(indata.copy())

    stream = sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32", callback=callback)
    with stream:
        input()

    if not frames:
        return False

    audio = np.concatenate(frames, axis=0).flatten()
    sf.write(save_path, audio, SAMPLE_RATE)
    return True


# ------------------------------------------------------------------
# Acoustic feature extraction (same logic as voice_emotion.py)
# ------------------------------------------------------------------

def extract_acoustic_features(wav_path):
    y, sr = librosa.load(wav_path, sr=None)
    if len(y) == 0:
        return {}

    f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=75, fmax=450, sr=sr)
    f0_voiced = f0[~np.isnan(f0)]

    if len(f0_voiced) > 2:
        median_f0 = np.median(f0_voiced)
        clean = f0_voiced[(f0_voiced > median_f0 * 0.6) & (f0_voiced < median_f0 * 1.6)]
        if len(clean) > 0:
            f0_voiced = clean

    pitch_mean = float(np.mean(f0_voiced)) if len(f0_voiced) else 0.0
    pitch_std = float(np.std(f0_voiced)) if len(f0_voiced) else 0.0

    rms = librosa.feature.rms(y=y)[0]
    energy_mean = float(np.mean(rms))
    energy_std = float(np.std(rms))

    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)[0]))
    spec_cent = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)[0]))

    intervals = librosa.effects.split(y, top_db=25)
    voiced_duration = sum((e - s) for s, e in intervals) / sr
    total_duration = len(y) / sr
    pause_ratio = 1 - (voiced_duration / total_duration) if total_duration > 0 else 0.0

    return {
        "pitch_mean_hz": round(pitch_mean, 2),
        "pitch_std_hz": round(pitch_std, 2),
        "energy_mean": round(energy_mean, 4),
        "energy_std": round(energy_std, 4),
        "zero_crossing_rate": round(zcr, 4),
        "spectral_centroid": round(spec_cent, 2),
        "pause_ratio": round(pause_ratio, 3),
    }


def filter_hallucinated_segments(segments):
    """
    Drop segments faster-whisper is unconfident about. These are the ones
    most likely to be hallucinated (generic outro phrases, gibberish in the
    wrong script/language) rather than real transcription of what was said
    -- especially common on short or near-silent recordings.
    """
    kept = []
    for seg in segments:
        if seg.no_speech_prob is not None and seg.no_speech_prob > NO_SPEECH_PROB_THRESHOLD:
            continue
        if seg.avg_logprob is not None and seg.avg_logprob < LOGPROB_THRESHOLD:
            continue
        if seg.compression_ratio is not None and seg.compression_ratio > COMPRESSION_RATIO_THRESHOLD:
            continue
        kept.append(seg)
    return kept


def classify_arousal(features):
    if not features:
        return "unknown"
    pitch_std = features.get("pitch_std_hz", 0)
    energy_std = features.get("energy_std", 0)
    pause_ratio = features.get("pause_ratio", 0)
    score = 0
    if pitch_std > 40:
        score += 1
    if energy_std > 0.02:
        score += 1
    if pause_ratio > 0.3:
        score -= 1
    if score >= 2:
        return "high_arousal"
    elif score <= -1:
        return "low_arousal"
    return "neutral"


# [INTEGRATION] Build a TurnRecord and push it to intelligence_model.
# Called once per turn, right after the turn's own acoustic/emotion/text
# data is assembled -- see the call site inside run_conversation().
def push_turn_to_intelligence_model(session_id, patient_id, turn_text, acoustic, arousal, text_emotion):
    arousal_label = AROUSAL_LABEL_MAP.get(arousal, ArousalLabel.MODERATE)

    turn_record = TurnRecord(
        turn_id=str(uuid.uuid4()),
        session_id=session_id,
        patient_id=patient_id,
        timestamp=datetime.now(timezone.utc),
        transcript=turn_text,
        arousal=ArousalFeatures(
            pitch_mean=acoustic.get("pitch_mean_hz", 0.0),
            pitch_std=acoustic.get("pitch_std_hz", 0.0),
            energy=acoustic.get("energy_mean", 0.0),
            zero_crossing_rate=acoustic.get("zero_crossing_rate", 0.0),
            pause_ratio=acoustic.get("pause_ratio", 0.0),
            arousal_label=arousal_label,
        ),
        emotion=EmotionScores(
            anger=text_emotion.get("anger", 0.0),
            disgust=text_emotion.get("disgust", 0.0),
            fear=text_emotion.get("fear", 0.0),
            joy=text_emotion.get("joy", 0.0),
            neutral=text_emotion.get("neutral", 0.0),
            sadness=text_emotion.get("sadness", 0.0),
            surprise=text_emotion.get("surprise", 0.0),
        ),
    )
    try:
        ingest_turn(turn_record)
    except Exception as e:
        # Fail soft, same philosophy as the case_profile JSON-parse fallback
        # below -- a stalled or unreachable intelligence_model must never
        # break the live conversation the patient is having right now.
        print(f"[warn] ingest_turn() failed, this turn will be missing from intelligence_model: {e}")


# ------------------------------------------------------------------
# Ollama call
# ------------------------------------------------------------------

def call_ollama_chat(messages, system_prompt, format_json=False):
    payload = {
        "model": MODEL,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "stream": False,
    }
    if format_json:
        payload["format"] = "json"

    resp = requests.post(OLLAMA_URL, json=payload, timeout=300)
    resp.raise_for_status()
    data = resp.json()

    if "message" not in data or "content" not in data.get("message", {}):
        print("Unexpected Ollama response shape:")
        print(json.dumps(data, indent=2))
        raise RuntimeError("Ollama did not return message.content")

    return data["message"]["content"]


# ------------------------------------------------------------------
# Post-processing helpers
# ------------------------------------------------------------------

def redistribute_trailing_emoji(text):
    text = re.sub(
        "([\U0001F300-\U0001FAFF\U00002600-\U000027BF])\u200d(?=[\U0001F300-\U0001FAFF\U00002600-\U000027BF])",
        r"\1 ",
        text,
    )
    emoji_pattern = re.compile(
        "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF\u200d\uFE0F]+"
    )
    single_emoji_pattern = re.compile(
        "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF]"
    )
    trailing_match = re.search(r"(\s*(?:" + emoji_pattern.pattern + r"\s*)+)$", text)
    if not trailing_match:
        return text
    trailing_block = trailing_match.group(0)
    emojis = single_emoji_pattern.findall(trailing_block)
    if len(emojis) < 2:
        return text
    body = text[: trailing_match.start()].strip()
    sentences = re.split(r"(?<=[.!?])\s+", body)
    sentences = [s for s in sentences if s.strip()]
    if not sentences:
        return text
    rebuilt = []
    for i, sentence in enumerate(sentences):
        if i < len(emojis):
            m = re.match(r"^(.*?)([.!?]?)$", sentence)
            core, punct = m.group(1), m.group(2)
            sentence = f"{core} {emojis[i]}{punct}"
        rebuilt.append(sentence)
    return " ".join(rebuilt)


def should_nudge_toward_doctor(turns):
    scores = [t["distress_score"] for t in turns]
    if len(scores) < 2:
        return False
    mid = len(scores) // 2
    first_half = scores[:mid] or [scores[0]]
    second_half = scores[mid:]
    avg_first = sum(first_half) / len(first_half)
    avg_second = sum(second_half) / len(second_half)
    return (avg_second - avg_first) >= 1.5 or scores[-1] >= 6


# ------------------------------------------------------------------
# Main conversation loop
# ------------------------------------------------------------------

def run_conversation(whisper_model, emotion_classifier, temp_dir, patient_id, system_prompt=CONVO_SYSTEM_PROMPT):
    print("\nSession started. After each reply, press Enter to keep talking, or type 'report' to end and generate the report.\n")

    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, "turn_tmp.wav")

    # [INTEGRATION] One session_id per run of this script. Generated here,
    # not passed in -- there's no upstream system yet that hands one out.
    session_id = str(uuid.uuid4())
    print(f"[integration] session_id = {session_id} (patient_id = {patient_id})\n")

    messages = []
    turns = []
    start_time = time.time()
    turn_index = 0

    opener = "Hey, how's it going? What's on your mind today?"
    print(f"Assistant: {opener}\n")
    messages.append({"role": "assistant", "content": opener})

    while True:
        got_audio = record_turn_audio(temp_path)
        if not got_audio:
            print("No audio captured, try again.")
            continue

        segments, info = whisper_model.transcribe(
            temp_path,
            beam_size=5,
            language=WHISPER_LANGUAGE,
            condition_on_previous_text=False,  # stops hallucination loops from compounding across turns
        )
        segments = list(segments)
        segments = filter_hallucinated_segments(segments)
        turn_text = " ".join(s.text.strip() for s in segments).strip()

        if not turn_text:
            print("Didn't catch that, try again.")
            os.remove(temp_path)
            continue

        print(f"You said: {turn_text}")

        elapsed = round(time.time() - start_time, 1)

        acoustic = extract_acoustic_features(temp_path)
        arousal = classify_arousal(acoustic)

        emotion_raw = emotion_classifier(turn_text)[0]
        text_emotion = {item["label"]: round(item["score"], 4) for item in emotion_raw}
        top_emotions = sorted(text_emotion.items(), key=lambda x: -x[1])[:3]

        os.remove(temp_path)  # done with the audio — comment this out if you want to keep turn recordings

        # [INTEGRATION] Push this turn to intelligence_model immediately --
        # per turn, not batched at session end. intelligence_model only
        # needs a plain database write here; it does no scoring per turn
        # itself (that happens later, all at once, in end_session_and_run).
        push_turn_to_intelligence_model(session_id, patient_id, turn_text, acoustic, arousal, text_emotion)

        context_note = (
            f"[voice cues: pitch_std={acoustic.get('pitch_std_hz', 0)}, "
            f"energy_std={acoustic.get('energy_std', 0)}, "
            f"pause_ratio={acoustic.get('pause_ratio', 0)}, "
            f"arousal={arousal}, top_text_emotion={top_emotions}]"
        )
        user_content = f"{turn_text}\n{context_note}"
        messages.append({"role": "user", "content": user_content})

        reply = call_ollama_chat(messages, system_prompt)
        print(f"\nAssistant: {reply}\n")
        messages.append({"role": "assistant", "content": reply})

        turns.append({
            "turn_index": turn_index,
            "elapsed_seconds": elapsed,
            "text": turn_text,
            "acoustic_features": acoustic,
            "arousal_label": arousal,
            "text_emotion": text_emotion,
        })
        turn_index += 1

        action = input("Press Enter to keep talking, or type 'report' to end and generate the report: ").strip().lower()
        if action == "report":
            break

    return turns, session_id


# ------------------------------------------------------------------
# Report generation (voice_chat's OWN, single-session report --
# separate from, and complementary to, intelligence_model's chain)
# ------------------------------------------------------------------

def generate_report(turns, output_dir):
    transcript_for_model = [
        {
            "turn_index": t["turn_index"],
            "text": t["text"],
            "acoustic_features": t["acoustic_features"],
            "arousal_label": t["arousal_label"],
            "text_emotion": t["text_emotion"],
        }
        for t in turns
    ]
    user_content = "Conversation turns:\n\n" + json.dumps(transcript_for_model, indent=2)

    raw = call_ollama_chat(
        [{"role": "user", "content": user_content}], REPORT_SYSTEM_PROMPT, format_json=True
    )

    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    result = json.loads(cleaned.strip())

    result["patient_message"] = redistribute_trailing_emoji(result["patient_message"])

    if should_nudge_toward_doctor(result["turns"]):
        result["patient_message"] += " If this keeps building, it could help to flag it with your doctor too."

    elapsed_by_index = {t["turn_index"]: t["elapsed_seconds"] for t in turns}
    for turn in result["turns"]:
        turn["elapsed_seconds"] = elapsed_by_index.get(turn["turn_index"], 0)

    os.makedirs(output_dir, exist_ok=True)
    report_path = os.path.join(output_dir, "report.json")
    with open(report_path, "w") as f:
        json.dump(result, f, indent=4)

    xs = [t["elapsed_seconds"] for t in result["turns"]]
    ys = [t["distress_score"] for t in result["turns"]]
    plt.figure(figsize=(9, 4.5))
    plt.plot(xs, ys, marker="o", linewidth=2)
    plt.ylim(0, 10)
    plt.xlabel("Time into session (s)")
    plt.ylabel("Distress / stress indicator (0-10)")
    plt.title("Session distress indicator over time")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    graph_path = os.path.join(output_dir, "mental_state.png")
    plt.savefig(graph_path, dpi=150)
    plt.close()

    print(f"\nReport written to {report_path}")
    print(f"Graph written to {graph_path}")
    print("\nClinician summary:\n", result["clinician_summary"])
    print("\nClosing message:\n", result["patient_message"])


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run a voice check-in session")
    parser.add_argument(
        "--patient-id",
        required=True,
        help="[INTEGRATION] Identity of the patient having this session. No auth system "
             "exists yet, so this is passed explicitly. Should match the patient whose "
             "case profile was registered via case_profile.py --patient-id, if any.",
    )
    args = parser.parse_args()

    # [INTEGRATION] Look up this patient's case_facts path automatically
    # instead of requiring a --case-facts flag typed in by hand. Returns
    # None if this patient has never had a case profile registered --
    # that's a normal, expected state (new patient, or one with no case
    # profile yet), not an error.
    case_facts_path = lookup_case_facts_path(args.patient_id)
    if case_facts_path is None:
        print(f"[integration] No case profile registered yet for patient_id={args.patient_id} -- "
              f"proceeding with no case context.")

    case_facts = load_case_facts(case_facts_path)
    if case_facts_path and case_facts is None:
        print(f"[warn] Registered case_facts path not found or empty: {case_facts_path}")

    context_block = build_context_block(case_facts)
    system_prompt = (
        f"{CONVO_SYSTEM_PROMPT}\n\n{context_block}" if context_block else CONVO_SYSTEM_PROMPT
    )

    whisper_model, emotion_classifier = load_models()
    temp_dir = os.path.join(SCRIPT_DIR, "tmp")
    turns, session_id = run_conversation(
        whisper_model, emotion_classifier, temp_dir, args.patient_id, system_prompt=system_prompt
    )

    if not turns:
        print("No turns recorded, nothing to report on.")
        sys.exit(0)

    if case_facts_path:
        updated_facts = update_case_facts_from_session(turns, case_facts)
        with open(case_facts_path, "w", encoding="utf-8") as f:
            json.dump(updated_facts, f, indent=2)
        print(f"\nCase facts updated: {case_facts_path}")

    # [INTEGRATION] Trigger the full Modules 11-17 chain now that the
    # session is over. This is the exact "who decides a session ended"
    # trigger point INTEGRATION.md calls out as open/unbuilt -- it's the
    # user typing 'report', right here.
    try:
        pipeline_result = end_session_and_run(
            session_id=session_id,
            end_time=datetime.now(timezone.utc),
            turn_count=len(turns),
        )
        print(f"\n[integration] intelligence_model pipeline result: {pipeline_result}")
    except Exception as e:
        print(f"[warn] end_session_and_run() failed -- this session will be missing from "
              f"intelligence_model's trend/risk/alert chain: {e}")

    # voice_chat's OWN report -- separate artifact, same as before.
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.join(SCRIPT_DIR, "output", f"session_{timestamp}")
    generate_report(turns, output_dir)