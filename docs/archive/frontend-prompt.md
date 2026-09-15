# Complete STILL-care Frontend Build Prompt

Build the complete STILL-care frontend from the ground up using the
attached reference image and the specifications in `prd.md`,
`techstack.md`, and `design.md`.

## BRAND

Product: **STILL-care**

STILL means:

**Safety, Trust & Intervention for Longitudinal Life-Care**

This is the core identity of the product. Design and copy should reflect
Safety, Trust, timely human Intervention, and Longitudinal continuity.

The core journey is:

**CHECK IN → REFLECT → CONTINUITY → UNDERSTAND → SUPPORT**

Do not make intervention feel alarming. It means helping the appropriate
human notice meaningful change and take an appropriate supportive next
step.

## DESIGN GOAL

Create a polished, modern, human-designed personal wellbeing
product.

It must NOT look: - AI-generated - like a generic SaaS dashboard - like
hospital software - overly clinical - feature-heavy - cluttered -
beige/yellow dominated

It SHOULD feel: - calm - warm - modern - attractive - trustworthy -
simple - intentionally designed - appropriate for people from all walks of life

Use the supplied hand-drawn sketch as the information-density
inspiration. The large central Dashboard is the main canvas. Surround it
with only the most useful actions: New Check-in, History, Profile,
Reflections, Messages, and lightweight Notifications.

Do not copy the sketch literally. Turn its simplicity into a polished
responsive interface.

## TECHNICAL REQUIREMENTS

Use: - React 18 - TypeScript - Vite - Tailwind CSS - Zustand - React
Router - Recharts only when a qualitative trend visualisation is
genuinely useful

Organise the repository exactly around clear app, components, features,
pages, data, API, types, styles, and docs folders. Do not scatter files
at the repository root.

## USER NAVIGATION

Keep only: - Dashboard - New Check-in - History - Messages - Profile

## USER DASHBOARD

Create a clean central dashboard.

Top: "Good morning, Ananya."

Then: "How are things going today?"

Primary CTA: **Start a check-in**

Below it show only: 1. Recent Check-in 2. Your Supervisor: Dr. Meera
Iyer 3. Messages 4. Lightweight notification indicator if genuinely
useful

Do not show numerical wellbeing/risk/emotion scores.

## CHECK-IN

The check-in is the core action.

Flow: 1. Choose Write or Voice. 2. Gentle prompt. 3. Reflection. 4.
Review. 5. Submit. 6. Confirmation. 7. Update longitudinal continuity
information.

Keep voice simulated unless actual microphone functionality exists.

Do not add complicated questionnaires or clinical scales.

## HISTORY

Create a simple chronological continuity timeline/list: - date -
Written/Voice - short continuity observation - View details

Keep raw reflections/transcripts private.

## MESSAGES

Create a familiar messaging interface between user and supervisor.
Keep message input and optional quick replies. Remove unnecessary
analytics.

## PROFILE

Keep: - name - basic information - supervisor - privacy information -
logout

## SUPERVISOR

Primary navigation: - Dashboard - Users - Alerts - Messages

Dashboard answers: 1. Who needs attention? 2. What changed? 3. What can
I do next?

User cards show: - name - Stable / Monitoring / Increasing concern -
Improving / No clear change / Worsening - short explanation -
appropriate next action

Do not show numerical risk scores, percentages, fake confidence, emotion
percentages, clinical severity, diagnoses, DSM/ICD codes, or other fake
clinical certainty.

## PRIVACY

User raw reflections/transcripts must not appear in supervisor views.

Supervisors receive only appropriate high-level continuity summaries and
observations.

Do not make unsupported security claims.

## BRAND COLOURS

Use:

``` text
#F7F8F4  background
#24533F  primary forest green
#5F8067  secondary green
#DDE8DD  soft sage
#F2EEE4  warm cream
#F2D8C8  soft peach
#E8E3F1  soft lavender
#DCEAF0  soft blue
#202522  primary text
#66706A  secondary text
#D9DED8  borders
```

Green is the main brand colour. Peach, lavender, and blue are subtle
accents. Avoid a yellow/beige-dominated UI.

## TYPOGRAPHY

Use DM Sans, with Manrope as fallback. Absolutely avoid Times New Roman,
Georgia, or serif UI typography.

## VISUAL STYLE

Use: - organic rounded shapes - gentle curves - subtle botanical/natural
motifs - generous whitespace - rounded cards - light surfaces - subtle
borders - restrained shadows

Avoid: - neon - glassmorphism - excessive gradients - 3D effects -
generic AI sparkle graphics - giant illustrations - template-like card
grids

The design must look handcrafted and intentional.

## SEMANTIC STATES

Use only: - Stable - Monitoring - Increasing concern

Trend: - Improving - No clear change - Worsening

These are qualitative continuity indicators, not diagnoses or clinical
scores.

## EVERYDAY LIFE CONTEXT

Use natural references where relevant: - daily routines - work - relationships -
family responsibilities - caregiving - life changes

Do not over-medicalize everyday stress.

Do not add US-specific crisis resources such as 988.

Do not invent emergency numbers, real institutions, or real credentials.

Demo identities: - Ananya Sharma - Dr. Meera Iyer

Both are fictional demo identities.

## DEMO SWITCH

Keep User/Counsellor switching for demonstration, but remove visible
text: **"Hackathon demo mode"**

Keep the switch subtle.

## LOGIN

Create: - User Login - Counselor Login

User routes to `/patient/dashboard`. Counselor routes to
`/supervisor/dashboard`.

Use mock authentication for the prototype.

## ROUTES

User: - `/login` - `/patient/dashboard` - `/patient/checkin/new` -
`/patient/checkin/conversation` - `/patient/history` -
`/patient/messages` - `/patient/supervisor` - `/patient/profile`

Supervisor: - `/supervisor/dashboard` - `/supervisor/patients` -
`/supervisor/patients/:id` - `/supervisor/alerts` -
`/supervisor/messages`

## DATA AND STATE

Keep mock data in a dedicated mock-data area.

Use Zustand for shared state.

Keep API access separate from UI.

Keep a clean service boundary for future backend/AI integration.

Current semantic analysis can be mock/demo logic. Do not claim it is
real machine learning.

## COMPONENT QUALITY

Create reusable, focused components such as: - Button - Card - Badge -
StatusDot - Modal - Input - Textarea - EmptyState - LoadingState -
ErrorState - AppHeader - UserNav - SupervisorNav - CheckInCard -
HistoryItem - MessageBubble - SupervisorCard

## RESPONSIVENESS

Design intentionally for desktop, laptop, tablet, and mobile.

Mobile should use compact navigation and stacked content. Touch targets
should be approximately 44px or larger.

## REPOSITORY HYGIENE

Use this structure:

``` text
STILL-care/
├── public/
├── src/
│   ├── app/
│   ├── assets/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── shared/
│   ├── features/
│   ├── pages/
│   ├── store/
│   ├── api/
│   ├── data/
│   │   └── mock/
│   ├── types/
│   ├── utils/
│   ├── constants/
│   ├── styles/
│   └── main.tsx
├── docs/
│   ├── prd.md
│   ├── techstack.md
│   ├── design.md
│   └── frontend-prompt.md
├── .env.example
├── .gitignore
├── README.md
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts
```

Do not commit `node_modules`, `.env`, API keys, temporary files,
screenshots, or build output.

## QUALITY BAR

Before finishing: - run TypeScript checks - run production build - run
lint if configured - verify every route - test User Login - test
Counselor Login - test Dashboard - test New Check-in - test History -
test Messages - test Profile - test Supervisor Dashboard - test
Users - test Alerts - test Supervisor Messages - remove
console/runtime errors - verify responsive behaviour

Do not leave placeholder lorem ipsum, dead buttons, fake functionality,
or unnecessary empty sections.

Do not add new features just to fill space.

If an element does not clearly help with Safety, Trust, Intervention, or
Longitudinal Life-Care, question whether it belongs.

## FINAL UX TEST

A user should immediately understand: - where to check in - where
their history is - how to message their supervisor - who their
supervisor is - what information is private

A supervisor should immediately understand: - who needs attention - what
changed - what they can do next

The final result should look like a real product created by a small
professional product/design team, not an AI-generated collection of
components.

**SIMPLER IS BETTER.**
