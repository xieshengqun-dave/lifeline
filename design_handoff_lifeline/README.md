# Handoff: Lifeline — Emergency Ambulance Marketplace

## Overview
Lifeline is an "Uber for ambulances" marketplace for the Klang Valley, Malaysia. Nearby ambulance operators compete on ETA and price for each request; patients pick a unit, pay in-app, and track the crew live. This handoff covers **two of the three surfaces**:

1. **Patient App** (mobile) — request an ambulance, compare operators, pay, track. ✅ Designed
2. **Operator App** (mobile) — go online, accept requests, assign crew/unit, push status. ✅ Designed
3. **Admin Dashboard** (web) — vet operators, monitor bookings. ✅ Designed (React + Vite)

The two mobile apps are a single cross-platform build (Expo / React Native); the admin dashboard is a separate React + Vite web app — per the project's BUILD-PLAN.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing the intended look, layout, and behavior. They are **not production code to copy directly.** They use a lightweight in-house component runtime (`support.js`) purely so the mock renders in a browser; ignore that runtime when implementing.

Your task is to **recreate these designs in the target codebase's environment.** Per the BUILD-PLAN the mobile apps are **Expo (React Native) + NativeWind/Tailwind** with a Supabase backend; the **admin dashboard is React + Vite** (web). If you build in a different stack, follow that stack's idioms — but match the visuals below pixel-for-pixel.

Each mobile app is one HTML file laying out every screen side-by-side on a canvas, wrapped in Android device frames. **The device frame (bezel, status bar, camera hole-punch) is presentation chrome only — do not implement it.** Build only the screen content inside each frame. The admin file wraps each screen in browser-window chrome (traffic lights + URL bar) which is **also presentation only** — build just the app inside.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and copy. Recreate pixel-perfectly using the codebase's component library. Exact hex, type, and spacing tokens are in `DESIGN-TOKENS.md`. Per-screen specs are in `PATIENT-APP-SPEC.md` and `OPERATOR-APP-SPEC.md`.

## Target platform notes
- **Framework:** Expo (React Native), single codebase for iOS + Android. Frames shown are Android; layouts are platform-agnostic.
- **Design frame:** 390 × 844 pt (logical). All measurements below are in px at that frame width — map 1:1 to dp/pt.
- **Backend:** Supabase (Postgres + Auth + Realtime + Edge Functions). Live tracking & request offers ride on Supabase Realtime channels.
- **Maps:** react-native-maps (Google provider). The mock's flat map illustration is a placeholder — use a real map tile layer.
- **Payments:** Malaysian rails — Touch 'n Go eWallet, FPX online banking, card. Use a local PSP (e.g. iPay88 / Billplz / Stripe MY).
- **Locale:** Currency `RM` (MYR), Klang Valley place names, national emergency number **999**.

## Documents in this bundle
- `README.md` — this file
- `CLAUDE-CODE-PROMPT.md` — ready-to-paste prompts for Claude Code, in build order
- `DESIGN-TOKENS.md` — colors, type, spacing, radius, shadows, iconography
- `PATIENT-APP-SPEC.md` — every patient screen, component-by-component
- `OPERATOR-APP-SPEC.md` — every operator screen, component-by-component
- `ADMIN-DASHBOARD-SPEC.md` — every admin screen, component-by-component
- `Lifeline Patient App.dc.html` — the patient design reference (open in a browser)
- `Lifeline Operator App.dc.html` — the operator design reference
- `Lifeline Admin Dashboard.dc.html` — the admin design reference
- `screenshots/` — rendered reference images of every screen
- `assets/` — the Lifeline logo lockup + pin mark (PNG)
- `support.js` — mock runtime (needed only to open the HTML; **not** for production)

## Assets
- `assets/lifeline-lockup.png` — full horizontal logo (mark + wordmark). Use in headers / splash.
- `assets/lifeline-mark.png` — pin mark only. Use as app icon base and compact header glyph.
These were supplied by the client. Export vector/higher-res versions for production; ask the client for the source SVG.

## Global interactions & behavior
- **Auth:** Patient app supports Guest / Google / Apple. Operator app is credentialed (approved operators only).
- **Request lifecycle:** patient requests → offer broadcast to nearby operators → each operator has a **60-second window** to accept → on accept, patient pays (funds held) → status advances (Accepted → En route → Arrived → Onboard → Completed) → charge captured on completion.
- **Realtime:** operator location and trip status stream to the patient's tracking screen; a "LIVE" pill indicates an active channel.
- **999 fallback:** if no unit accepts / none available, patient app surfaces a prominent red "Call 999 now" screen. Red (`#e5484d`) is reserved exclusively for this emergency path — never for normal UI.
- **Timers:** patient waiting screen shows a countdown ring for the current operator's accept window with Skip / Cancel; operator incoming-request screen shows the mirrored 60s countdown with Accept / Decline.

## Screens at a glance
**Patient App (8 screens + 2 variation directions):**
Login · Set pickup & destination · Patient & condition · Operator list (`1a`, card-led) · Waiting for accept · Confirm & pay · Live tracking (`1c`, timeline-led) · 999 fallback. Variations: `1b` map-first operator list, `1d` status-forward tracking. **Client approved `1a` and `1c` as the chosen directions.**

**Operator App (5 screens):**
Sign in · Home & online toggle · Incoming request (60s) · Active trip (assign & advance) · Earnings & history.

**Admin Dashboard (3 screens):**
Sign in · Operators (vetting, rates & fleet, approve/suspend) · Bookings (live dispatch table).

See the per-app spec files for full detail.
