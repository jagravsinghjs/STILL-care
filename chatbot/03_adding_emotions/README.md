# Speech-emotion demonstration

Adds audio-based emotion predictions to the timestamped transcript from
stage 02. It uses `ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition`
on CPU; no GPU is required. CPU inference may take time.

## Setup and run

From the repository root, in the project's Python environment:

```bash
uv pip install numpy librosa torch transformers
```

FFmpeg must also be installed. On EndeavourOS/Arch:

```bash
sudo pacman -S ffmpeg
```

1. Copy stage 02's `output/transcript_with_acoustic_metric.json` into
   this folder's `input/` directory with the same filename.
2. Put the **same recording** at this folder's `input/test.wav`.
3. Run from the repository root:

```bash
uv run python chatbot/03_adding_emotions/emotion.py
```

The model downloads on first use unless cached, so internet is needed for
that download. It loads once and is reused for all eligible segments.
If all segments are skipped, the model is not loaded.

## Output

`output/transcript_with_emotions.json` preserves the transcript and acoustic
fields and adds:

- `speech_emotion`: model labels and softmax probabilities.
- `speech_emotion_label`: the highest-scoring label, or `null` when skipped.
- `speech_emotion_status`: `ok`, `silent`, or `too_short`.

Output is always saved inside this stage's `output/` folder with the filename
`transcript_with_emotions.json`; there is no custom output-path argument.
Runs replace this demonstration output. Copy it to stage 04's
`input/transcript_with_emotions.json` when continuing the offline demonstration.

## Silence, short clips, and model loading

Audio is decoded to mono at 16 kHz. A segment with RMS at most `0.0001`
(−80 dBFS) is marked `silent`. Other segments shorter than 250 ms are
marked `too_short`. Both skip inference and receive an empty probability
dictionary and a `null` label, rather than an invented emotion.

These are demo thresholds: quiet speech may be skipped, background noise
may pass, and 250 ms does not guarantee enough context for accurate emotion
recognition. The waveform is checked directly, even with older stage 02
inputs that do not contain audio-quality flags. Missing acoustic pitch by
itself does not prevent this separate model from running.

Audio and transcript inputs are read, and all segment slices and usability
statuses are prepared, before loading the model. Unreadable JSON, missing
segment fields, invalid timestamps, and non-finite audio samples therefore
fail before the model is loaded. Errors in a segment include its number.

Timestamps must be finite numbers with `0 <= start < end` and fall within
the recording. Negative, reversed, zero-length, nonnumeric, and out-of-range
boundaries are rejected. End overshoot of at most 5 ms plus one sample is
clipped to allow stage 01's rounding. Timestamp checks also apply here so
that manually copied demo inputs cannot silently select the wrong audio.

Inputs and output use UTF-8. Missing FFmpeg produces an installation hint.
Processing failures before output writing leave the previous demo output
untouched. There is no custom output-path argument; supplying extra command
arguments produces a usage message instead of silently ignoring them.

## Interpretation

This is an English speech-emotion model, separate from the text-emotion
model used in stage 05. Its probabilities are model outputs, not verified
confidence or a mental-health assessment. `ok` only means the segment passed
the duration/energy checks; the top label can still be wrong. Stage 02's
arousal label and this stage's emotion label measure different signals.

The monitoring adapter currently turns an empty emotion dictionary into
zero-valued emotion fields; it does not preserve `speech_emotion_status`
in its own schema yet.
