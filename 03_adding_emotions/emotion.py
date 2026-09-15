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

MODEL_ID = "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"
TARGET_SR = 16000


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


def predict_emotion(feature_extractor, model, audio_chunk, sr):
    """Run SER model on a raw audio array, return {label: prob} dict."""

    if len(audio_chunk) == 0:
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


def main(audio_path, transcript_path, output_path):

    print("Loading audio...")
    y, sr = load_audio(audio_path)

    print("Loading model...")
    feature_extractor, model = load_model()

    with open(transcript_path, "r") as f:
        segments = json.load(f)

    for i, seg in enumerate(segments):

        start_sample = int(seg["start"] * sr)
        end_sample = int(seg["end"] * sr)
        chunk = y[start_sample:end_sample]

        emotion_probs = predict_emotion(
            feature_extractor,
            model,
            chunk,
            sr,
        )

        seg["speech_emotion"] = emotion_probs
        seg["speech_emotion_label"] = (
            max(emotion_probs, key=emotion_probs.get)
            if emotion_probs
            else None
        )

        print(
            f"[{i + 1}/{len(segments)}] "
            f"{seg['start']}-{seg['end']}s -> "
            f"{seg['speech_emotion_label']}"
        )

    os.makedirs(
        os.path.dirname(output_path),
        exist_ok=True,
    )

    with open(output_path, "w") as f:
        json.dump(
            segments,
            f,
            indent=4,
            ensure_ascii=False,
        )

    print(
        f"Wrote {len(segments)} segments "
        f"with speech emotion to {output_path}"
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

    output_path = (
        sys.argv[3]
        if len(sys.argv) > 3
        else os.path.join(
            SCRIPT_DIR,
            "output",
            "transcript_with_emotions.json",
        )
    )

    main(
        audio_path,
        transcript_path,
        output_path,
    )