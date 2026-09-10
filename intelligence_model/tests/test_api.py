"""
tests/test_api.py

Exercises every api/routes_*.py endpoint via FastAPI's TestClient --
in-process, no real server. Two dependencies get overridden for the
whole suite: get_db (swapped for a test-isolated tmp_path DB, same
pattern as every other test file) and get_current_supervisor (swapped
for a fixed fake identity, since this layer's whole point is that it
does no auth itself -- see test_auth_dependency_blocks_without_override
for the one test that deliberately does NOT override it).
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from api.deps import get_current_supervisor, get_db
from api.main import app
from db.connection import get_raw_connection, init_schema
from db.repository import get_pending_interventions, get_unacknowledged_alerts
from pipeline.ingest import end_session_and_run, ingest_turn
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
    """Used directly by _seed_acute_session -- runs in the main test
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
    print(list_resp.status_code, list_resp.text)  # TEMP -- run with pytest -s
    assert list_resp.status_code == 200
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
# auth -- the one test that deliberately does NOT override get_current_supervisor,
# to confirm the 401 stub actually fires as documented.
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