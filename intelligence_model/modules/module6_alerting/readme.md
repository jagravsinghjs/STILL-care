# Module 16 — Alert & Escalation

Watches a patient's `RiskStatus` before/after Module 15's update, plus
the triggering `EscalationRisk.acute_override` flag, and decides whether
to write an `Alert`. **Strictly detect + notify — this module never takes
action on its own.** It writes a row a human can see and act on; it does
not contact anyone, lock any account, or trigger any intervention itself.
That's the whole point: alerts go to supervisors, not to automation.

`alert_engine.py` is the *only* module permitted to write to `alerts` —
`db/repository.py` exposes the mechanics but enforces nothing; that
boundary is a convention, not a technical guarantee, so don't add
`insert_alert` calls anywhere else.

## Priority via reason prefix, not a schema field

`Alert`'s schema (immutable, per `schemas.py`) has no priority/category
column. This module encodes urgency as a text prefix on `reason` instead:
`[ESCALATION]` (tier got worse), `[ACUTE]` (acute-risk language matched,
always alerts even with no tier change), `[PROGRESS]` (tier improved —
lower urgency, encouraging tone). Anything consuming `alerts`
(`api/routes_alerts.py`, the dashboard) that wants to sort or style by
urgency needs to parse this prefix. If a schema migration is ever
acceptable, a real `category` column would replace this cleanly.

## `notifier.py` — will silently no-op until alertd exists

`alertd` isn't built yet (see the top-level handoff doc). `notifier.py`
attempts a best-effort push over a Unix socket after every alert insert,
but every attempt will fail (connection refused / socket missing) until
alertd is actually running — and that's expected, not a bug. Failures are
logged at debug level and swallowed; they never affect whether the
`Alert` row itself gets written, since that's the actual safety-relevant
action.