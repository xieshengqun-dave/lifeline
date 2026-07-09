# Claude Code — Ready-to-Paste Prompts

Copy these into Claude Code, in order. Adjust the stack names to match your repo.

---

## 0. Orientation (paste first, once)

> Read everything in `design_handoff_lifeline/` — start with `README.md`, then `DESIGN-TOKENS.md`, then the per-app spec files (`PATIENT-APP-SPEC.md`, `OPERATOR-APP-SPEC.md`, `ADMIN-DASHBOARD-SPEC.md`). The `.dc.html` files are pixel-perfect design references — open them in a browser to see the actual screens; the `screenshots/` folder shows each rendered. These are DESIGN references, not production code to copy: recreate them in our codebase using our existing patterns and components. Don't write any code yet — summarise the three surfaces and the design system back to me, then wait.

---

## 1. Design tokens / theme (do this before any screens)

> Set up our shared theme from `DESIGN-TOKENS.md`: the teal/navy palette, the Poppins + Plus Jakarta Sans fonts, spacing, radius, and shadow scales. Put them where our app expects theme values. Copy `assets/lifeline-lockup.png` and `assets/lifeline-mark.png` into our assets folder. Reserve red (#e5484d) strictly for the 999 / emergency path. Show me the theme file before moving on.

---

## 2. Patient App (Expo / React Native — change to your stack)

> Implement the Patient App per `PATIENT-APP-SPEC.md`, matching the design references pixel-for-pixel with our component library. Build in this order: (0) Home / post-login landing `2a`, (1) Sign in, (2) Set pickup & destination, (3) Patient & condition, (4) Operator list — use the approved `1a` card-led direction, (5) Waiting for accept, (6) Confirm & pay, (7) Live tracking — approved `1c` timeline direction, and the 999 fallback screen. The device bezel and status bar in the mocks are presentation only — build just the screen content. Propose a screen/navigation plan first. Flag anywhere you need real API keys (Google/Apple sign-in, maps, payments) instead of faking them.

---

## 3. Operator App

> Implement the Operator App per `OPERATOR-APP-SPEC.md` as a second Expo app sharing the same theme: Sign in, Home & online toggle, Incoming request (60s countdown), Active trip (assign crew/unit + advance status), Earnings & history. The status advance here is the source of truth for the patient's live-tracking timeline — wire them to the same booking state machine. Plan first.

---

## 4. Admin Dashboard (React + Vite — change to your stack)

> Implement the Admin Dashboard per `ADMIN-DASHBOARD-SPEC.md`: Sign in, Operators (vetting list + detail drawer with rate card & fleet + approve/suspend), and Bookings (live dispatch table with KPIs). Keep it plain and functional. The browser-window chrome in the mock is presentation only. Approving an operator must make them eligible in patient quote results. Plan first.

---

## Guardrails to keep fidelity

- Tell Claude Code your real stack in each prompt so it reuses existing components instead of inventing new ones.
- If it drifts from the spec, say: "Compare your screen against `screenshots/<file>.png` and the matching `.dc.html`, and fix the differences."
- Backend first: the dynamic screens (offer window, live tracking, 999 fallback, approve→quotes) assume the Phase 1 backend exists. If it doesn't, build that before the screens that depend on it.
- Build and review one surface at a time — don't ask for all three at once.
