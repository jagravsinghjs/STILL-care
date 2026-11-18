from pathlib import Path
from faster_whisper import WhisperModel
import ctranslate2
import time

# ------------------------------------------------------------------
# Paths
# ------------------------------------------------------------------

BASE_DIR = Path(__file__).parent
AUDIO_PATH = BASE_DIR / "input" / "test.wav"
OUTPUT_PATH = BASE_DIR / "output" / "transcript.txt"

# ------------------------------------------------------------------
# Load Model
# ------------------------------------------------------------------

print("Loading Whisper model...")

start = time.time()

device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
compute_type = "float16" if device == "cuda" else "int8"
print(f"Using {device} with {compute_type} computation.")

try:
    model = WhisperModel("medium", device=device, compute_type=compute_type)
except RuntimeError:
    if device != "cuda":
        raise
    print("GPU model loading failed. Retrying on CPU with int8 computation.")
    model = WhisperModel("medium", device="cpu", compute_type="int8")

print(f"Model loaded in {time.time()-start:.2f} sec\n")

# ------------------------------------------------------------------
# Transcribe
# ------------------------------------------------------------------

segments, info = model.transcribe(
    str(AUDIO_PATH),
    beam_size=5
)

segments = list(segments)

print("=" * 60)
print(f"Language : {info.language}")
print(f"Confidence : {info.language_probability:.2f}")
print("=" * 60)

OUTPUT_PATH.parent.mkdir(exist_ok=True)

with open(OUTPUT_PATH, "w", encoding="utf-8") as f:

    for segment in segments:

        line = (
            f"[{segment.start:.2f}s - "
            f"{segment.end:.2f}s] "
            f"{segment.text.strip()}"
        )

        print(line)
        f.write(line + "\n")

print("\nTranscript saved to:")
print(OUTPUT_PATH)

import json

transcript = []

OUTPUT_PATH.parent.mkdir(exist_ok=True)

with open(OUTPUT_PATH, "w", encoding="utf-8") as f:

    for segment in segments:

        line = (
            f"[{segment.start:.2f}s - "
            f"{segment.end:.2f}s] "
            f"{segment.text.strip()}"
        )

        print(line)
        f.write(line + "\n")

        transcript.append({
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip()
        })

print("\nTranscript saved to:")
print(OUTPUT_PATH)

json_path = OUTPUT_PATH.parent / "transcript.json"

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(transcript, f, indent=4, ensure_ascii=False)

print(f"\nJSON saved to: {json_path}")
