# BUILD-PLAN.md — Lifeline: App + Backend with Claude Code

> The master plan. Work through the phases in order, one Claude Code session per phase
> (roughly). Each phase has: a goal, the prompt to paste, and "done when" criteria.
> After every phase: commit to git, update HANDOFF.md.

**Ground rules for every session**
1. Start each session with: *"Read CLAUDE.md, HANDOFF.md and BUILD-PLAN.md. Tell me the
   current state and confirm which phase we're on before doing anything."*
2. Claude Code must **propose a plan and wait for OK** before large changes.
3. Commit after each working chunk: `git add . && git commit -m "..."`.
4. End each session with: *"Update HANDOFF.md with what we did, decisions made, and the
   next step."*
5. Human-decision items (payments, Google/Apple keys, medical-data compliance) get
   **flagged, not stubbed silently**.

---

## Phase 0 — Get the scaffold running (½ session)

**Goal:** the Expo app launches and the backend starter boots locally, so we build on a
known-working base.

**Prompt to paste:**
> Read CLAUDE.md, HANDOFF.md and BUILD-PLAN.md. We're on Phase 0. Get this scaffold
> running: (1) install app dependencies and start Expo, fix any version/config errors;
> (2) set up the backend: docker-compose for Postgres if missing, install deps, run the
> existing Prisma migration, boot the server; (3) tell me exactly how to open the app in
> Expo Go on my phone and hit the API health check. Fix whatever breaks. Don't add
> features yet.

**Done when:** app opens in Expo Go, `GET /` on the backend returns ok, first commit made.

---

## Phase 1 — Backend + database (2–3 sessions) ← the big one

**Goal:** the full marketplace API per `claude-code-backend-prompt.md`.

**Prompt to paste:** the entire contents of **claude-code-backend-prompt.md** (already in
this repo / your downloads). It covers: schema (users, operators, ambulances, bookings,
booking_offers, tracking_events), the nearest-operator search (5–10 km, ranked), the
offer engine (60s accept window → decline/timeout/skip → next operator → expired → 999
fallback), REST endpoints for patient/operator/admin, Socket.IO realtime, seed data
(5 Klang Valley operators), docker-compose, tests, README.

**Session split suggestion:**
- 1a: schema + migrations + seed → review the schema before approving.
- 1b: matching engine + offer lifecycle + booking endpoints + integration tests.
- 1c: operator/admin endpoints + Socket.IO realtime.

**Done when:** the integration test passes for: quote → book → offer → decline → re-offer
→ accept → status updates → complete. Seed gives 5 operators. README documents every
endpoint.

---

## Phase 2 — Patient app: wire and finish (2 sessions)

**Goal:** the patient app talks to the real backend and gains its missing screens.

**Prompt to paste:**
> Read CLAUDE.md, HANDOFF.md, BUILD-PLAN.md — we're on Phase 2. The backend from Phase 1
> is running. Wire the Expo patient app to it and build the missing screens:
> 1. **Login screen** — Continue as Guest (creates guest session), plus Google and Apple
>    sign-in buttons. Implement guest fully; for Google/Apple, build the UI and flow but
>    FLAG where real provider keys are needed — do not fake verification.
> 2. **Operator list** — replace the demo UNITS screen: call `POST /bookings/quote` with
>    pickup + destination + patient details; render real nearby operators ranked by
>    distance with THEIR prices and ETA. Handle the empty case → "call 999" screen.
> 3. **Waiting screen** (new) — after choosing an operator: live count-up timer, operator
>    card, and two always-visible buttons: **Cancel** (POST /bookings/:id/cancel) and
>    **Skip to next** (POST /bookings/:id/skip). Subscribe to the booking via Socket.IO;
>    on accept → go to Payment; on decline/timeout → auto-advance to next operator with a
>    brief notice; on no-operators-left → 999 fallback screen.
> 4. **Tracking** — subscribe to tracking events; render the live timeline; show crew and
>    unit from the accepted operator.
> Keep the existing visual style (theme.js tokens). Update the API client as needed.
> Propose your plan first.

**Done when:** on a phone with Expo Go, I can: sign in as guest → set pickup/destination →
enter patient details → see real seeded operators with prices → pick one → watch the
waiting screen → (simulate accept via an API call or a dev tool) → pay (stub) → see
tracking update live. Cancel and Skip both work.

---

## Phase 3 — Operator app (2 sessions)

**Goal:** the second app: operators receive and fulfil requests.

**Prompt to paste:**
> We're on Phase 3. Build the **operator app** as a second Expo app in `/operator-app`
> (same repo), sharing brand tokens. Screens per the operator flow in HANDOFF/CLAUDE:
> 1. Operator login (against Phase 1 operator auth).
> 2. Home: **online/offline toggle**, today's summary.
> 3. **Incoming request** screen: push/socket-driven, shows patient condition summary,
>    pickup→destination, distance, payout; big Accept / Decline with a 60s countdown.
> 4. **Active trip**: assign crew + unit (from the operator's fleet), then status buttons
>    that advance the booking: En Route → Arrived → Patient Onboard → Completed. Each
>    posts to the backend and appears on the patient's tracking screen.
> 5. Trip history + earnings list (simple).
> Use Socket.IO for incoming requests. Propose your plan first.

**Done when:** with two phones (or a phone + simulator), a real end-to-end demo works:
patient requests → operator phone rings with the request → accept → status updates flow
to the patient's tracking screen → complete.

---

## Phase 4 — Admin dashboard (1 session)

**Goal:** you can vet operators and watch bookings.

**Prompt to paste:**
> Phase 4: build a minimal **admin web dashboard** in `/admin` (React + Vite is fine),
> talking to the Phase 1 admin endpoints. Pages: (1) Operators — list with vetting status,
> approve/suspend buttons, view rates & fleet; (2) Bookings — live table with status,
> operator, price; (3) simple login for me. Keep it plain and functional. Propose plan
> first.

**Done when:** I can approve a pending operator and immediately see them appear in the
patient app's quote results.

---

## Phase 5 — Deploy for pilot (1 session)

**Goal:** everything reachable outside your laptop, ready to demo to operators.

**Prompt to paste:**
> Phase 5: prepare deployment. (1) Backend + Postgres to **Railway** (or Render) — env
> vars, migrations on deploy, seed instructions; (2) point the apps' apiBaseUrl at the
> deployed URL via env/app config; (3) set up **EAS build** profiles so I can create
> installable dev builds of both apps and share via TestFlight/internal testing; (4) the
> admin dashboard to Netlify/Vercel. Walk me through each account/key I must create
> myself, step by step. Do not handle real payment keys.

**Done when:** patient app on your phone (dev build) completes a booking against the
hosted backend; an operator phone receives it; admin dashboard shows it.

---

## Human-decision checklist (do NOT let these get stubbed silently)

- [ ] Payment provider choice + keys (Stripe / iPay88 / Billplz) — real integration later.
- [ ] Google & Apple sign-in credentials (Google Cloud + Apple Developer accounts).
- [ ] Google Maps API key for production map quality (optional for pilot).
- [ ] Medical-data / PDPA compliance review before any real patient data.
- [ ] Operator agreement + commission % (business, not code) — the *mechanism* now
      exists (admin dashboard → Settings, flat RM or % of fare, takes effect
      immediately on new offers), but the actual number/model is still undecided.
- [ ] Apple Developer ($99/yr) + Google Play ($25) accounts before store builds.

## Order rationale (why this sequence)

Backend first because the missing patient screens (operator list, waiting state) can't be
built against nothing. Patient app second because it's 70% done and proves the loop.
Operator app third because a live two-phone demo is your strongest pitch to operators.
Admin fourth because you can fake vetting via seed until then. Deploy last, before real
operator conversations move to pilots.
