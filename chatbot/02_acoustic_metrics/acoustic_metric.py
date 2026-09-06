import json
import os
import sys
import subprocess
import tempfile

import numpy as np
import librosa


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


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


def extract_segment_features(y, sr, start, end):
    seg = y[int(start * sr):int(end * sr)]

    if len(seg) == 0:
        return {}

    # Pitch (F0)
    f0, voiced_flag, voiced_probs = librosa.pyin(
        seg,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr,
    )

    f0_voiced = f0[~np.isnan(f0)]

    pitch_mean = (
        float(np.mean(f0_voiced))
        if len(f0_voiced)
        else 0.0
    )

    pitch_std = (
        float(np.std(f0_voiced))
        if len(f0_voiced)
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

    for seg in segments:

        feats = extract_segment_features(
            y,
            sr,
            seg["start"],
            seg["end"],
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
        f"with emotion features to {output_path}"
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