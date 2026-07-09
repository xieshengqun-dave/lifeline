# CLAUDE.md — Lifeline

> This file gives Claude Code persistent context about the project. Read it at the start
> of every session. Keep it updated when architecture or conventions change.

## Session protocol (follow this automatically, every session)

1. **On session start:** read `HANDOFF.md` (current state) and `BUILD-PLAN.md` (the phase
   plan). State which phase we're on and what you understand the next step to be, then
   wait for confirmation before doing anything.
2. **Before large changes** (schema, new packages, restructures): propose a short plan and
   wait for approval.
3. **Commit often:** after each working chunk, `git add . && git commit -m "..."`. Never
   commit secrets; keep them in `.env`.
4. **Flag, don't stub:** payments, Google/Apple auth keys, Google Maps keys, and
   medical-data/compliance questions are human decisions — surface them, never fake them
   silently.
5. **On session end** (or when asked to wrap up): update `HANDOFF.md` — what changed,
   decisions made, and the single most important next step (newest entry on top).

## What this is

**Lifeline** is an ambulance-booking **marketplace** (like Grab, but for ambulances) for
the Malaysian / Klang Valley market. Tagline: "Every second counts."

Three sides to the product:
1. **Patient app** — React Native (Expo). A patient requests an ambulance and is shown
   nearby operators with prices to choose from.
2. **Operator app** — (not built yet) ambulance operators receive, accept/decline, and
   fulfil requests.
3. **Admin dashboard** — (not built yet) the founder vets and manages operators.

## Core business rules (these shape everything)

- Operators have a **fixed base location**. Patients are matched to operators whose base is
  **within 5–10 km** of pickup, ranked nearest first.
- Operators **set their own fixed rates** (base fare + optional per-km). The price shown to
  the patient comes from the operator, not a platform formula.
- **Accept/decline flow**: when a patient picks an operator, that operator must accept or
  decline within **60 seconds** (default). On decline/timeout, the request moves to the next
  nearest operator. The patient can **cancel** or **skip to next** at any time while waiting.
- **Auth**: patients can be **guest** or sign in with **Google / Apple**. Operators have
  their own accounts.
- If no operators remain, the app shows a **call 999** emergency fallback.

## Tech stack

- **Frontend (patient app):** Expo / React Native, React Navigation, react-native-maps,
  expo-location. State via React Context (`App.js`). Brand tokens in `src/theme/theme.js`.
- **Backend:** Node + Express + Prisma + PostgreSQL. Lives in `/backend`.
- **Realtime:** Socket.IO (for the accept/decline race + live tracking).
- **Web prototype:** a standalone HTML version exists separately (not in this repo) — it's
  the validated design reference. This repo is the real native build.

## Repo layout

```
/                  Expo patient app
  App.js           navigation stack + BookingContext (shared state)
  app.json         Expo config (icons, splash, permissions)
  src/screens/     one file per screen
  src/theme/       brand tokens, UNITS, fees
  src/api/         API client (talks to /backend)
  assets/          app icon, splash, favicon
/backend           Express + Prisma API
  prisma/          schema + migrations
  src/             server, routes, matching engine, seed
/docs              project docs (this lives in Obsidian too — see HANDOFF.md)
```

## Conventions

- **Brand colours:** teal `#0E8C8C`, navy `#0F172E`. Use tokens from `src/theme/theme.js`,
  never hardcode hex in screens.
- **Booking status state machine:** requested → offered → accepted → enroute → arrived →
  onboard → completed. Plus: cancelled, declined, expired. Never invent new statuses
  without updating this list and the backend enum together.
- Keep secrets in `.env`. Never commit them. `.env.example` documents what's needed.
- This is **emergency + medical software.** Be conservative: validate inputs, handle the
  "no operators" and "operator unreachable" cases explicitly, never silently swallow errors
  on the booking path.

## Important boundaries (need a human, don't silently stub)

- **Payments** — integrate a real provider (Stripe / iPay88 / Billplz) only with real keys
  and human sign-off. Never store raw card data.
- **Google / Apple auth** — needs real verification keys; flag when you reach it.
- **Medical-data handling & compliance** — patient condition data is sensitive; flag
  anything that needs a compliance/legal decision rather than guessing.

## Current state

See `HANDOFF.md` for what's done, what's in progress, and the next steps. Update HANDOFF.md
at the end of every working session.
