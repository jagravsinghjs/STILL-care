"""
scripts/seed_demo_data.py

Populates data/still.db with a small, realistic-looking demo dataset:
several patients on different trajectories, so scripts/run_pipeline_demo.py
has something worth running through Modules 11-17 and the frontend has
something worth looking at.

Deliberately does NOT run the pipeline itself -- it only inserts turns and
ends sessions (via pipeline.ingest.ingest_turn + db.repository.end_session),
mirroring pipeline/ingest.py's own contract that "ingest" and "run the
chain" are two separate steps. Run scripts/run_pipeline_demo.py after this
to actually process what's seeded here -- that separation is what lets you
re-run the pipeline over the same seeded history repeatedly without
reseeding.

Turn-score dial: reuses the exact (arousal_label, pause_ratio, emotion_mass)
lookup table from tests/test_module1.py's _TARGET_CONFIG, which hand-solves
still_core.TurnScorer's default formula
(score = 0.4*arousal_base + 0.2*pause*100 + 0.4*clamp(mass*100)) for each
target score in steps of 10. Reusing it here (rather than inventing new
combos) means every session's mean_score below is exactly the number
written in SESSIONS, not an approximation -- verified against a real build
of still_core before this file was handed over.

Idempotency: NOT idempotent -- session_ids are fixed strings, so re-running
this against an existing data/still.db will hit turns.turn_id's UNIQUE
constraint on the second run (same failure mode bridge/chatbot_adapter.py's
docstring already flags, for the same reason). Delete data/still.db (or
point STILL_DB_PATH elsewhere) before re-seeding.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from db.connection import get_conn, init_schema
from db.repository import end_session
from pipeline.ingest import ingest_turn
from schemas.schemas import ArousalFeatures, ArousalLabel, EmotionScores, TurnRecord

# ---------------------------------------------------------------------------
# Turn-score dial -- copied verbatim from tests/test_module1.py's
# _TARGET_CONFIG so these numbers are known-correct against still_core's
# actual formula, not re-derived by hand here.
# ---------------------------------------------------------------------------
_TARGET_CONFIG: dict[int, tuple[ArousalLabel, float, float]] = {
    10: (ArousalLabel.LOW, 0.5, 0.00),
    20: (ArousalLabel.LOW, 0.5, 0.25),
    30: (ArousalLabel.LOW, 0.5, 0.50),
    40: (ArousalLabel.LOW, 0.5, 0.75),
    50: (ArousalLabel.LOW, 0.5, 1.00),
    60: (ArousalLabel.MODERATE, 0.5, 0.75),
    70: (ArousalLabel.MODERATE, 0.5, 1.00),
    80: (ArousalLabel.HIGH, 0.5, 0.75),
    90: (ArousalLabel.HIGH, 0.5, 1.00),
}


def _turn(turn_id: str, session_id: str, patient_id: str, ts: datetime,
          target_score: int, transcript: str) -> TurnRecord:
    label, pause, mass = _TARGET_CONFIG[target_score]
    remaining = mass
    vals: list[float] = []
    for _ in range(4):
        v = min(1.0, remaining)
        vals.append(v)
        remaining -= v
    anger, disgust, fear, sadness = vals
    return TurnRecord(
        turn_id=turn_id, session_id=session_id, patient_id=patient_id, timestamp=ts,
        transcript=transcript,
        arousal=ArousalFeatures(
            pitch_mean=180.0, pitch_std=25.0, energy=0.5, zero_crossing_rate=0.05,
            pause_ratio=pause, arousal_label=label,
        ),
        emotion=EmotionScores(anger=anger, disgust=disgust, fear=fear, joy=0.0,
                               neutral=0.0, sadness=sadness, surprise=0.0),
    )


def _seed_session(conn, session_id: str, patient_id: str, start: datetime,
                   turn_scores: list[int], transcripts: list[str]) -> None:
    ts = start
    for i, (score, text) in enumerate(zip(turn_scores, transcripts)):
        turn = _turn(f"{session_id}-t{i:02d}", session_id, patient_id, ts, score, text)
        ingest_turn(turn, conn=conn)
        ts += timedelta(minutes=2)
    end_session(session_id, ts, len(turn_scores), conn=conn)


# ---------------------------------------------------------------------------
# Demo patients -- several, mixed trajectories.
# ---------------------------------------------------------------------------
_BASE = datetime(2026, 8, 1, 9, 0, 0)


def seed(conn) -> None:
    # demo-priya: stable/improving, should stay GREEN throughout.
    for i, (day_offset, scores) in enumerate([
        (0, [30, 20, 20]),
        (4, [20, 20, 10]),
        (8, [10, 10, 10]),
        (12, [10, 10, 10]),
    ]):
        _seed_session(
            conn, f"priya-s{i + 1}", "demo-priya", _BASE + timedelta(days=day_offset),
            scores,
            ["Session went okay, feeling a bit steadier than last week."] * len(scores),
        )

    # demo-arjun: worsening across sessions -- should build an escalation
    # streak (3 consecutive worse-than-current-tier readings).
    for i, (day_offset, scores) in enumerate([
        (0, [20, 30, 30]),
        (3, [50, 60, 50]),
        (6, [60, 70, 60]),
        (9, [70, 80, 70]),
    ]):
        _seed_session(
            conn, f"arjun-s{i + 1}", "demo-arjun", _BASE + timedelta(days=day_offset),
            scores,
            ["Sleep's been bad again, hard to shake the tension today."] * len(scores),
        )

    # demo-kabir: single session, one turn trips the acute-keyword override
    # -- should force RED immediately regardless of streak state.
    _seed_session(
        conn, "kabir-s1", "demo-kabir", _BASE,
        [40, 90, 50],
        [
            "Today's actually been a fairly ordinary day.",
            "Sometimes I just want to end it all and I don't know who to tell.",
            "Sorry -- I'm okay, just tired.",
        ],
    )

    # demo-meera: single session only -- DistressTrend has no prior point
    # to compare against (insufficient_data).
    _seed_session(
        conn, "meera-s1", "demo-meera", _BASE,
        [40, 50, 40],
        ["First check-in, still getting used to talking about this."] * 3,
    )


def main() -> None:
    init_schema()
    with get_conn() as conn:
        seed(conn)
    print("Seeded data/still.db with demo-priya, demo-arjun, demo-kabir, demo-meera.")
    print("Run scripts/run_pipeline_demo.py next to process these sessions through Modules 11-17.")


if __name__ == "__main__":
    main()