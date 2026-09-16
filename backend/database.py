"""Connection and schema setup for the main STILL-care backend."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


def database_path() -> Path:
    """Use the same explicit environment contract as intelligence_model."""
    return Path(os.environ.get("STILL_DB_PATH", "intelligence_model/data/still.db"))


def connect(path: Path | None = None) -> sqlite3.Connection:
    resolved = path or database_path()
    resolved.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(resolved)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def initialize_schema(path: Path | None = None) -> None:
    with connect(path) as conn:
        schema = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
        conn.executescript(schema)


@contextmanager
def transaction(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    conn = connect(path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
