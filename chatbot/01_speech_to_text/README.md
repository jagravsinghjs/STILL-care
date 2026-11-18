# Speech-to-text demonstration

This stage uses faster-whisper's `medium` model to transcribe a sample
recording with timestamps. Whisper detects the spoken language automatically.

## Run

From the repository root, with Python and `uv` installed:

```bash
uv venv  # only if you do not already have a virtual environment
uv pip install faster-whisper
uv run python chatbot/01_speech_to_text/whisper.py
```

Place your demonstration recording at `input/test.wav` in this folder.
The first run needs internet access to download the model unless it is
already cached.

The script selects NVIDIA CUDA with `float16` when CUDA is detected;
otherwise it uses CPU with `int8`. If GPU model initialization raises a
runtime error, it retries on CPU. CPU transcription can take longer.

## Outputs

- `output/transcript.txt`: readable text with segment timestamps.
- `output/transcript.json`: a list of segments containing `start`, `end`
  (seconds), and `text`, ready for the acoustic-analysis demonstration.

Each run replaces these demo outputs. Both formats are intentional.
To try stage `02_acoustic_metrics`, copy the JSON into that stage's
`input/transcript.json` and use the same recording as its `input/test.wav`.
