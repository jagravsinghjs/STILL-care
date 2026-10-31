# STILL-care

**AI-powered dynamic mental health monitoring for victims of atrocities**
SIH Problem Statement 26094 · Team **Works on arch BTW**

Victims of atrocities face threats, repeated court dates, delays and social isolation long after they file a complaint. Existing support is legal and financial; nobody continuously monitors how they are coping. STILL-care is a local voice chatbot that checks in with the victim, remembers their case, scores their distress, and gives counsellors an early signal before a crisis.

> All patient data in this repository is fictional.

---

## What it does

- **Talks to the patient by voice** and replies conversationally.
- **Reads how they speak, not just what they say:** pitch variation, loudness, pauses and emotion.
- **Scores distress (0-10) per turn** and draws a distress-over-time graph.
- **Remembers the case.** The patient describes their case in their own words; we extract the FIR number, legal sections, hearing dates, outcomes and threats into a structured profile. The bot uses it in conversation, and anything new said in a session is merged back into the profile.
- **Writes a clinician summary** with a reason for each score.
- **Runs fully locally:** speech recognition, emotion models and the LLM all run on your machine. Raw audio is deleted after each turn.

## Pipeline

The `chatbot/` folder is a numbered pipeline. Each module works on its own and feeds the next.

| Module | What it does |
|---|---|
| `01_speech_to_text` | Transcribes audio to text with timestamps (Whisper). |
| `02_acoustic_metrics` | Extracts pitch, energy, pause ratio, etc. and labels arousal (low / neutral / high). |
| `03_adding_emotions` | Adds speech-emotion scores to each segment. |
| `04_chat_llm` | Local LLM scores distress per segment; writes a clinician summary, patient message and graph. |
| `05_voice_chat` | The live version: record → transcribe → analyse → reply, every turn, then a report. |
| `06_case_profile` | Case memory: extracts and merges case facts from what the patient says. |

```
patient voice → Whisper → acoustic features + emotion → local LLM → reply
                                   ↓
                      distress score, graph, clinician report
case profile (06) ⇄ injected into the chat at start, updated at the end
```

## Requirements

- Linux/macOS/Windows with Python 3.12 and [uv](https://docs.astral.sh/uv/)
- [Ollama](https://ollama.com) with the `qwen2.5:7b-instruct` model
- A microphone and a quiet room
- `ffmpeg` and PortAudio (e.g. on Arch/EndeavourOS: `sudo pacman -S ffmpeg portaudio`)
- An NVIDIA GPU is recommended. The emotion model in `05_voice_chat` uses `device=0` (GPU); change it to `-1` in `load_models()` to run on CPU.

## Setup

```bash
git clone <repo-url>
cd STILL-care

# Python dependencies
uv venv
uv pip install faster-whisper librosa numpy torch transformers \
    sounddevice soundfile matplotlib requests spacy ollama

# Optional: better date detection in 06_case_profile (falls back to regex without it)
uv run python -m spacy download en_core_web_sm

# LLM
ollama pull qwen2.5:7b-instruct
```

Make sure Ollama is running before you start (`ollama serve`, or `systemctl status ollama`). Check with `ollama list`.

## Run it

All commands are run from the `chatbot/` folder.

```bash
cd chatbot
```

### 1. Build a patient's case profile (06)

Write what the patient would say about their case in a text file, then extract it:

```bash
uv run python 06_case_profile/case_profile.py \
  --input 06_case_profile/input/sample_profile_update.txt \
  --output 06_case_profile/output/case_facts.json \
  --patient-id demo_patient_001
```

When the patient shares more later, merge it into the existing profile:

```bash
uv run python 06_case_profile/case_profile.py \
  --input 06_case_profile/input/sample_update_2.txt \
  --existing 06_case_profile/output/case_facts.json \
  --output 06_case_profile/output/case_facts.json \
  --patient-id demo_patient_001
```

Output example: FIR number, sections, case type, hearing events (past and upcoming), threats, and a running status summary.

### 2. Start a live voice session (05)

```bash
uv run python 05_voice_chat/voice_chat.py --patient-id demo_patient_001
```

- Press **Enter** to start speaking, press **Enter** again to stop.
- The bot replies using what it knows about the case (for example, it can ask about the car that has been following the patient without being told).
- Type **`report`** to end the session.

At the end you get a folder `05_voice_chat/output/session_<timestamp>/` with:
- `report.json`: per-turn distress score, clinician summary, closing message
- `mental_state.png`: distress over time

The case profile is also updated with anything new mentioned in the session.

### 3. Run the offline pipeline on a recording (01 → 04)

Put a recording at `01_speech_to_text/input/test.wav`, then run the modules in order, copying each module's output into the next one's `input/` folder:

```bash
uv run python 01_speech_to_text/whisper.py
uv run python 02_acoustic_metrics/acoustic_metric.py
uv run python 03_adding_emotions/emotion.py
uv run python 04_chat_llm/chat_llm.py
```

## Privacy and safety

- Everything runs locally. No audio, transcript or case data is sent to an external service.
- Raw audio is deleted after each turn; only text, extracted features and reports are kept.
- The assistant is decision support, not a therapist or diagnostic tool. It does not diagnose, and its reports are phrased as signals for a counsellor to explore.

## Known limitations

- **Speech recognition can mishear** in noisy rooms. We force English and filter low-confidence segments to reduce Whisper hallucinations, but a quiet room still matters.
- **Vague dates are not merged.** "Sometime in May" and a later "20/05/2026" can end up as two hearing entries.
- **A 7B local model** is sometimes generic in replies and can phrase the same fact differently across sessions.
- **No login yet.** Patients are identified by `--patient-id` on the command line.
- Dashboards, district/state-level views and multilingual support are future work.

## Project structure

```
chatbot/
├── 01_speech_to_text/     # Whisper transcription
├── 02_acoustic_metrics/   # pitch, energy, pauses, arousal
├── 03_adding_emotions/    # speech-emotion scores
├── 04_chat_llm/           # distress scoring, report, graph
├── 05_voice_chat/         # live voice conversation
└── 06_case_profile/       # case memory extraction and merge
```

## Team

**Works on arch BTW**: team lead Jagrav Singh.
