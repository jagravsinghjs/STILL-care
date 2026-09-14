# STILL-care

A responsive wellbeing frontend for everyone, built from the supplied planning documents with React 18, TypeScript, Vite, Tailwind CSS, Zustand and React Router. DM Sans is bundled locally.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. User Login and Counselor Login use fictional profiles without passwords. On desktop, the sidebar selector switches roles. On mobile, return to `/login` to select the other role.

## Included

- User dashboard, written check-ins, explicitly simulated voice transcripts, review and submit, chronological history with private details, supervisor information, profile and logout.
- Shared two-way session messaging: send from one role and switch to the other to see it.
- Counsellor dashboard, searchable users, continuity details, alerts with review actions, and per-user messages.
- Role-aware route guards, responsive navigation, labelled inputs and visible keyboard focus.

## Prototype boundaries

Mock authentication is not security. All data exists in the browser's memory; refresh resets session changes. Do not use real sensitive information. Supervisor-facing adapters allowlist continuity fields and omit raw reflections. A production service must enforce authentication, authorization and data separation on the server.

New check-ins receive a neutral acknowledgement, not inferred clinical analysis. Seeded qualitative states and trends are fictional, static examples. Voice loads an editable sample transcript and never accesses the microphone. Messages are local and never sent to a real professional.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

The production output is `dist/`. Configure any production host to serve `index.html` for app routes. No lint command is configured.

The product specifications in `docs/` are updated to reflect a wellbeing service for everyone. Application routing lives in `src/app`, service adapters in `src/api`, shared state in `src/store`, mock fixtures in `src/data/mock`, and user journeys in `src/features` and `src/pages`.

