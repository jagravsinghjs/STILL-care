"""
tests/test_api.py

Exercises every api/routes_*.py endpoint via FastAPI's TestClient --
in-process, no real server. Two dependencies get overridden for the
whole suite: get_db (swapped for a test-isolated tmp_path DB, same
pattern as every other test file) and get_current_supervisor (swapped
for a fixed fake identity, since this layer's whole point is that it
does no auth itself -- see test_missing_supervisor_identity_returns_401
for the one test that deliberately does NOT override it).

Includes routes_supervisor_view.py's coverage directly in this file
rather than a separate tests/test_routes_supervisor_view.py -- this
docstring already claims "every api/routes_*.py endpoint", so a second
file for one router would just be an easy place for the two to drift.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from api.deps import get_current_supervisor, get_db
from api.main import app
from db.connection import get_raw_connection, init_schema
from db.repository import create_session, end_session, get_pending_interventions, get_unacknowledged_alerts
from pipeline.ingest import end_session_and_run, ingest_turn
from pipeline.orchestrator import run_pipeline
from schemas.schemas import ArousalFeatures, ArousalLabel, EmotionScores, TurnRecord

PATIENT_ID = "patient-001"
BASE_DAY = datetime(2026, 1, 1, 9, 0, 0)
FAKE_SUPERVISOR = "supervisor-test-001"


@pytest.fixture
def db_path(tmp_path):
    path = tmp_path / "test_still.db"
    init_schema(db_path=path)
    return path


@pytest.fixture
def conn(db_path):
    """Used directly by the _seed_* helpers -- runs in the main test
    thread, so no thread-safety issue here."""
    connection = get_raw_connection(db_path=db_path)
    yield connection
    connection.close()


@pytest.fixture
def client(db_path):
    """Overrides get_db to open a FRESH connection per request via the
    real get_conn() context manager -- mirrors exactly what production's
    api/deps.py::get_db() does, which is what avoids the cross-thread
    sqlite3 error that a single shared connection hits."""
    from db.connection import get_conn

    def override_get_db():
        with get_conn(db_path=db_path) as connection:
            yield connection

    def override_supervisor():
        return FAKE_SUPERVISOR

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_supervisor] = override_supervisor
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# scenario builders
# ---------------------------------------------------------------------------

def _seed_acute_session(conn, session_id: str = "s1") -> None:
    """Runs one acute-language session through the real pipeline, so a
    single seed call populates session_summary, distress_trend,
    escalation_risk, risk_explanation, risk_status (forced RED),
    alerts (an [ACUTE] one), and intervention_recommendation (MEDICAL +
    COUNSELLING + PROTECTION_RELOCATION) all at once -- exercising every
    route below against real, connected data rather than hand-inserted rows."""
    turn = TurnRecord(
        turn_id=f"{session_id}-t0", session_id=session_id, patient_id=PATIENT_ID,
        timestamp=BASE_DAY, transcript="I feel okay but sometimes I want to end it all.",
        arousal=ArousalFeatures(pitch_mean=0.0, pitch_std=0.0, energy=0.0,
                                 zero_crossing_rate=0.0, pause_ratio=0.5,
                                 arousal_label=ArousalLabel.HIGH),
        emotion=EmotionScores(anger=0.8, disgust=0, fear=0, joy=0, neutral=0, sadness=0, surprise=0),
    )
    ingest_turn(turn, conn=conn)
    conn.commit()
    end_session_and_run(session_id, BASE_DAY, 1, conn=conn)
    conn.commit()


def _seed_calm_session(conn, session_id: str, day_offset: int, pause_ratio: float) -> None:
    """A single non-acute, LOW-arousal turn, score driven entirely by
    pause_ratio (same trick tests/test_module2.py uses) -- used to build
    up patient-level trend scenarios across several sessions."""
    ts = BASE_DAY + timedelta(days=day_offset)
    turn = TurnRecord(
        turn_id=f"{session_id}-t0", session_id=session_id, patient_id=PATIENT_ID,
        timestamp=ts, transcript="placeholder",
        arousal=ArousalFeatures(pitch_mean=0.0, pitch_std=0.0, energy=0.0,
                                 zero_crossing_rate=0.0, pause_ratio=pause_ratio,
                                 arousal_label=ArousalLabel.LOW),
        emotion=EmotionScores(anger=0, disgust=0, fear=0, joy=0, neutral=0, sadness=0, surprise=0),
    )
    ingest_turn(turn, conn=conn)
    conn.commit()
    end_session_and_run(session_id, ts, 1, conn=conn)
    conn.commit()


def _seed_multi_turn_session(conn, session_id: str, pauses: list[float]) -> None:
    """Several turns inside ONE session, 30s apart, pause_ratio ramping
    up or down -- drives within_session_trend's sign directly,
    independent of the cross-session trend scenarios above."""
    for i, p in enumerate(pauses):
        ts = BASE_DAY + timedelta(seconds=i * 30)
        turn = TurnRecord(
            turn_id=f"{session_id}-t{i}", session_id=session_id, patient_id=PATIENT_ID,
            timestamp=ts, transcript=f"turn {i}",
            arousal=ArousalFeatures(pitch_mean=0.0, pitch_std=0.0, energy=0.0,
                                     zero_crossing_rate=0.0, pause_ratio=p,
                                     arousal_label=ArousalLabel.LOW),
            emotion=EmotionScores(anger=0, disgust=0, fear=0, joy=0, neutral=0, sadness=0, surprise=0),
        )
        ingest_turn(turn, conn=conn)
    conn.commit()
    end_session_and_run(session_id, BASE_DAY + timedelta(seconds=len(pauses) * 30), len(pauses), conn=conn)
    conn.commit()


def _seed_zero_turn_session(conn, session_id: str, day_offset: int) -> None:
    """Module 11's own documented zero-turn skip -- no session_summary
    row gets written. Can't go through ingest_turn/end_session_and_run
    at all (ingest_turn is the only thing that creates a session, and it
    always inserts a turn), so this drops to db.repository / run_pipeline
    directly -- same pattern tests/test_module1.py's
    test_zero_turns_skips_silently uses."""
    ts = BASE_DAY + timedelta(days=day_offset)
    create_session(session_id, PATIENT_ID, ts, conn=conn)
    end_session(session_id, ts, 0, conn=conn)
    conn.commit()
    run_pipeline(session_id, conn=conn)
    conn.commit()


# ---------------------------------------------------------------------------
# reports
# ---------------------------------------------------------------------------

def test_get_summary_404_when_session_unknown(client):
    resp = client.get("/reports/no-such-session/summary")
    assert resp.status_code == 404


def test_get_summary_returns_session_summary(client, conn):
    _seed_acute_session(conn)
    resp = client.get("/reports/s1/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"] == "s1"
    assert body["patient_id"] == PATIENT_ID
    assert len(body["timeline"]) == 1


def test_get_pdf_returns_valid_pdf_bytes(client, conn):
    _seed_acute_session(conn)
    resp = client.get("/reports/s1/pdf")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:5] == b"%PDF-"


# ---------------------------------------------------------------------------
# dashboard
# ---------------------------------------------------------------------------

def test_dashboard_status_404_for_unknown_patient(client):
    resp = client.get("/dashboard/no-such-patient/status")
    assert resp.status_code == 404


def test_dashboard_status_trend_and_history_after_seed(client, conn):
    _seed_acute_session(conn)

    status_resp = client.get(f"/dashboard/{PATIENT_ID}/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["tier"] == "red"

    trend_resp = client.get(f"/dashboard/{PATIENT_ID}/trend")
    assert trend_resp.status_code == 200

    history_resp = client.get(f"/dashboard/{PATIENT_ID}/history?limit=5")
    assert history_resp.status_code == 200
    assert len(history_resp.json()) == 1
    assert history_resp.json()[0]["session_id"] == "s1"


# ---------------------------------------------------------------------------
# alerts
# ---------------------------------------------------------------------------

def test_list_and_acknowledge_alert(client, conn):
    _seed_acute_session(conn)

    list_resp = client.get(f"/alerts?patient_id={PATIENT_ID}")
    assert list_resp.status_code == 200
    alerts = list_resp.json()
    assert len(alerts) == 1
    assert alerts[0]["reason"].startswith("[ACUTE]")
    alert_id = alerts[0]["alert_id"]

    ack_resp = client.patch(f"/alerts/{alert_id}/acknowledge")
    assert ack_resp.status_code == 204

    # Acknowledged -> no longer shows up as unacknowledged.
    remaining = get_unacknowledged_alerts(PATIENT_ID, conn=conn)
    assert remaining == []


# ---------------------------------------------------------------------------
# interventions
# ---------------------------------------------------------------------------

def test_list_and_decide_intervention(client, conn):
    _seed_acute_session(conn)

    list_resp = client.get(f"/interventions/{PATIENT_ID}")
    assert list_resp.status_code == 200
    pending = list_resp.json()
    assert len(pending) == 1
    assert "medical" in pending[0]["categories"]
    recommendation_id = pending[0]["recommendation_id"]

    decide_resp = client.patch(
        f"/interventions/{recommendation_id}/decision",
        json={"accepted": True},
    )
    assert decide_resp.status_code == 204

    # Decided -> no longer pending.
    still_pending = get_pending_interventions(PATIENT_ID, conn=conn)
    assert still_pending == []


# ---------------------------------------------------------------------------
# supervisor-view -- the redacted, frontend-shaped read path (green/yellow/red
# + a trend label + one plain-language sentence, no raw floats)
# ---------------------------------------------------------------------------

def test_supervisor_status_404_for_unknown_patient(client):
    resp = client.get("/supervisor-view/no-such-patient/status")
    assert resp.status_code == 404


def test_supervisor_status_after_single_acute_session(client, conn):
    """
    Verified against a real run first: one acute-language turn gives
    risk_level=red, and get_latest_distress_trend returns
    TrendLabel.INSUFFICIENT_DATA (only 1 session_summary row exists --
    trend_engine.py needs >=2). INSUFFICIENT_DATA is exactly the case
    PATIENT_TREND_LABEL_MAP's fallback collapse handles -- this test is
    documenting that collapse's current (deliberately conservative,
    explicitly-flagged-as-questionable) behavior, not endorsing it.
    """
    _seed_acute_session(conn)

    resp = client.get(f"/supervisor-view/{PATIENT_ID}/status")
    assert resp.status_code == 200
    body = resp.json()

    assert body["risk_level"] == "red"
    assert body["distress_trend"] == "worsening"  # collapsed from insufficient_data
    assert body["plain_language_reason"] is not None
    assert "acute" in body["plain_language_reason"].lower()
    assert "immediate high-risk flag" in body["plain_language_reason"].lower()


def test_supervisor_status_trend_passthrough_when_genuinely_worsening(client, conn):
    """
    Two non-acute sessions, mean_score rising sharply session-to-session
    (mirrors test_module2.py's test_worsening_trend_negative_slope
    scenario). Verified for real: this lands risk_level=green
    (RiskLevel.LOW candidate_tier) while distress_trend=worsening --
    tier and trend are independent axes on purpose (hysteresis smooths
    the tier; the trend label doesn't get smoothed the same way), and
    this is the genuine WORSENING case, not the collapsed
    insufficient_data one above -- both read "worsening" in the API but
    for different, worth-distinguishing reasons.
    """
    _seed_calm_session(conn, "s0", day_offset=0, pause_ratio=0.1)
    _seed_calm_session(conn, "s1", day_offset=1, pause_ratio=0.9)

    resp = client.get(f"/supervisor-view/{PATIENT_ID}/status")
    assert resp.status_code == 200
    body = resp.json()

    assert body["risk_level"] == "green"
    assert body["distress_trend"] == "worsening"


def test_supervisor_status_plain_language_reason_for_calm_session(client, conn):
    """Verified for real: a single calm, low-arousal, joyful-emotion turn
    gives risk_level=green and Module 14's top factor literally says the
    session's distress level was low -- checking for that substring
    rather than the full sentence to avoid pinning prose that isn't this
    file's to own."""
    _seed_calm_session(conn, "calm", day_offset=0, pause_ratio=0.1)

    resp = client.get(f"/supervisor-view/{PATIENT_ID}/status")
    body = resp.json()

    assert body["risk_level"] == "green"
    assert "distress level was low" in body["plain_language_reason"].lower()


def test_supervisor_sessions_view_empty_for_unknown_patient(client):
    """No 404 here (unlike /status) -- an unknown patient just has no
    recent sessions, which is a legitimately empty list, not an error."""
    resp = client.get("/supervisor-view/no-such-patient/sessions")
    assert resp.status_code == 200
    assert resp.json() == []


def test_supervisor_sessions_view_after_acute_session(client, conn):
    """
    Verified for real: EscalationRisk.risk_level is HIGH for this
    session (matches /status's tier for this specific scenario, but
    session-level risk_level and the patient's overall tier are NOT the
    same field). within_session_trend is exactly 0.0 for a single-turn
    session (first and last third are the same one turn), which the
    module's own sign rule (>0 => worsening) reads as "improving", not
    neutral -- that's the actual current behavior, called out here
    rather than papered over with a vaguer assertion.
    """
    _seed_acute_session(conn)

    resp = client.get(f"/supervisor-view/{PATIENT_ID}/sessions")
    assert resp.status_code == 200
    sessions = resp.json()

    assert len(sessions) == 1
    assert sessions[0]["session_id"] == "s1"
    assert sessions[0]["risk_level"] == "red"
    assert sessions[0]["distress_trend"] == "improving"
    assert "acute" in sessions[0]["plain_language_reason"].lower()


def test_supervisor_sessions_view_session_level_trend_worsening(client, conn):
    """Verified for real: pauses ramping 0.1->0.9 across 6 turns in ONE
    session gives within_session_trend=+4.0 -- genuinely worsening
    within-session, independent of any cross-session trend."""
    _seed_multi_turn_session(conn, "multi-up", pauses=[0.1, 0.1, 0.5, 0.5, 0.9, 0.9])

    resp = client.get(f"/supervisor-view/{PATIENT_ID}/sessions")
    sessions = resp.json()

    assert len(sessions) == 1
    assert sessions[0]["distress_trend"] == "worsening"


def test_supervisor_sessions_view_session_level_trend_improving(client, conn):
    """Mirror of the above: pauses ramping 0.9->0.1 gives
    within_session_trend=-4.0 -- verified for real."""
    _seed_multi_turn_session(conn, "multi-down", pauses=[0.9, 0.9, 0.5, 0.5, 0.1, 0.1])

    resp = client.get(f"/supervisor-view/{PATIENT_ID}/sessions")
    sessions = resp.json()

    assert len(sessions) == 1
    assert sessions[0]["distress_trend"] == "improving"


def test_supervisor_sessions_view_excludes_zero_turn_sessions(client, conn):
    """
    The actual point of this endpoint's `if summary_row is None: continue`
    branch: a zero-turn session has a `sessions` table row (so
    get_recent_sessions returns it) but no session_summary row (Module 11
    skipped it silently, per its own documented contract) -- this must
    not surface as a phantom entry with nulled-out fields.
    """
    _seed_zero_turn_session(conn, "empty", day_offset=0)
    _seed_calm_session(conn, "real", day_offset=1, pause_ratio=0.3)

    resp = client.get(f"/supervisor-view/{PATIENT_ID}/sessions")
    sessions = resp.json()

    assert len(sessions) == 1
    assert sessions[0]["session_id"] == "real"


def test_supervisor_sessions_view_tier_and_session_risk_level_can_diverge(client, conn):
    """
    The docstring on get_patient_sessions_view() claims session-level
    risk_level is intentionally NOT always equal to the patient's
    hysteresis-smoothed tier from /status. Real divergence needs a
    de-escalation-in-progress scenario (RED patient, several
    LOW/MODERATE-reading sessions in a row, tier hasn't stepped down yet
    per hysteresis.py's weighted de-escalation) which
    tests/test_module5.py's own suite already covers in detail --
    flagging this as a gap in THIS file rather than re-deriving that
    scenario here, so it isn't quietly assumed to be tested twice.
    """
    pytest.skip(
        "Divergence scenario needs a de-escalation-in-progress patient; "
        "not built here to avoid duplicating tests/test_module5.py's "
        "hysteresis coverage. See docstring for what's actually asserted "
        "by the rest of this file instead."
    )


# ---------------------------------------------------------------------------
# auth -- the one test that deliberately does NOT override get_current_supervisor,
# to confirm the 401 stub actually fires as documented, and that
# routes_supervisor_view.py uses the same dependency rather than a
# forgotten copy-paste that skips it.
# ---------------------------------------------------------------------------

def test_missing_supervisor_identity_returns_401(conn):
    def override_get_db():
        yield conn

    app.dependency_overrides[get_db] = override_get_db
    # get_current_supervisor deliberately NOT overridden here.
    with TestClient(app) as unauth_client:
        resp = unauth_client.get(f"/dashboard/{PATIENT_ID}/status")
    app.dependency_overrides.clear()

    assert resp.status_code == 401


def test_supervisor_view_also_requires_supervisor_identity(conn):
    def override_get_db():
        yield conn

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as unauth_client:
        resp = unauth_client.get(f"/supervisor-view/{PATIENT_ID}/status")
    app.dependency_overrides.clear()

    assert resp.status_code == 401