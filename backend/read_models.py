"""Privacy-scoped read models over the existing intelligence tables."""

from __future__ import annotations

import json
import sqlite3


def status_for(conn: sqlite3.Connection, patient_id: str) -> dict:
    row = conn.execute("SELECT tier, tier_since FROM risk_status WHERE patient_id = ?", (patient_id,)).fetchone()
    return {"tier": row["tier"], "assessed_at": row["tier_since"]} if row else {"tier": "not_assessed", "assessed_at": None}


def trend_for(conn: sqlite3.Connection, patient_id: str) -> list[dict]:
    rows = conn.execute(
        """SELECT computed_at, trend_label, slope, confidence, window_sessions
           FROM distress_trend WHERE patient_id = ? ORDER BY computed_at ASC""", (patient_id,)
    ).fetchall()
    return [dict(row) for row in rows]


def sessions_for(conn: sqlite3.Connection, patient_id: str) -> list[dict]:
    rows = conn.execute(
        """SELECT s.session_id, s.start_time, s.end_time, s.turn_count,
                  ss.mean_score, ss.max_score, ss.min_score, ss.volatility,
                  ss.within_session_trend, ss.computed_at
           FROM sessions s LEFT JOIN session_summary ss ON ss.session_id = s.session_id
           WHERE s.patient_id = ? ORDER BY s.start_time DESC""",
        (patient_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def patients_for_supervisor(conn: sqlite3.Connection, supervisor_id: str) -> list[dict]:
    rows = conn.execute(
        """SELECT a.user_id AS id, a.display_name AS name,
                  rs.tier AS tier,
                  (SELECT trend_label FROM distress_trend dt WHERE dt.patient_id = a.user_id ORDER BY computed_at DESC LIMIT 1) AS trend,
                  (SELECT computed_at FROM session_summary ss JOIN sessions s ON s.session_id = ss.session_id WHERE s.patient_id = a.user_id ORDER BY ss.computed_at DESC LIMIT 1) AS latest_at
           FROM supervisor_patients sp JOIN accounts a ON a.user_id = sp.patient_id
           LEFT JOIN risk_status rs ON rs.patient_id = a.user_id
           WHERE sp.supervisor_id = ? ORDER BY a.display_name""",
        (supervisor_id,),
    ).fetchall()
    return [
        {"id": row["id"], "name": row["name"], "initials": "".join(part[0] for part in row["name"].split()[:2]),
         "context": "Assigned patient", "supervisor_id": supervisor_id,
         "attention_state": row["tier"].upper() if row["tier"] else None,
         "trend": {"improving": "IMPROVING", "worsening": "WORSENING"}.get(row["trend"], "NO_CLEAR_CHANGE"),
         "summary": "Latest processed session: " + row["latest_at"] if row["latest_at"] else "No processed sessions yet"}
        for row in rows
    ]


def summaries_for(conn: sqlite3.Connection, patient_id: str) -> list[dict]:
    return [
        {"id": row["session_id"], "patient_id": patient_id, "mode": "voice", "created_at": row["computed_at"] or row["start_time"],
         "summary": f"{row['turn_count']} processed turn(s)", "attention_state": "GREEN", "trend": "NO_CLEAR_CHANGE", "themes": [], "processing_mode": "integrated"}
        for row in sessions_for(conn, patient_id) if row["computed_at"]
    ]


def _session_summary(conn: sqlite3.Connection, patient_id: str, session_id: str) -> dict | None:
    row = conn.execute(
        """SELECT s.session_id, s.start_time, s.end_time, s.turn_count,
                  ss.mean_score, ss.max_score, ss.min_score, ss.volatility,
                  ss.within_session_trend, ss.computed_at
           FROM sessions s JOIN session_summary ss ON ss.session_id = s.session_id
           WHERE s.patient_id = ? AND s.session_id = ?""", (patient_id, session_id)
    ).fetchone()
    return dict(row) if row else None


def report_for_patient(conn: sqlite3.Connection, patient_id: str, session_id: str) -> dict | None:
    summary = _session_summary(conn, patient_id, session_id)
    if summary is None:
        return None
    # A patient may retrieve their own words; this field is never used by a
    # supervisor endpoint.
    turns = conn.execute(
        "SELECT turn_id, timestamp, transcript, turn_score FROM turns WHERE session_id = ? ORDER BY timestamp", (session_id,)
    ).fetchall()
    summary["reflection"] = [dict(row) for row in turns]
    summary["status"] = status_for(conn, patient_id)
    return summary


def report_for_supervisor(conn: sqlite3.Connection, patient_id: str, session_id: str) -> dict | None:
    summary = _session_summary(conn, patient_id, session_id)
    if summary is None:
        return None
    # No transcript is selected here: the supervisor report intentionally
    # exposes only the previously computed metrics and explanation.
    explanation = conn.execute(
        "SELECT generated_at, factors_json FROM risk_explanation WHERE patient_id = ? AND session_id = ?", (patient_id, session_id)
    ).fetchone()
    summary["risk_explanation"] = (
        {"generated_at": explanation["generated_at"], "factors": json.loads(explanation["factors_json"])}
        if explanation else None
    )
    summary["status"] = status_for(conn, patient_id)
    latest_trend = trend_for(conn, patient_id)
    summary["latest_trend"] = latest_trend[-1] if latest_trend else None
    return summary
