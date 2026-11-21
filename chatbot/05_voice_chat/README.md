# Live voice-chat demonstration

Interactive terminal check-ins: microphone → Whisper → acoustic features +
text-emotion scores → local Ollama reply. Stage 05 has its own live workflow;
it does not execute the demonstration scripts in stages 01–04.

## Setup

From the repository root, in the project's Python environment:

```bash
uv pip install faster-whisper numpy librosa torch transformers sounddevice soundfile matplotlib requests spacy ollama
```

On EndeavourOS/Arch, install the audio dependencies and build tools:

```bash
sudo pacman -S ffmpeg portaudio base-devel cmake
```

Install the intelligence layer, which builds its C++ extension. Its detailed
requirements are in [INTEGRATION.md](../../intelligence_model/INTEGRATION.md).
Then configure one absolute database path for every STILL-care process:

```bash
uv pip install -e ./intelligence_model
export STILL_DB_PATH="$PWD/data/still.db"
uv run python -c 'from db.connection import init_schema; init_schema()'
```

Ollama must be serving locally at `http://localhost:11434`, with the model
downloaded:

```bash
ollama pull qwen2.5:7b-instruct
```

Run `ollama serve` in another terminal if it is not already running as a
service. First use of the Whisper and text-emotion models also downloads
their weights unless cached.

## Case memory and starting a session

To demonstrate memory, first create/register a profile through stage 06:

```bash
uv run python chatbot/06_case_profile/case_profile.py \
  --input chatbot/06_case_profile/input/sample_profile_update.txt \
  --output chatbot/06_case_profile/output/case_facts_demo_patient_001.json \
  --patient-id demo_patient_001

uv run python chatbot/05_voice_chat/voice_chat.py --patient-id demo_patient_001
```

- Press Enter to start recording; press Enter again to stop.
- The recognized text and assistant reply appear in the terminal. Replies
  are printed; text-to-speech is not implemented.
- Type `report` before recording or after a reply to finish. `quit` and
  `exit` also finish; Ctrl+C/EOF preserves completed turns and ends the session.
- If recording or processing fails, completed turns still proceed to finalization.
- A failed conversational reply ends the session with the analyzed turn preserved.

For detailed or painful disclosures, the conversation prompt asks for roughly
four sentences: specific acknowledgment, grounded emotional support, and at
most one relevant follow-up. Brief greetings can receive shorter replies.
Repeated generic coping questions are discouraged. Disclosures of physical
harm prioritize acknowledgment and an immediate-safety check. Reply length
and tone remain model-dependent; start a new session to use a revised prompt.
The closing-message prompt also addresses the user directly rather than
writing as if the assistant were the patient.

If no profile is registered, conversation and reports still work, but case
memory is not automatically created. Use the same `STILL_DB_PATH` and patient
ID for profile creation and chat. An unreadable profile is skipped with a warning.

## CPU and input quality

Whisper uses CPU with `int8`. The text-emotion model uses CUDA when available,
otherwise CPU; failed GPU initialization retries on CPU. Ollama manages its own
CPU/GPU selection. CPU inference can take longer.

Recordings with RMS at most `0.0001` (−80 dBFS), or non-silent recordings shorter
than 250 ms, are rejected before Whisper. These demo cutoffs do not detect all
background noise. Recognition is English-only and low-confidence Whisper
segments are filtered.

Acoustic pitch uses a 65–600 Hz range and voiced probability of at least 0.5.
At least two reliable frames are required. Missing pitch sets
`pitch_available: false`, with numeric placeholders for database compatibility,
and local arousal becomes `unknown`. Quality flags reach both Ollama prompts.

Unlike stage 03's audio-emotion model, this stage uses the English text model
`j-hartmann/emotion-english-distilroberta-base`. Text emotion is marked
`uncertain` when its highest probability is below 0.5 or its lead over the
runner-up is below 0.1. The prompts ask the model not to treat this as a definite
emotion. These are prototype heuristics, not validated confidence or diagnoses.

## Saved results and failure handling

Each session uses `output/session_<timestamp>/` with microseconds in the name:

- `turns.json`: checkpoint of patient/session IDs, text, analysis, stable turn
  IDs, ingestion status, and replies or reply errors. Updated before requesting
  a reply and again afterward. It contains the session's transcript.
- `report.json`: local per-turn distress estimates, clinician summary, and
  closing patient message, when report generation succeeds.
- `mental_state.png`: local distress estimates over elapsed session time.

Raw audio is temporarily written under a unique `tmp/session_*/` directory.
Each turn's WAV is deleted after processing using `finally`; the directory is
cleaned up on normal completion and handled exceptions, including Ctrl+C.

Finalization independently attempts the checkpoint, registered case-memory
update, intelligence monitoring, and local report. One failure does not prevent
later stages from being attempted. Case JSON is replaced only after successful
serialization/writing. A final status message identifies completed/failed stages.

Monitoring receives the count of successfully stored turns; missing turns are
reported and remain in the local checkpoint. If none were stored, monitoring
finalization is skipped. There is no automatic ingestion retry/resume yet.
The existing monitoring schema does not preserve audio/emotion quality flags;
`unknown` arousal still maps to its default moderate bucket.

The report and graph are generated in a temporary directory before publication.
A graph-generation error preserves existing outputs; a failed graph replacement
rolls back the report. Plot resources are closed even on saving errors.

The local report is separate from the intelligence layer's cross-session
trends/risk/alerts. Full report validation, long-conversation handling, shared
registry consolidation, and multilingual support remain deferred.

Successful local narrative reports are also stored in the shared SQLite DB
when at least one turn was ingested. Finalization reports this separately as
`report_database`; failure leaves the local files intact. Stage 05 initializes
the shared schema at startup, preserving existing data. Quality flags and
text-emotion source/status now survive ingestion in the existing JSON columns.
They are exposed for inspection; the numeric core's weights are unchanged.

The intelligence API's `GET /reports/{session_id}/combined` returns the
clinician narrative, 0–10 LLM timeline, separate 0–100 monitoring analysis,
session risk/explanation, current patient status/trend, and analysis quality.
It does not return the raw transcript or patient closing message. The API
still expects the enclosing backend to authenticate supervisor identities;
no login or frontend integration is added by these changes.

## Optional three-friend case circle

Create a group and accept invitations through
[stage 07](../07_group_coordination/README.md). Existing `--patient-id` sessions
automatically show invitations, use the patient's accepted single-case circle,
and poll its pending safety notices before each recording.

After a reply, Qwen may identify a new firsthand safety incident. The patient
must confirm the incident is their own, belongs to this case, and may be shared.
Other accepted members receive a generic inbox notice; the supervisor receives
the confirmed summary/evidence. This adds an extra model request for grouped
turns and can increase latency. No group means no incident-extraction request.

Received notices are separate application context and saved in
`group_notices.json`, outside the text used for personal memory extraction.
Outgoing incident IDs and the selected case/group IDs appear in `turns.json`.
Private reports and other members' transcripts are not shared. Group failures
are logged without blocking personal chat. There is no offline-device push;
members see notices when opening a session/checking the CLI inbox.
Patients see only the latest notice per case/category; already-delivered
notices are kept as agent context without another announcement. Full history
is available through stage 07's `inbox --history` command.

## Offline regression checks

```bash
uv run python -m unittest discover -s chatbot/05_voice_chat/tests -v
```

Tests use synthetic recordings and mocked model/pipeline calls. They do not
open the microphone, download weights, call Ollama, or write to the real database.
