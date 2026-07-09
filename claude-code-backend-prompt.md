# Claude Code Prompt — Lifeline Backend + Database

Copy everything below the line into Claude Code (run it inside the `lifeline-native`
project folder, which already contains a `/backend` starter and a Prisma schema you
should review and extend).

---

## Context

I'm building **Lifeline**, an ambulance-booking **marketplace** (like Grab, but for
ambulances) for the Malaysian market. There are three sides:

1. **Patient app** (React Native / Expo — already scaffolded) — a patient requests an
   ambulance and is shown nearby operators with prices to choose from.
2. **Operator app** (to be built later) — ambulance operators receive, accept/decline,
   and fulfil requests.
3. **Admin dashboard** (to be built later) — I vet and manage operators.

You are building the **backend API and database** that all three will share. There is a
starter in `/backend` (Express + Prisma + PostgreSQL) and a starting `schema.prisma` —
review them, then extend/refactor as needed to meet the spec below. Keep the existing
stack (Node + Express + Prisma + PostgreSQL) unless you have a strong reason to change it.

## Key business rules (important — these shape the design)

- **Operators have a FIXED base location** (lat/lng). The patient is matched to operators
  whose base is **within 5–10 km** of the pickup point, ranked nearest first.
- **Operators set their OWN fixed rates** (a base fare; optionally a per-km rate). The
  price shown to the patient comes from the operator, not a platform formula.
- **Marketplace accept/decline flow**: when a patient picks an operator, that operator
  must **accept or decline within a time window (default 60s)**. If they decline or time
  out, the request moves to the next nearest operator. The patient can also **cancel** or
  **skip to the next operator** at any time while waiting.
- **Auth**: patients can continue as **guest** OR sign in with **Google / Apple**.
  Operators have their own accounts. Build auth so guest sessions can later be upgraded
  to a real account.
- This handles **patient medical data** and **emergency dispatch** — treat data security
  and reliability as first-class. Don't store raw card data; integrate a payment provider
  later (stub it for now).

## What to build (backend scope)

### 1. Database schema (Prisma + PostgreSQL)
Design tables for at least:
- **users** (patients) — support guest + Google/Apple identity; phone, name, email.
- **operators** — company name, base lat/lng, service radius, base fare, per-km rate,
  fleet/equipment summary, vetting status (pending/approved/suspended), active flag.
- **ambulances** — belong to an operator; type (ALS/BLS/Neonatal), equipment, plate.
- **crew** — drivers/paramedics belonging to an operator (optional for v1).
- **bookings** — pickup + destination (name/lat/lng), distance, the patient medical
  snapshot (age, gender, conscious level, oxygen + flow, IV, diagnosis), chosen operator,
  price breakdown (subtotal, service fee/commission, total), payment method + status,
  and a **status enum**: requested → offered → accepted → enroute → arrived → onboard →
  completed → cancelled → declined → expired.
- **booking_offers** — tracks which operators a booking was offered to and the outcome
  (pending/accepted/declined/timed_out), so the "move to next operator" logic has history.
- **tracking_events** — timeline entries for a booking (label, optional lat/lng, time).

Add sensible indexes, especially a **geospatial-capable index** on operator base location
(use PostGIS if you think it's worth it, or a bounding-box + Haversine approach if you want
to keep it simple — your call, explain the tradeoff).

### 2. API endpoints (REST, JSON)
**Auth**
- Guest session creation
- Google / Apple sign-in (verify the provider token, create/find user)
- Operator login

**Patient side**
- `POST /bookings/quote` — given pickup + destination + patient details, run the
  **nearest-operator search** (within 5–10 km, ranked) and return the list of eligible
  operators each with their computed price and ETA estimate.
- `POST /bookings` — create a booking for a chosen operator; create the first
  booking_offer; set status `offered`.
- `POST /bookings/:id/skip` — patient skips current operator → offer to next nearest.
- `POST /bookings/:id/cancel` — patient cancels.
- `GET /bookings/:id` — current state, chosen operator, price, status.
- `GET /bookings/:id/tracking` — the tracking timeline.

**Operator side**
- `GET /operator/requests` — incoming offers for this operator.
- `POST /operator/offers/:id/accept` and `/decline`.
- `POST /bookings/:id/status` — operator advances status (enroute/arrived/onboard/completed).
- Operator online/offline + availability toggle.

**Admin**
- Approve/suspend operators; list bookings.

### 3. The matching + offer engine (the core logic)
- A service that, given a pickup point, finds operators within the radius, ranks by
  distance, and computes each one's price from THEIR rates.
- An **offer lifecycle**: offer → wait for accept within the timeout → on decline/timeout/
  skip, automatically offer to the next nearest operator → if none remain, mark the booking
  `expired` so the app can show the "call 999" fallback.
- Consider how the timeout fires server-side (a job/timer) so it works even if the patient
  app is backgrounded.

### 4. Realtime (so the apps stay in sync)
- Add WebSocket (Socket.IO) channels so the patient sees accept/decline/status changes
  live, and operators get pushed new requests. Polling is an acceptable v1 fallback if you
  document it, but realtime is strongly preferred for the accept/decline race.

### 5. Seed + docs
- A seed script with ~5 demo operators at real Klang Valley coordinates, each with
  different rates and fleets, plus sample ambulances.
- A README documenting: how to run locally (DB, migrations, seed, dev server), the env
  vars, every endpoint with example request/response, and the booking status state machine.
- Provide a `docker-compose.yml` for Postgres so I can run it locally easily.

## How I want you to work
1. First, **read the existing `/backend` and `schema.prisma`**, then propose the updated
   schema and a short architecture plan. Wait for my OK before generating everything.
2. Build incrementally: schema + migrations first, then the matching engine, then
   endpoints, then realtime, then seed + tests.
3. Write a few **integration tests** for the critical path: quote → book → offer →
   decline → re-offer to next → accept → status updates → complete.
4. Keep secrets in `.env` (never commit them). Add `.env.example`.
5. Flag anywhere that needs a real human decision (payment provider, Google/Apple
   verification keys, medical-data compliance) rather than silently stubbing it.

## Out of scope for now
- Don't build the operator app or admin dashboard UIs yet — just the API + DB that serve
  them. The patient app (Expo) is already scaffolded and will be wired to these endpoints
  next.
