-- Still: Modules 11-17 monitoring/intelligence layer
-- SQLite schema matching setu_schemas.py
CREATE TABLE IF NOT EXISTS sessions (
    session_id      TEXT PRIMARY KEY,
    patient_id      TEXT NOT NULL,
    start_time      TEXT NOT NULL,
    end_time        TEXT,
    turn_count      INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS turns (
    turn_id         TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES sessions(session_id),
    patient_id      TEXT NOT NULL,
    timestamp       TEXT NOT NULL,
    transcript      TEXT NOT NULL,
    arousal_json    TEXT NOT NULL,   -- serialized ArousalFeatures
    emotion_json    TEXT NOT NULL,   -- serialized EmotionScores
    turn_score      REAL,
    flagged_high_pause INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);
CREATE TABLE IF NOT EXISTS session_summary (
    session_id          TEXT PRIMARY KEY REFERENCES sessions(session_id),
    patient_id          TEXT NOT NULL,
    mean_score          REAL,
    max_score           REAL,
    min_score           REAL,
    volatility          REAL,
    within_session_trend REAL,
    computed_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_summary_patient ON session_summary(patient_id);
CREATE TABLE IF NOT EXISTS distress_trend (
    patient_id      TEXT NOT NULL,
    computed_at     TEXT NOT NULL,
    window_sessions INTEGER,
    slope           REAL,
    trend_label     TEXT NOT NULL,   -- improving|stable|worsening|insufficient_data
    confidence      REAL,
    PRIMARY KEY (patient_id, computed_at)
);
CREATE TABLE IF NOT EXISTS escalation_risk (
    patient_id      TEXT NOT NULL,
    session_id      TEXT NOT NULL REFERENCES sessions(session_id),
    assessed_at     TEXT NOT NULL,
    risk_score      REAL,
    risk_level      TEXT NOT NULL,   -- low|moderate|high
    acute_override  INTEGER DEFAULT 0,
    features_json   TEXT,            -- serialized list[ContributingFeature]
    PRIMARY KEY (patient_id, session_id)
);
CREATE TABLE IF NOT EXISTS risk_explanation (
    patient_id      TEXT NOT NULL,
    session_id      TEXT NOT NULL,
    generated_at    TEXT NOT NULL,
    factors_json    TEXT NOT NULL,   -- serialized list[ExplanationFactor]
    PRIMARY KEY (patient_id, session_id),
    FOREIGN KEY (patient_id, session_id) REFERENCES escalation_risk(patient_id, session_id)
);
CREATE TABLE IF NOT EXISTS risk_status (
    patient_id                  TEXT PRIMARY KEY,
    tier                        TEXT NOT NULL,   -- green|yellow|red
    tier_since                  TEXT NOT NULL,
    previous_tier               TEXT,
    consecutive_high_assessments INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS alerts (
    alert_id        TEXT PRIMARY KEY,
    patient_id      TEXT NOT NULL,
    triggered_at    TEXT NOT NULL,
    tier            TEXT NOT NULL,
    reason          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'unacknowledged',
    acknowledged_by TEXT,
    acknowledged_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_patient ON alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE TABLE IF NOT EXISTS intervention_recommendation (
    recommendation_id TEXT PRIMARY KEY,
    patient_id         TEXT NOT NULL,
    generated_at       TEXT NOT NULL,
    categories_json    TEXT NOT NULL,   -- serialized list[InterventionCategory]
    rationale_json     TEXT NOT NULL,   -- serialized list[str], aligned by index
    reviewed_by        TEXT,
    accepted           INTEGER          -- NULL = pending, 0 = dismissed, 1 = accepted
);
CREATE INDEX IF NOT EXISTS idx_intervention_patient ON intervention_recommendation(patient_id);

-- Shared case circles: used by chatbot 07 and the intelligence supervisor API.

CREATE TABLE IF NOT EXISTS chatbot_case_groups (
    group_id TEXT PRIMARY KEY, case_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL, supervisor_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chatbot_group_members (
    group_id TEXT NOT NULL REFERENCES chatbot_case_groups(group_id),
    patient_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('invited','accepted','declined','left')),
    share_safety INTEGER NOT NULL DEFAULT 0,
    invited_at TEXT NOT NULL, responded_at TEXT,
    PRIMARY KEY(group_id, patient_id)
);
CREATE TABLE IF NOT EXISTS chatbot_patient_cases (
    patient_id TEXT PRIMARY KEY, case_id TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS chatbot_one_active_case_per_patient
    ON chatbot_group_members(patient_id) WHERE status = 'accepted';
CREATE TABLE IF NOT EXISTS chatbot_safety_incidents (
    incident_id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES chatbot_case_groups(group_id),
    patient_id TEXT NOT NULL, session_id TEXT NOT NULL, turn_id TEXT NOT NULL,
    kind TEXT NOT NULL, summary TEXT NOT NULL, evidence_quote TEXT NOT NULL,
    fingerprint TEXT NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(group_id, patient_id, turn_id, kind),
    UNIQUE(group_id, patient_id, fingerprint)
);
CREATE TABLE IF NOT EXISTS chatbot_group_alerts (
    alert_id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL UNIQUE REFERENCES chatbot_safety_incidents(incident_id),
    group_id TEXT NOT NULL REFERENCES chatbot_case_groups(group_id),
    message TEXT NOT NULL, independent_reporters INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chatbot_alert_deliveries (
    alert_id TEXT NOT NULL REFERENCES chatbot_group_alerts(alert_id),
    recipient_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('patient','supervisor')),
    delivered_at TEXT, acknowledged_at TEXT,
    PRIMARY KEY(alert_id, recipient_id, role)
);

CREATE TABLE IF NOT EXISTS chatbot_session_reports (
    session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
    patient_id TEXT NOT NULL,
    model TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    report_json TEXT NOT NULL
);

-- Verified account directory populated by the enclosing authentication backend.
CREATE TABLE IF NOT EXISTS consultant_accounts (
    consultant_id TEXT PRIMARY KEY, display_name TEXT NOT NULL,
    email TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS consultant_assignment_requests (
    request_id TEXT PRIMARY KEY, patient_id TEXT NOT NULL,
    consultant_id TEXT NOT NULL REFERENCES consultant_accounts(consultant_id),
    display_identifier TEXT NOT NULL, created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
    responded_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_consultant_request
    ON consultant_assignment_requests(patient_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS consultant_assignments (
    patient_id TEXT PRIMARY KEY, consultant_id TEXT NOT NULL REFERENCES consultant_accounts(consultant_id),
    display_identifier TEXT NOT NULL, accepted_at TEXT NOT NULL
);

-- Existing case-profile registry, shared with chatbot 06.
CREATE TABLE IF NOT EXISTS patients (
 patient_id TEXT PRIMARY KEY, display_name TEXT, case_facts_path TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS patient_personalization (
 patient_id TEXT PRIMARY KEY, narrative TEXT NOT NULL DEFAULT '' CHECK(length(narrative)<=2000), updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS consultant_descriptions (
 consultant_id TEXT PRIMARY KEY REFERENCES consultant_accounts(consultant_id),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=1000)
);
CREATE TABLE IF NOT EXISTS profile_photos (
 role TEXT NOT NULL CHECK(role IN ('patient','consultant')), owner_id TEXT NOT NULL,
 image_png BLOB NOT NULL, PRIMARY KEY(role,owner_id)
);
