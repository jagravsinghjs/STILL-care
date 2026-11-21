# Module 16 — Early supervisor review and tier alerts

A concerning first or second session can request supervisor attention.
`ingest_turn()` checks the stored turns before returning to the chatbot, without
waiting for session closure. `check_and_alert()` also evaluates session risk
at the end. These are prototype review rules, not diagnoses or validated
clinical thresholds. The longer-term tier's hysteresis is unchanged.

## Review triggers

- A numerical turn score above 65/100 requests urgent review, even if historical
  confidence is low and the combined session risk stays LOW.
- Explicit severe distress/difficulty coping, physical harm, threats, or personal
  harm/forcing language requests urgent review; following/bullying/coercion
  patterns can request prompt review. Exact patterns live in `alert_engine.py`.
- A MODERATE session risk requests prompt review; HIGH requests urgent review.
- Existing acute phrases still request urgent attention and force RED during
  the completed risk pipeline. Escalation/progress alerts remain supported.

Calm turns do not automatically create an alert. Simple direct negations are
filtered for the new review patterns; contextual negation, quotations, historical
statements, and recognition errors remain limitations. The existing acute phrase
matcher retains its original behavior. Human review is required; the rules
must not be described as comprehensive safety detection.

## Storage, priority, and delivery

`Alert.tier` records monitoring status; computed `Alert.priority` is `urgent`,
`prompt`, or `routine`, derived from the reason prefix and tier. The API and
relay payload expose this field without a database migration. Consumers must
use priority rather than treating a GREEN-tier review alert as an all-clear.

One deterministic attention-alert ID is used per patient/session. Rechecking
or finalizing does not duplicate it or repeatedly push it. Higher urgency or a
new acute flag reopens/upgrades it; otherwise acknowledgment is preserved.
Different sessions may create distinct review alerts. Progress events remain
separate. There is no new automatic treatment or group broadcast.

Alerts are stored in `alerts` and surfaced through the existing authenticated
`GET /alerts` / acknowledgment API. The optional `alertd` relay receives a
best-effort push on new/upgraded alerts. Missing relay/subscriber does not
remove the DB record. A queue record is not confirmed human receipt. Frontend,
login, consultant assignment, email/SMS delivery are outside this change.

## Local prototype supervisor queue

From the repository root, using the same database as the chatbot:

```bash
export STILL_DB_PATH="$PWD/data/still.db"
uv run python intelligence_model/scripts/view_alerts.py --patient-id solo_demo_001
```

This is a trusted local operator command, not an authenticated supervisor login.
To explicitly apply the new rules to an older saved session, add
`--review-session <session_id>`. Reading the queue alone does not backfill old
alerts. The recheck may create an alert and attempt the optional relay push.

## Offline checks

```bash
uv run python -m unittest discover -s intelligence_model/tests -p 'test_early_alerts.py' -v
uv run python -m unittest discover -s intelligence_model/tests -p 'test_chatbot_connection.py' -v
```

Tests use temporary databases and mock the relay; no actual consultant is
contacted. API tests mock model generation but use real ingestion/scoring.
