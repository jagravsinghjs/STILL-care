# STILL-care Frontend Tech Stack

## Core stack

-   **React 18**: component-based UI
-   **TypeScript**: type safety
-   **Vite**: development/build tooling
-   **Tailwind CSS**: responsive styling
-   **Zustand**: shared application state
-   **React Router**: routing
-   **Recharts**: only for genuinely useful qualitative trend
    visualisation
-   **npm**: dependency management

## Repository structure

``` text
STILL-care/
├── public/
│   └── assets/
├── src/
│   ├── app/
│   ├── assets/
│   │   ├── images/
│   │   └── icons/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── shared/
│   ├── features/
│   │   ├── auth/
│   │   ├── patient/
│   │   ├── supervisor/
│   │   ├── checkin/
│   │   ├── messages/
│   │   └── history/
│   ├── pages/
│   │   ├── auth/
│   │   ├── patient/
│   │   └── supervisor/
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

## Architecture rules

-   Reusable primitives live in `components/ui`.
-   Feature-specific components stay close to their feature.
-   Pages compose components and orchestrate flows.
-   Shared state belongs in Zustand.
-   API/mock access stays separate from presentation.
-   Shared domain types stay centralized.
-   Mock data is isolated from application logic.

## AI readiness

Current semantic analysis may be mock/demo logic. Create a replaceable
service boundary for future continuity observations, themes, qualitative
state, and trend direction.

Never expose API keys in frontend source. Real AI calls requiring
secrets must go through a secure server-side/backend layer.

## Privacy architecture

Keep user-private reflection/transcript data separate from
supervisor-safe continuity summaries. Supervisor-facing data adapters
should intentionally omit private transcript/reflection fields.

## Design tokens

``` text
Background       #F7F8F4
Primary Green    #24533F
Secondary Green  #5F8067
Soft Sage        #DDE8DD
Warm Cream       #F2EEE4
Soft Peach       #F2D8C8
Soft Lavender    #E8E3F1
Soft Blue        #DCEAF0
Text             #202522
Secondary Text   #66706A
Border           #D9DED8
```

Typography: **DM Sans** preferred, **Manrope** acceptable. No Times New
Roman or Georgia.

## Repository hygiene

Never commit `.env`, API keys, `node_modules`, temporary files,
screenshots, or build output unless explicitly required.

Before committing: - TypeScript check - `npm run build` - lint if
configured - primary route checks - console error check - responsive
check
