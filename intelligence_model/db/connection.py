"""
a file whose sole purpose is to serve as a connenction anchor for all files in the model,
allowing modules to communicate with each other following similar processes w/o any
of them touching sqlite3 directly

opens the DB with WAL mode + foreign keys enabled, exposes a
context-managed get_conn(), and centralizes the DB file path so every
module talks to the same file consistently.
"""

from __future__ import annotations
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Union

from dotenv import load_dotenv

load_dotenv()

DEFAULT_DB_PATH = Path("data/still.db")
DB_PATH: Path = Path(os.environ.get("STILL_DB_PATH", str(DEFAULT_DB_PATH)))

def _configure_connection(conn: sqlite3.Connection) -> None:
    # Apply the pragmas + row factory every connection to this DB must have
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row

def get_raw_connection(db_path: Union[Path, str, None] = None) -> sqlite3.Connection:
    """
    Open a new, fully-configured connection to the Still DB.
 
    Prefer `get_conn()` (the context manager below) in normal application
    code. This is exposed for callers that need to manage the connection's
    lifetime themselves — e.g. `scripts/init_db.sh`-adjacent tooling,
    one-off scripts, or test fixtures that want a connection scoped to a
    whole test session rather than a single `with` block.
    """
    path = Path(db_path) if db_path is not None else DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    _configure_connection(conn)
    return conn

@contextmanager
def get_conn(db_path: Union[Path, str, None] = None) -> Iterator[sqlite3.Connection]:
    """
    Context-managed connection: commits on clean exit, rolls back on any
    exception, always closes the connection. This is the entry point every
    function in db/repository.py (and, transitively, every module) uses.
 
    Usage:
        from db.connection import get_conn
 
        with get_conn() as conn:
            conn.execute("INSERT INTO ...", (...,))
    """
    conn = get_raw_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_schema(db_path: Union[Path, str, None] = None, schema_path: Union[Path, str, None] = None) -> None:
    """
    Apply db/schema.sql to the target DB file. Idempotent (schema.sql is
    all CREATE TABLE/INDEX IF NOT EXISTS), so this is safe to call on an
    already-initialized DB. Intended to be called by scripts/init_db.sh /
    scripts/seed_demo_data.py and by test fixtures — not by application
    code at request time.
    """
    schema_file = Path(schema_path) if schema_path is not None else Path(__file__).parent / "schema.sql"
    sql = schema_file.read_text()
    with get_conn(db_path) as conn:
        conn.executescript(sql)



