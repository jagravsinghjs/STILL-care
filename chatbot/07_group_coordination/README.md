# Three-friend case-circle prototype

One Python feature file: `group_coordination.py`. Three personal agents share
confirmed safety notices through SQLite; all still use the same Qwen model.
Private chats, profiles, and reports stay separate. No guardians, frontend,
authentication, or external messaging are added here. The intelligence API
also exposes the supervisor's circle inbox using the same stored rows.

Each patient keeps their existing personal profile for **one case**. A circle
has one `case_id`; accepting binds that prototype patient ID to the case.
Different friends use different profile files even though their case ID is
the same. Joining does not pool those files or copy other people's memories.
Case switching/multiple personal case profiles are outside this prototype.

## Database and identities

Run these commands from the repository root:

```bash
export STILL_DB_PATH="$PWD/data/still.db"
```

All commands and stages 05/06 must use this same absolute path. Stage 07
initializes the shared `intelligence_model/db/schema.sql` at runtime without
replacing existing data. Its CLI still uses only Python's standard library.

The CLI trusts IDs supplied by the demo operator. An ID is **not a login**.
Real identity verification and invitation UI belong to the later backend/
frontend integration. The owner-ID checks below do not authenticate callers.

## Create the group and invite the friends

```bash
uv run python chatbot/07_group_coordination/group_coordination.py create \
  --group-id friends --case-id case-demo --name "Three friends case" \
  --supervisor-id consultant1

uv run python chatbot/07_group_coordination/group_coordination.py invite \
  --group-id friends --supervisor-id consultant1 --patient-id friend1
uv run python chatbot/07_group_coordination/group_coordination.py invite \
  --group-id friends --supervisor-id consultant1 --patient-id friend2
uv run python chatbot/07_group_coordination/group_coordination.py invite \
  --group-id friends --supervisor-id consultant1 --patient-id friend3
```

Each friend can inspect their invitation, then explicitly accept or decline:

```bash
uv run python chatbot/07_group_coordination/group_coordination.py invitations --patient-id friend1
uv run python chatbot/07_group_coordination/group_coordination.py accept \
  --group-id friends --patient-id friend1 --share-safety-alerts
```

Repeat acceptance for `friend2` and `friend3`. Without the sharing flag,
acceptance is refused. To decline, replace `accept` with `decline` and omit
the sharing flag. Up to three patient members may accept. Pending/declined
members receive no notices. Only future reports are delivered to new members;
joining does not disclose earlier alerts retroactively.

## Real voice demonstration

Create/register a separate stage 06 profile for each friend if personal case
memory is needed. The case described in those profiles must be this circle's
case; the operator assigns these IDs explicitly for the prototype. Then use
the existing stage 05 setup (Whisper, emotion model, Ollama, intelligence layer):

```bash
uv run python chatbot/05_voice_chat/voice_chat.py --patient-id friend1
```

Stage 05 shows invitations and automatically loads accepted membership.
After each conversational reply, a separate Qwen request checks that patient's
current words for possible following, threats, or physical harm. It requires
an exact evidence quote, a new firsthand report, and relevance to this case.
The patient then confirms that it happened to them and should be shared.
Answering `n`/Enter shares nothing. Model extraction alone never broadcasts.

Now start friend 2's chat, report a different firsthand following incident,
and confirm it. Opening friend 3's chat shows their pending circle notices:

```bash
uv run python chatbot/05_voice_chat/voice_chat.py --patient-id friend3
```

Notices are printed before recording and supplied as separate application
context to that agent. They are never appended to the patient's transcript.
The loop polls between turns; it does not push to an offline terminal/device.
Confirmed outgoing IDs are recorded in `turns.json`; received notices have
their own `group_notices.json`. Personal reports keep their existing format.

## Demonstrate alert routing without a microphone or models

After accepting all three invitations:

```bash
uv run python chatbot/07_group_coordination/group_coordination.py report-incident \
  --group-id friends --patient-id friend1 --session-id demo1 --turn-id turn1 \
  --kind following --summary "Reported a bike following them" \
  --quote "I saw a bike following me" --confirm-firsthand

uv run python chatbot/07_group_coordination/group_coordination.py report-incident \
  --group-id friends --patient-id friend2 --session-id demo2 --turn-id turn2 \
  --kind following --summary "Reported a car following them" \
  --quote "A car followed me home" --confirm-firsthand

uv run python chatbot/07_group_coordination/group_coordination.py inbox --recipient-id friend3
uv run python chatbot/07_group_coordination/group_coordination.py inbox \
  --recipient-id consultant1 --role supervisor
```

Use `ack --recipient-id friend3 --alert-id <id>` to acknowledge a notice.
The default inbox shows only new deliveries. Patients see the latest update
per case/category, so a two-member update replaces an unread one-member notice.
Checking the inbox again does not repeat delivered messages. Supervisors still
see each individual report. Use `inbox --recipient-id friend3 --history` for
all older/superseded notices, or add `--json` for structured output. Human
messages and JSON are not printed together. History viewing does not mark
old notices delivered; delivery and acknowledgment remain separate states.

Use `leave --group-id friends --patient-id friend3` to stop access and future
delivery. The single-case binding remains after leaving to avoid mixing a
new case with the same personal profile. `status --patient-id friend3` shows
current accepted membership.

## Routing and interpretation

- Other accepted patients receive a generic notice with no source transcript,
  evidence quote, or source ID. In a small known circle, source identity may
  still be inferred. The supervisor can see the confirmed summary and quote.
- Notices count different reporting patients for the same category over the
  preceding 24 hours. Multiple messages from one person count as one reporter.
  Reports remain allegations, not verified findings or proof another friend
  is being targeted. This is independent of mental-distress scoring.
- A retried source turn/category creates no duplicate incident. Identical
  wording from the same person/category on the same UTC day is also deduplicated;
  this conservative rule can combine separate identically worded experiences.
- Reading/acknowledging a notice never creates another incident. Extraction
  ignores retellings/notices, and sharing requires explicit firsthand confirmation.
- Inbox delivery is not proof the supervisor read it or an emergency dispatch.
  Delivered and acknowledged timestamps are tracked separately.
- Live chats announce a notice only when it has not been delivered before.
  Already-delivered, unacknowledged notices remain background agent context
  without repeating the announcement in each new session.
- Group failures do not stop personal chat/report generation. Qwen mistakes,
  declined confirmations, or unavailable inference can mean no shared incident;
  the manual demo command is an explicit operator-entered report, not model evidence.

## Intelligence-layer connection

With the intelligence API mounted behind its existing supervisor identity
dependency, `GET /case-groups` lists that supervisor's circles,
`GET /case-groups/alerts` lists their unacknowledged group notices, and
`PATCH /case-groups/alerts/{alert_id}/acknowledge` acknowledges the same
delivery visible in this CLI. `?history=true` includes acknowledged history.
Other supervisors cannot read or acknowledge these circle notices. API
polling does not acknowledge notices and CLI delivery does not hide an
unacknowledged notice from the supervisor API. These remain separate from
the individual mental-distress `/alerts`; group notices do not set risk tiers.

## Offline checks

```bash
uv run python -m unittest discover -s chatbot/07_group_coordination/tests -v
uv run python -m unittest discover -s chatbot/05_voice_chat/tests -v
```

Tests use disposable databases and mocked model calls; no real messages are sent.
