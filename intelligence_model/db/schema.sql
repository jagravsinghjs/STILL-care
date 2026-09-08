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