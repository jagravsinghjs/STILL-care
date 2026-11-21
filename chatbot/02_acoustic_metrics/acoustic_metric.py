import json
import os
import sys
import subprocess
import tempfile
from numbers import Real

import numpy as np
import librosa


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PITCH_MIN_HZ = 65.0
PITCH_MAX_HZ = 600.0
MIN_VOICED_PROBABILITY = 0.5
PITCH_FRAME_LENGTH = 2048
SILENCE_RMS_THRESHOLD = 1e-4  # -80 dBFS for normalized floating-point audio


def load_audio(path):
    """
    Decode audio using FFmpeg and return mono PCM audio at 16 kHz.

    Supports formats such as WAV, MP4/M4A, 3GP, etc.
    """

    if not os.path.isfile(path):
        raise FileNotFoundError(f"Audio file not found: {path}")

    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i", path,
                    "-vn",
                    "-ac", "1",
                    "-ar", "16000",
                    "-c:a", "pcm_s16le",
                    tmp.name,
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True,
            )

        except subprocess.CalledProcessError as e:
            raise RuntimeError(
                f"FFmpeg could not decode audio file: {path}\n"
                f"{e.stderr}"
            ) from e

        y, sr = librosa.load(
            tmp.name,
            sr=None,
            mono=True,
        )

    return y, sr


def validate_timestamps(start, end, duration, sr):
    """Validate seconds, allowing only the rounding error from stage 01."""
    for name, value in (("start", start), ("end", end)):
        if isinstance(value, bool) or not isinstance(value, Real) or not np.isfinite(value):
            raise ValueError(f"{name} must be a finite number of seconds, got {value!r}")

    if start < 0 or end <= start:
        raise ValueError(f"Expected 0 <= start < end, got start={start}, end={end}")

    # Stage 01 rounds to two decimals: at most half of 0.01 s of overshoot.
    tolerance = 0.005 + 1 / sr
    if start >= duration or end > duration + tolerance:
        raise ValueError(
            f"Segment {start}-{end}s exceeds audio duration {duration:.6f}s; "
            "check that the transcript and recording belong together"
        )

    end = min(end, duration)
    if int(end * sr) <= int(start * sr):
        raise ValueError(f"Segment {start}-{end}s contains no audio samples")
    return float(start), float(end)


def extract_segment_features(y, sr, start, end):
    start, end = validate_timestamps(start, end, len(y) / sr, sr)
    seg = y[int(start * sr):int(end * sr)]

    signal_rms = float(np.sqrt(np.mean(np.square(seg))))
    is_silent = signal_rms <= SILENCE_RMS_THRESHOLD
    is_too_short = len(seg) < PITCH_FRAME_LENGTH

    if is_silent or is_too_short:
        # Keep numeric fields compatible with the monitoring adapter. Status
        # and availability distinguish these placeholders from measurements.
        return {
            "pitch_mean_hz": 0.0,
            "pitch_std_hz": 0.0,
            "pitch_available": False,
            "audio_status": "silent" if is_silent else "too_short",
            "energy_mean": signal_rms,
            "energy_std": 0.0,
            "zero_crossing_rate": 0.0,
            "spectral_centroid": 0.0,
            "pause_ratio": 1.0 if is_silent else 0.0,
        }

    # Pitch (F0)
    f0, voiced_flag, voiced_probs = librosa.pyin(
        seg,
        fmin=PITCH_MIN_HZ,
        fmax=PITCH_MAX_HZ,
        sr=sr,
        frame_length=PITCH_FRAME_LENGTH,
    )

    # Exclude unvoiced/uncertain frames rather than letting pitch-tracking
    # errors inflate variability and trigger the high-arousal heuristic.
    reliable = np.isfinite(f0) & voiced_flag & (voiced_probs >= MIN_VOICED_PROBABILITY)
    f0_voiced = f0[reliable]
    pitch_available = len(f0_voiced) >= 2

    pitch_mean = (
        float(np.mean(f0_voiced))
        if pitch_available
        else 0.0
    )

    pitch_std = (
        float(np.std(f0_voiced))
        if pitch_available
        else 0.0
    )

    # Energy / loudness
    rms = librosa.feature.rms(y=seg)[0]

    energy_mean = float(np.mean(rms))
    energy_std = float(np.std(rms))

    # Zero crossing rate
    zcr = float(
        np.mean(
            librosa.feature.zero_crossing_rate(seg)[0]
        )
    )

    # Spectral centroid
    spec_cent = float(
        np.mean(
            librosa.feature.spectral_centroid(
                y=seg,
                sr=sr,
            )[0]
        )
    )

    # Pause ratio
    intervals = librosa.effects.split(
        seg,
        top_db=25,
    )

    voiced_duration = (
        sum((e - s) for s, e in intervals) / sr
    )

    total_duration = len(seg) / sr

    pause_ratio = (
        1 - (voiced_duration / total_duration)
        if total_duration > 0
        else 0.0
    )

    return {
        "pitch_mean_hz": round(pitch_mean, 2),
        "pitch_std_hz": round(pitch_std, 2),
        "pitch_available": pitch_available,
        "audio_status": "ok",
        "energy_mean": round(energy_mean, 4),
        "energy_std": round(energy_std, 4),
        "zero_crossing_rate": round(zcr, 4),
        "spectral_centroid": round(spec_cent, 2),
        "pause_ratio": round(pause_ratio, 3),
    }


def classify_arousal(features):
    """Simple heuristic scoring."""

    if not features:
        return "unknown"

    if features.get("audio_status", "ok") != "ok" or not features.get("pitch_available", True):
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

    else:
        return "neutral"


def main(audio_path, transcript_path, output_path):

    # Decode audio through FFmpeg
    y, sr = load_audio(audio_path)

    with open(transcript_path, "r") as f:
        segments = json.load(f)

    for index, seg in enumerate(segments):

        try:
            start, end = validate_timestamps(
                seg["start"], seg["end"], len(y) / sr, sr
            )
        except (KeyError, ValueError) as e:
            raise ValueError(f"Invalid timestamps in segment {index + 1}: {e}") from e

        # Save the actual boundary if rounding extended past the final sample.
        seg["start"], seg["end"] = start, end

        feats = extract_segment_features(
            y,
            sr,
            start,
            end,
        )

        seg["acoustic_features"] = feats
        seg["arousal_label"] = classify_arousal(feats)

    os.makedirs(
        os.path.dirname(output_path),
        exist_ok=True,
    )

    with open(output_path, "w") as f:
        json.dump(
            segments,
            f,
            indent=4,
        )

    print(
        f"Wrote {len(segments)} segments "
        f"with acoustic features to {output_path}"
    )


if __name__ == "__main__":

    audio_path = (
        sys.argv[1]
        if len(sys.argv) > 1
        else os.path.join(
            SCRIPT_DIR,
            "input",
            "test.wav",
        )
    )

    transcript_path = (
        sys.argv[2]
        if len(sys.argv) > 2
        else os.path.join(
            SCRIPT_DIR,
            "input",
            "transcript.json",
        )
    )

    output_path = (
        sys.argv[3]
        if len(sys.argv) > 3
        else os.path.join(
            SCRIPT_DIR,
            "output",
            "transcript_with_acoustic_metric.json",
        )
    )

    main(
        audio_path,
        transcript_path,
        output_path,
    )
