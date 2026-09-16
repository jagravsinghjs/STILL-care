"""
patient_registry.py -- [INTEGRATION]
======================================
Tiny shared helper so case_profile.py and voice_chat.py both read/write the
SAME patient -> case_facts.json mapping, instead of a human remembering
which output/case_facts_<name>.json file belongs to which patient_id.

This does NOT introduce a new database. It adds one table (`patients`) to
the same still.db that intelligence_model already owns and that voice_chat.py
already writes turns/sessions into via ingest_turn()/end_session_and_run().
See schema_patients_addition.sql for the table definition -- apply it once
via intelligence_model's own init_schema(), the same way still.db's other
tables were created.

Both chatbot scripts import this file directly (copy it into chatbot/, or
add chatbot/ to sys.path the same way voice_chat.py already does for
06_case_profile/). It uses sqlite3 directly rather than going through
intelligence_model's db/connection.py, so this file has ZERO import
dependency on intelligence_model being installed -- chatbot/ scripts should
still be able to record/register a patient even if, for whatever reason,
the intelligence_model package isn't importable in a given environment.
It reads the exact same STILL_DB_PATH env var (default 'data/still.db',
relative to cwd) so both sides always agree on which file they're using --
this is the same footgun INTEGRATION.md warns about, so always set
STILL_DB_PATH explicitly in your shell rather than relying on the default.
"""

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

DEFAULT_DB_PATH = Path("data/still.db")


def _db_path() -> Path:
    return Path(os.environ.get("STILL_DB_PATH", str(DEFAULT_DB_PATH)))


def _get_conn() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    # Defensive: create the table here too, in case schema_patients_addition.sql
    # hasn't been applied yet in this environment. IF NOT EXISTS makes this a
    # safe no-op once the real schema.sql already has it.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS patients (
            patient_id      TEXT PRIMARY KEY,
            display_name    TEXT,
            case_facts_path TEXT,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
        )
        """
    )
    return conn


def register_case_facts_path(patient_id: str, case_facts_path: str, display_name: Optional[str] = None) -> None:
    """
    Record (or update) which case_facts.json file belongs to this patient_id.
    Call this from case_profile.py right after writing --output.
    Safe to call repeatedly for the same patient -- it upserts, it does not
    duplicate rows or error on a second call.
    """
    now = datetime.now(timezone.utc).isoformat()
    conn = _get_conn()
    try:
        existing = conn.execute(
            "SELECT patient_id FROM patients WHERE patient_id = ?", (patient_id,)
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE patients
                SET case_facts_path = ?,
                    display_name = COALESCE(?, display_name),
                    updated_at = ?
                WHERE patient_id = ?
                """,
                (case_facts_path, display_name, now, patient_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO patients (patient_id, display_name, case_facts_path, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (patient_id, display_name, case_facts_path, now, now),
            )
        conn.commit()
    finally:
        conn.close()


def lookup_case_facts_path(patient_id: str) -> Optional[str]:
    """
    Look up the case_facts.json path for a patient_id. Returns None if this
    patient has never had a case profile registered -- callers should treat
    that the same as "--case-facts was omitted", not as an error.
    Call this from voice_chat.py at session start, instead of requiring a
    --case-facts CLI argument.
    """
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT case_facts_path FROM patients WHERE patient_id = ?", (patient_id,)
        ).fetchone()
        return row["case_facts_path"] if row else None
    finally:
        conn.close()