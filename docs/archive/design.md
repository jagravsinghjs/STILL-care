# STILL-care Design System & UX Specification

## Brand

**STILL-care**\
**Safety, Trust & Intervention for Longitudinal Life-Care**

The design should communicate Safety, Trust, timely human Intervention,
and Longitudinal continuity.

It must not look like hospital software, a clinical dashboard, a generic
AI-generated SaaS template, or a feature-heavy analytics product.

## Reference structure

The supplied hand-drawn reference establishes the information
hierarchy: - large central **Dashboard** - **History of
chats/check-ins** - **Profile** - **New Check-in** - **Reflections** -
**Messages** - lightweight **Notifications**

Translate the sketch into a polished product, not a literal drawing.

## User desktop hierarchy

``` text
┌─────────────────────────────────────────────────────────────┐
│ STILL-care     Dashboard  Check-in  History  Messages  Me  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Good morning, Ananya.                                     │
│  How are things going today?                               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Start a check-in                     │  │
│  │                 Write or Voice                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Recent check-in  │  │ Your supervisor  │               │
│  │                  │  │ Dr. Meera Iyer   │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Messages                                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Colour palette

Primary: - Forest green `#24533F` - Secondary green `#5F8067`

Supporting: - Sage `#DDE8DD` - Peach `#F2D8C8` - Lavender `#E8E3F1` -
Blue `#DCEAF0`

Neutral: - Background `#F7F8F4` - Cream `#F2EEE4` - Text `#202522` -
Secondary text `#66706A` - Border `#D9DED8`

Green is the brand anchor. Peach/lavender/blue are subtle accents. Do
not make yellow/beige dominant.

## Typography

Use **DM Sans**. Manrope is an acceptable fallback.

Use modest heading sizes, comfortable line height, and clear hierarchy.
Avoid serif UI typography and overly futuristic fonts.

## Shape language

Use: - 16--24px rounded corners - subtle borders - restrained shadows -
organic curves - generous whitespace - small botanical/natural motifs

Avoid glassmorphism, neon, heavy gradients, 3D effects, and excessive
shadows.

## Semantic states

-   **Stable:** calm green treatment
-   **Monitoring:** warm amber/peach treatment
-   **Increasing concern:** restrained terracotta treatment

Never turn these into numerical meters.

## User UX

Always make these clear: 1. Where am I? 2. What can I do next? 3. Who
supports me? 4. What is private?

## Supervisor UX

Hierarchy: **Needs attention → What changed → Next action**

## Mobile

Use compact navigation with: - Dashboard - Check-in - History -
Messages - Profile

Stack content vertically. Keep touch targets around 44px or larger.

## Microcopy

Prefer: - "How are things going?" - "Start a check-in" - "Continue your
reflection" - "View your history" - "Connect with your supervisor" -
"You have a new message"

Avoid clinical or AI-heavy language such as "risk score", "AI
confidence", "clinical severity", or "treatment recommendation".

## Privacy copy

Trust should come from clarity, not fake security badges.

Example: "Your reflection is private. Your supervisor sees only the
continuity information needed to support you."

Only use wording that matches the implementation.

## Anti-AI-template rules

Avoid: - 12-card dashboards - random gradients - giant hero headings -
AI sparkle icons - meaningless statistics - decorative charts -
repetitive rounded rectangles - excessive blobs - glass effects

Every element must have a job.

## Brand lockup

Use **STILL-care** as the main brand name.

Use the full expansion naturally on login/about/documentation contexts,
not on every screen.

Overall feeling: **quietly confident, warm, clear, human, trustworthy,
easy to use.**
