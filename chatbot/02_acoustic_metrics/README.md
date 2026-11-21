# Acoustic metrics demonstration

Measures how each timestamped segment sounds: pitch, energy, zero-crossing
rate, spectral centroid, and pause ratio. It adds a simple arousal label;
this stage does not predict emotions or diagnose distress. It runs on CPU.

## Setup and run

From the repository root, using the project's Python environment:

```bash
uv pip install numpy librosa
```

Install FFmpeg as a system dependency. On EndeavourOS/Arch:

```bash
sudo pacman -S ffmpeg
```

Copy stage 01's `output/transcript.json` to this folder's
`input/transcript.json`. Put the **same recording** at `input/test.wav`.
Then run from the repository root:

```bash
uv run python chatbot/02_acoustic_metrics/acoustic_metric.py
```

Output: `output/transcript_with_acoustic_metric.json`. Each run replaces
this demonstration output. Original text and segment timestamps are kept,
with `acoustic_features` and `arousal_label` added. Audio is decoded to
mono at 16 kHz through a temporary WAV that is automatically removed.

## Pitch and unusable audio

- Pitch is estimated within 65–600 Hz. Only voiced frames with probability
  at least 0.5 are used. This range is a demo setting and may exclude some
  voices; it is not a guarantee of accurate pitch for every speaker.
- `pitch_available: true` means at least two reliable pitch frames were
  available. Otherwise it is `false`, and arousal is `unknown`.
- Pitch fields remain numeric for compatibility with the monitoring adapter.
  When `pitch_available` is false, their zero values are **placeholders**,
  not measured pitch or evidence of a calm voice. Consumers must check the flag.
- `audio_status` is `silent`, `too_short`, or `ok`. Silence means overall
  RMS is at most `0.0001` (−80 dBFS). This fixed demo threshold may need
  adjustment for different microphones and does not identify background noise.
- Segments shorter than 2048 samples (128 ms at 16 kHz) are too short for
  this estimator. Silent/short segments skip pitch analysis and receive
  `unknown` arousal. Their energy mean is overall RMS; other numeric
  features are placeholders, except silence's pause ratio is set to 1.
- `ok` means the segment passed the duration/energy checks, not that it
  necessarily contains speech. Missing reliable pitch still returns `unknown`.

## Timestamp checks and arousal rules

Timestamps must be finite numbers satisfying `0 <= start < end` and must
fall within the recording. An end timestamp that exceeds the recording by
at most 5 ms plus one sample is clipped, to allow stage 01's rounding.
Invalid boundaries stop processing with the segment number before writing
the output; they do not silently select another part of the recording.

For usable segments with available pitch, the demo adds one point for pitch
standard deviation above 40 Hz and one for energy standard deviation above
0.02, then subtracts one for pause ratio above 0.3. Scores of 2 indicate
`high_arousal`, scores of −1 indicate `low_arousal`, and the remainder are
`neutral`. These are heuristic rules, not validated clinical measurements.

The 03/04 demo stages can carry these extra availability/status fields.
The separate monitoring adapter currently consumes the numeric fields and
maps `unknown` arousal to its default bucket; it does not yet preserve these
quality flags in its own schema.
