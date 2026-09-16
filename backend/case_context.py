"""Profile-submitted case context backed by the existing patient registry."""

from __future__ import annotations

import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
import tempfile


CASE_PROFILE_MODULE = Path(__file__).parents[1] / "chatbot" / "06_case_profile" / "case_profile.py"


def _facts_root() -> Path:
    return Path(os.environ.get("STILL_CASE_FACTS_DIR", "data/case_facts"))


def _extractor():
    spec = importlib.util.spec_from_file_location("still_case_profile", CASE_PROFILE_MODULE)
    if spec is None or spec.loader is None:
        raise RuntimeError("Case-profile extractor is unavailable.")
    module = importlib.util.module_from_spec(spec)
    # case_profile imports its adjacent patient_registry.  The backend writes
    # that exact registry contract itself, so only the extractor is needed.
    import sys
    sys.path.insert(0, str(CASE_PROFILE_MODULE.parent))
    try:
        spec.loader.exec_module(module)
    finally:
        sys.path.pop(0)
    return module.extract_and_merge_case_facts


def save_case_context(conn: sqlite3.Connection, *, patient_id: str, display_name: str, text: str) -> Path:
    """Merge profile text, atomically save it, and register its absolute path."""
    text = text.strip()
    if not text:
        raise ValueError("Case details cannot be empty.")
    if len(text) > 20_000:
        raise ValueError("Case details must not exceed 20,000 characters.")
    root = _facts_root()
    root.mkdir(parents=True, exist_ok=True)
    target = root / f"{patient_id}.json"
    existing = json.loads(target.read_text(encoding="utf-8")) if target.exists() else None
    merged = _extractor()(text, existing_facts=existing)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=root, delete=False) as temp:
        json.dump(merged, temp, indent=2)
        temp.flush()
        os.fsync(temp.fileno())
        temporary_path = Path(temp.name)
    temporary_path.replace(target)

    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS patients (
            patient_id TEXT PRIMARY KEY, display_name TEXT, case_facts_path TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"""
    )
    conn.execute(
        """INSERT INTO patients (patient_id, display_name, case_facts_path, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(patient_id) DO UPDATE SET display_name=excluded.display_name,
             case_facts_path=excluded.case_facts_path, updated_at=excluded.updated_at""",
        (patient_id, display_name, str(target.resolve()), now, now),
    )
    return target.resolve()
