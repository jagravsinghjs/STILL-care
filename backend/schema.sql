-- Main-backend tables.  These live in the same SQLite database as the
-- intelligence layer so account IDs can safely be used as patient IDs.
CREATE TABLE IF NOT EXISTS accounts (
    user_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('STUDENT', 'SUPERVISOR')),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- A supervisor may only be granted access to a patient through this table.
-- Assignment administration is intentionally deferred, but the data model is
-- established before any supervisor-facing endpoints are exposed.
CREATE TABLE IF NOT EXISTS supervisor_patients (
    supervisor_id TEXT NOT NULL REFERENCES accounts(user_id),
    patient_id TEXT NOT NULL REFERENCES accounts(user_id),
    assigned_at TEXT NOT NULL,
    PRIMARY KEY (supervisor_id, patient_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    message_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(session_id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
