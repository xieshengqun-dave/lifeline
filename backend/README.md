# Lifeline Backend

Express + Prisma + PostgreSQL API for the Lifeline ambulance-booking marketplace:
nearest-operator matching, the accept/decline offer lifecycle, and Socket.IO realtime,
serving the patient app (built) and the future operator/admin apps (Phase 3/4).

## Architecture

```
Patient app (Expo) ─┐
Operator app (Phase 3) ─┼─► this API ─► PostgreSQL
Admin dashboard (Phase 4) ┘        └─► Socket.IO (realtime accept/decline + tracking)
```

- **Matching**: bounding-box prefilter + exact Haversine distance in application code
  (`src/lib/geo.js`, `src/services/matching.js`) — not PostGIS. At pilot scale (single
  or low-double-digit operators) this is sub-millisecond and avoids ~11 extra Postgres
  extension dependencies. See "Upgrade paths" below for when this stops being true.
- **Offer engine** (`src/services/offerEngine.js`): in-memory timers for the 60s
  accept/decline window, with `BookingOffer.expiresAt` persisted as the real source of
  truth — a booted server recovers any pending offers and reschedules or immediately
  expires them, and a 15s sweep catches anything an individual timer missed.
- **Realtime** (`src/lib/socket.js`): Socket.IO rooms per booking and per operator.

## Prerequisites

- Node 20+
- PostgreSQL 16. Either:
  - **Homebrew** (what local dev on this project actually uses): `brew install postgresql@16 && brew services start postgresql@16`
  - **Docker**: `docker compose up -d` (see root `docker-compose.yml`) — not exercised on
    the primary dev machine (no Docker installed there), provided for parity/CI/other devs.

## Local setup

```bash
cd backend
npm install

createuser -U <your-macos-user> lifeline
psql -U <your-macos-user> -d postgres -c "ALTER USER lifeline WITH PASSWORD 'lifeline_dev_pw' CREATEDB;"
createdb -U <your-macos-user> -O lifeline lifeline

cp .env.example .env
# then fill in DATABASE_URL (matching the above), JWT_SECRET (generate one — see
# .env.example), ADMIN_API_TOKEN, and ALLOW_UNVERIFIED_SOCIAL_AUTH=true for local dev

npx prisma migrate dev
npm run seed     # 5 Klang Valley operators, ambulances, crew — login password: operator123
npm run dev       # http://localhost:4000
```

## Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PORT` | HTTP port (default 4000) |
| `JWT_SECRET` | Signs patient/operator bearer tokens |
| `OFFER_TIMEOUT_SECONDS` | Accept/decline window per offer (default 60) |
| `OFFER_SWEEP_INTERVAL_SECONDS` | Safety-net sweep interval for expired offers (default 15) |
| `PLATFORM_SERVICE_FEE` | Flat RM platform fee added to every booking — **TODO(human/business)**: not yet a % commission, confirm real structure with operators |
| `ADMIN_API_TOKEN` | Static shared secret for the 3 admin endpoints (no admin user table yet) |
| `ALLOW_UNVERIFIED_SOCIAL_AUTH` | Dev-only: lets `/api/auth/google`/`/apple` trust client-supplied identity without real verification |
| `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` | **TODO(human)**: needed for real Google/Apple token verification — not yet integrated |

## Running tests

```bash
createdb -U lifeline lifeline_test   # one-time
cp .env.test.example .env.test       # then fill in the same way as .env
npm test
```

Tests run against `lifeline_test` only — `resetDb()` refuses to run unless
`DATABASE_URL` contains `lifeline_test`, as a guard against wiping seeded dev data.

## Booking status state machine

```
requested → offered → accepted → enroute → arrived → onboard → completed
                ↕
            declined (transient — reused for operator-decline, timeout, AND
                       patient-skip; immediately followed by re-offer or expired.
                       The precise reason is preserved in BookingOffer.status and
                       the booking:status_changed socket event, not here.)
                ↓
             expired (no operators left — patient app shows the 999 fallback)

Also reachable any time before `accepted`: cancelled (patient-initiated)
```

This list is locked per the root `CLAUDE.md` — do not add/remove values here without
updating `CLAUDE.md` and `src/lib/constants.js` together.

## Offer lifecycle

1. `POST /api/bookings` offers the patient's chosen operator (or the next-best eligible
   one, if the chosen one is no longer eligible).
2. The operator has `OFFER_TIMEOUT_SECONDS` to accept or decline.
3. Decline, timeout, or patient skip all advance to the next nearest untried operator.
4. If none remain, the booking becomes `expired`.
5. A server restart recovers in-flight offers from `BookingOffer.expiresAt` (the
   persisted source of truth); a periodic sweep is a safety net beyond that.

## Socket.IO

Connect with `io(url, { auth: { token } })` using the same JWT as REST calls.

| Room | Joined by |
|---|---|
| `booking:{bookingId}` | Patient (via `join_booking` emit, ownership-checked), and the currently-offered/accepted operator (auto-joined server-side) |
| `operator:{operatorId}` | Operator, automatically on connect |

| Event | Room | Payload |
|---|---|---|
| `offer:created` | operator | `{ bookingId, offerId, sequence, dispatchDistanceKm, price, patientSummary, expiresAt }` |
| `booking:offer_operator` | booking | `{ bookingId, operator: {...}, expiresAt }` |
| `booking:status_changed` | booking | `{ bookingId, status, reason? }` |
| `tracking:event` | booking | `{ bookingId, event }` |

## API reference

All patient/operator routes require `Authorization: Bearer <token>`. Admin routes use
`Authorization: Bearer <ADMIN_API_TOKEN>`.

### Auth
- `POST /api/auth/guest` → `{ token, user }`
- `POST /api/auth/google` / `/apple` — `{ providerToken?, name?, email }` → `501` unless
  `ALLOW_UNVERIFIED_SOCIAL_AUTH=true`, in which case `{ token, user, devModeUnverified: true }`
- `POST /api/auth/upgrade` (patient auth) — same body as above, upgrades the guest in place
- `POST /api/auth/operator/login` — `{ email, password }` → `{ token, operator }`

### Patient
- `POST /api/bookings/quote` — `{ pickup: {name,lat,lng}, destination: {name,lat,lng}, patient? }` → `{ distanceKm, operators: [{operatorId, name, fleetSummary, dispatchDistanceKm, etaMinutes, price}] }`
- `POST /api/bookings` — `{ operatorId, pickup, destination, patient?, paymentMethod }` → `201 { id, status, operatorId, distanceKm, subtotal, serviceFee, total, currentOffer }`
- `POST /api/bookings/:id/skip` → updated booking
- `POST /api/bookings/:id/cancel` → updated booking
- `GET /api/bookings/:id` → booking with operator/ambulance/crew (sanitized, no password hash)
- `GET /api/bookings/:id/tracking` → tracking events, chronological

### Operator
- `GET /api/operator/requests` → pending offers for this operator
- `POST /api/operator/offers/:id/accept` / `/decline`
- `POST /api/operator/availability` — `{ online: boolean }`
- `POST /api/bookings/:id/status` — `{ status: "enroute"|"arrived"|"onboard"|"completed" }` — forward-only, must be the assigned operator

### Admin
- `GET /api/admin/operators`
- `POST /api/admin/operators/:id/approve` / `/suspend`
- `GET /api/admin/bookings` (latest 100)

## Known limitations / flagged human-decision items

- **Payment** (`src/services/payment.js`) — `chargeBooking()` is not implemented. No
  provider is integrated. Needs a human decision (Stripe/iPay88/Billplz + real keys)
  before any real charge happens.
- **Google/Apple auth** — no real token verification. `GOOGLE_CLIENT_ID`/`APPLE_CLIENT_ID`
  needed from real developer accounts.
- **ETA** (`src/services/pricing.js`) — straight-line distance + fixed average speed, not
  traffic-aware. Needs Google Directions/Distance Matrix API (a Maps key) for accuracy.
- **Medical data / PDPA** — patient fields in `Booking` are sensitive personal + health
  data. Retention/deletion policy, access control, and encryption-at-rest need a
  compliance/legal decision before real patient data is handled.
- **Commission model** — flat RM fee for now, not a % commission. Business decision
  pending.
- **Admin auth** — single shared-secret token, no admin user table. Pilot-only,
  intentionally minimal until Phase 4.
- **Geospatial matching** — bounding-box + Haversine, not PostGIS. Fine at pilot scale;
  revisit (PostGIS + `ST_DWithin` + GiST index) if operator count grows into the
  thousands or true polygon service areas are needed.
