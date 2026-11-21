# Local LLM report demonstration

Reads the enriched transcript from stage 03 and sends it to local Ollama
using `qwen2.5:7b-instruct`. Produces per-segment distress estimates, a
clinician-facing summary, a patient message, and a graph. These are
prototype decision-support outputs, not diagnoses or validated clinical scores.

## Setup and run

From the repository root, using the project's Python environment:

```bash
uv pip install requests matplotlib
```

Install Ollama, then download the model:

```bash
ollama pull qwen2.5:7b-instruct
```

Make sure Ollama is serving at `http://localhost:11434`. If it is not already
running as a service, start it in another terminal:

```bash
ollama serve
```

Copy stage 03's `output/transcript_with_emotions.json` to this folder's
`input/transcript_with_emotions.json`. Then run from the repository root:

```bash
uv run python chatbot/04_chat_llm/chat_llm.py
```

The Python script does not select a GPU; Ollama manages CPU/GPU inference.
CPU inference can be slower. Audio is not processed again in this stage.

## Workflow and output

1. Read the transcript, acoustic features, quality flags, and emotion probabilities.
2. Prepare emotion evidence and send the segments to Ollama.
3. Parse the JSON response and check its required top-level keys.
4. Apply the existing patient-message formatting and follow-up rule.
5. Prepare the JSON report and graph, then replace the demonstration outputs.

Outputs keep their existing names:

- `output/report.json`: `segments` with timestamps, distress scores and notes,
  plus `clinician_summary` and `patient_message`.
- `output/mental_state.png`: segment start time versus distress estimate (0–10).

Each successful run replaces these files. If graph generation fails, the old
files remain. If replacing the graph raises an operating-system error after
the new report was installed, the previous report is restored (or the new
report is removed on a first run). Temporary files are cleaned up, and plot
figures are closed even when saving fails.

## Missing audio and uncertain emotions

Stage 02's `pitch_available` and `audio_status` flags are passed through in
`acoustic_features`. The prompt tells Ollama to ignore missing pitch placeholders
and silent/too-short acoustic measurements. Missing evidence and `unknown`
arousal must not be interpreted as calmness.

Stage 03's emotion probabilities and `speech_emotion_status` are also passed
to the model. This stage marks an otherwise usable prediction `uncertain` if:

- its highest probability is below `0.5`; or
- its lead over the second-highest probability is below `0.1`.

For example, probabilities of `0.14` and `0.13` do not establish a clear emotion.
The categorical label is set to `null` in the prompt for uncertain predictions;
the probabilities remain visible. Missing probabilities produce `unverified`
status. `silent` and `too_short` statuses remain skipped with a `null` label.
These changes apply to the prompt, without modifying the input file.

The thresholds are prototype heuristics, not calibrated confidence measures.
The prompt asks Ollama to use words and available acoustic cues when emotion
evidence is uncertain. Following these instructions is still model-dependent.
Regenerate/copy the outputs from stages 02 and 03 to include their new flags;
older demonstration JSON does not contain all of them.

## Prototype limits

Full input/output validation, segment matching, additional Ollama error
handling, and long-transcript handling are deferred. Existing generation limits
and the follow-up rule are unchanged. A parse failure or missing required
top-level key saves the raw response to `output/_last_raw_response.txt` in
this stage for inspection. The demo artifacts currently checked into the repo
are not automatically regenerated when the code changes.
