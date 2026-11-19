import json
import os
import sys
import subprocess
import tempfile

import numpy as np
import librosa
import torch
from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2ForSequenceClassification


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "output", "transcript_with_emotions.json")

MODEL_ID = "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"
TARGET_SR = 16000
SILENCE_RMS_THRESHOLD = 1e-4
MIN_AUDIO_SECONDS = 0.25  # Demo quality cutoff, not a model accuracy guarantee.


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
                    "-ar", str(TARGET_SR),
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
            sr=TARGET_SR,
            mono=True,
        )

    return y, sr


def load_model():
    feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(MODEL_ID)
    model = Wav2Vec2ForSequenceClassification.from_pretrained(MODEL_ID)
    model.eval()
    return feature_extractor, model


def emotion_audio_status(audio_chunk, sr):
    """Check the waveform itself, including when demo inputs lack stage 02 flags."""
    if len(audio_chunk) == 0:
        return "too_short"
    rms = float(np.sqrt(np.mean(np.square(audio_chunk))))
    if rms <= SILENCE_RMS_THRESHOLD:
        return "silent"
    if len(audio_chunk) < int(MIN_AUDIO_SECONDS * sr):
        return "too_short"
    return "ok"


def predict_emotion(feature_extractor, model, audio_chunk, sr):
    """Run SER model on a raw audio array, return {label: prob} dict."""

    if emotion_audio_status(audio_chunk, sr) != "ok":
        return {}

    inputs = feature_extractor(
        audio_chunk,
        sampling_rate=sr,
        return_tensors="pt",
        padding=True,
    )

    with torch.no_grad():
        logits = model(**inputs).logits
        probs = torch.softmax(logits, dim=-1)[0]

    id2label = model.config.id2label

    return {
        id2label[i]: round(float(p), 4)
        for i, p in enumerate(probs)
    }


def main(audio_path, transcript_path):

    print("Loading audio...")
    y, sr = load_audio(audio_path)

    with open(transcript_path, "r") as f:
        segments = json.load(f)

    if not isinstance(segments, list):
        raise ValueError("Transcript must be a JSON list of segments")

    # Read all segment inputs and check audio usability before loading a model.
    # Timestamp boundary validation is left to stage 02.
    segment_audio = []
    for i, seg in enumerate(segments):
        try:
            if not isinstance(seg, dict):
                raise ValueError("Segment must be an object")
            start_sample = int(seg["start"] * sr)
            end_sample = int(seg["end"] * sr)
        except (KeyError, TypeError, ValueError, OverflowError) as e:
            raise ValueError(f"Cannot read segment {i + 1}: {e}") from e
        chunk = y[start_sample:end_sample]
        segment_audio.append((chunk, emotion_audio_status(chunk, sr)))

    feature_extractor, model = None, None

    for i, seg in enumerate(segments):

        chunk, status = segment_audio[i]
        emotion_probs = {}
        if status == "ok":
            if model is None:
                print("Loading speech-emotion model on CPU...")
                feature_extractor, model = load_model()
            emotion_probs = predict_emotion(feature_extractor, model, chunk, sr)

        seg["speech_emotion_status"] = status
        seg["speech_emotion"] = emotion_probs
        seg["speech_emotion_label"] = (
            max(emotion_probs, key=emotion_probs.get)
            if emotion_probs
            else None
        )

        print(
            f"[{i + 1}/{len(segments)}] "
            f"{seg['start']}-{seg['end']}s -> "
            f"{seg['speech_emotion_label']} (status: {status})"
        )

    os.makedirs(
        os.path.dirname(OUTPUT_PATH),
        exist_ok=True,
    )

    with open(OUTPUT_PATH, "w") as f:
        json.dump(
            segments,
            f,
            indent=4,
            ensure_ascii=False,
        )

    print(
        f"Wrote {len(segments)} segments "
        f"with speech emotion to {OUTPUT_PATH}"
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
            "transcript_with_acoustic_metric.json",
        )
    )

    main(
        audio_path,
        transcript_path,
    )
