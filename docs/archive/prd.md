# STILL-care Frontend PRD

## Product Identity

**STILL-care**\
**STILL = Safety, Trust & Intervention for Longitudinal Life-Care**

STILL-care is a simple personal wellbeing and continuity-of-support
platform for people from all walks of life. Its frontend helps users
check in, reflect, stay connected with a supervisor, and understand
their support journey over time.

### Core principles

-   **Safety:** make support easy to access without alarming users.
-   **Trust:** be transparent, calm, private, and predictable.
-   **Intervention:** help the appropriate human notice meaningful
    change and take an appropriate supportive next step.
-   **Longitudinal Life-Care:** maintain continuity across multiple
    check-ins.

Core journey: **Check in → Reflect → Continuity → Understand → Support**

## Users

### User

Anyone who wants a simple, private way to check in
and stay connected with their supervisor/counsellor.

### Supervisor/Counsellor

A support professional who needs concise continuity information,
alerts, messages, and clear next actions.

## MVP

### User

-   Login
-   Dashboard
-   New check-in
-   Written reflection
-   Simulated voice reflection
-   History
-   Messages
-   Supervisor connection
-   Profile
-   Privacy explanation
-   Logout

### Supervisor

-   Login
-   Dashboard
-   Users
-   Alerts
-   Messages
-   User continuity view
-   Appropriate follow-up actions
-   Qualitative trend information

## User information architecture

Primary navigation: 1. Dashboard 2. New Check-in 3. History 4. Messages
5. Profile

The supplied sketch is the structural inspiration: a large central
Dashboard with only a few surrounding actions such as History, Profile,
New Check-in, Reflections, Messages, and Notifications.

## Dashboard

Primary content: - "Good morning, Ananya." - "How are things going
today?" - **Start a check-in**

Secondary content: - Recent check-in - Your supervisor: Dr. Meera Iyer -
Messages - Lightweight notification indicator where genuinely useful

Do not use a wall of cards, statistics, percentages, risk scores, or
competing CTAs.

## Check-in

1.  Choose Written or Voice.
2.  Show a gentle prompt.
3.  User reflects.
4.  Review and submit.
5.  Confirmation.
6.  Update longitudinal continuity information.

Voice is simulated in the prototype unless real microphone functionality
is implemented.

## History

Simple chronological continuity list: - Date - Written/Voice - Short
continuity observation - View details

Raw reflections/transcripts remain user-private.

## Messages

A familiar messaging interface between user and supervisor. Keep
message input and optional quick replies, without unnecessary analytics.

## Profile

Only essential information: - User name - Basic profile -
Supervisor - Privacy information - Logout

## Supervisor experience

Primary navigation: - Dashboard - Users - Alerts - Messages

Supervisor Dashboard answers: 1. Who needs attention? 2. What changed
over time? 3. What can I do next?

User cards show: - Name - Stable / Monitoring / Increasing concern -
Improving / No clear change / Worsening - Short explanation -
Appropriate next action

## Privacy boundary

User raw reflections and transcripts are private. Supervisor views
receive only appropriate high-level continuity summaries/observations.
Never expose raw reflections/transcripts in supervisor views.

## Semantic states

Allowed states: - Stable - Monitoring - Increasing concern

Allowed trends: - Improving - No clear change - Worsening

These are qualitative continuity indicators, not diagnoses or clinical
scores. Never introduce risk percentages, emotion percentages,
confidence percentages, 1--100 scores, DSM/ICD codes, or fake clinical
certainty.

## Everyday life context

Natural references may include daily routines, work, relationships,
family responsibilities, caregiving, and life changes. Do not
over-medicalize everyday stress. Do not add US-specific
resources such as 988 unless explicitly required.

## Demo identities

-   User: **Ananya Sharma**
-   Supervisor: **Dr. Meera Iyer**

Both are fictional demo identities.

Keep the User/Counsellor switch for demonstrations if useful, but
remove the visible phrase "Hackathon demo mode".

## Non-goals

-   Diagnosis
-   Clinical scoring
-   Replacing counselling
-   Exposing raw reflections to supervisors
-   Generic social networking
-   Productivity analytics
-   Adding features just to fill space

## Success criteria

A first-time user should immediately know where to check in, see
history, message their supervisor, and find their profile.

A supervisor should immediately understand who may need attention, what
changed, and what to do next.
