# Lifeline — Brochure Design Handoff

**Prepared:** 18 September 2026 · **Audience:** ChatGPT (brochure design) and the Lifeline founder
**Source:** direct audit of the current codebase — no source code was modified to produce this document.

> **Read section 14 before writing any marketing copy.** Several things a brochure would
> normally claim about an ambulance app (live GPS tracking, verified licensing, live card
> payments) are **not** true of Lifeline today. Everything in this document is marked as
> either implemented or not, with the file that proves it.

---

## 1. Lifeline Overview

**What it is.** Lifeline is an ambulance-booking marketplace for Malaysia — the same idea as
Grab, but for private ambulances. A patient or family member opens the app, says where they
are and where they need to go, sees the private ambulance operators nearby with each
operator's own price and estimated arrival time, picks one, and follows the job's progress
until the ambulance arrives and the trip is done.

**Who it is for.**
- **Patients and families** needing urgent or planned medical transport.
- **Private ambulance operators** — small and mid-size companies that own ambulances and
  employ paramedics, and who currently rely on phone calls and word of mouth for work.
- (Not yet built for, but a natural next audience: hospitals, clinics and nursing homes that
  arrange transfers on a patient's behalf.)

**The problem it solves.** In the Klang Valley, getting a private ambulance today means
phoning around individual companies, with no way to know who is closest, who is free, or what
it will cost until you are already on the phone in a crisis. Operators, meanwhile, have no
shared demand channel. Lifeline puts both sides in one place: the patient sees availability
and price up front, and the operator receives jobs without advertising.

**Launch market.** Klang Valley, Malaysia — Klang, Shah Alam, Petaling Jaya, Subang, Cheras
and Kuala Lumpur. Prices are in Malaysian Ringgit (RM), and the app is built around Malaysian
payment methods (Touch 'n Go eWallet, DuitNow QR, FPX online banking, cards).

**How the two sides connect.** The patient chooses a preferred operator, and the platform
sends that operator an offer with a countdown (60 seconds by default). If they accept, the job
is theirs. If they decline, or the countdown runs out, the offer passes automatically to the
next-nearest eligible operator, and so on. If nobody is left, the app tells the patient
plainly to call 999.

**Main value proposition.**
- For patients: *see who can come, what it costs, and how far away they are — before you
  commit.* Transparent pricing instead of a phone quote under stress.
- For operators: *paid jobs delivered to your phone,* with no marketing spend, plus a simple
  wallet where the platform's commission is settled automatically.

---

## 2. Patient App — Complete User Journey

Every step below is implemented. Screen names are the actual navigation routes
(`App.js:166-181`); files are under `src/screens/`.

### Step 1 — Sign in · `Login` · `LoginScreen.js`
- **Purpose:** get into the app with as little friction as possible.
- **Shows:** Lifeline logo, "Every second counts.", three options.
- **Actions:** **Continue as Guest** (works, and is the emergency-fast path — no account, no
  password); **Continue with Google** / **Continue with Apple** (present but **not
  functional** — see §3).
- **Next:** Home.

### Step 2 — Home · `Welcome` · `WelcomeScreen.js`
- **Purpose:** choose the kind of transport needed.
- **Shows:** a greeting, a large **Request Ambulance** card, two secondary cards
  (**Schedule Transport**, **Patient Transfer**), and a "LIVE OVERVIEW" strip with three real
  numbers: average response time, active ambulances, hospitals listed. A red **Emergency? Call
  999** bar sits at the bottom of the scroll.
- **Actions:** start an emergency request, start a transfer, schedule for later, or use the
  bottom tabs (Home · Trips · Activity · Profile).
- **Next:** Location (or Schedule first, for a future booking).

### Step 3 — Set the route · `Location` · `LocationScreen.js`
- **Purpose:** confirm pickup and choose destination.
- **Shows:** a Google map with the pickup pin, the detected current address, a destination
  slot, and a shortlist of nearby hospitals.
- **Actions:** use current location or search an address (`AddressPicker`); choose a hospital
  from the curated list of 16 Klang Valley hospitals (`HospitalPicker`, `src/lib/hospitals.js`);
  **Confirm route**.
- **Next:** Patient Assessment.

### Step 4 — Patient assessment · `Assess` · `AssessScreen.js`
- **Purpose:** tell the crew what they are coming to, so they bring the right equipment.
- **Shows / collects:** age, sex, conscious level (fully conscious / semi-conscious / sedated
  / unconscious), oxygen support and flow rate, IV therapy, diagnosis type (RTA or other),
  free-text special request.
- **Next:** Available Ambulances.

### Step 5 — Compare operators · `Ambulances` · `AmbulancesScreen.js`
- **Purpose:** the heart of the marketplace — choose who comes.
- **Shows:** a map with a price pin per operator, then a sortable list (**Fastest ETA**,
  **Lowest price**, **Nearest**). Each card carries the operator's name, fleet summary
  (e.g. "1 ALS, 1 BLS"), star rating or "New", ETA, distance, and total price. A "BEST MATCH"
  tag marks the top result, and a line states *"Prices set by each operator. Life-threatening?
  Call 999."*
- **Actions:** sort, select, **Request this unit**.
- **Next:** Confirm & Pay.

### Step 6 — Confirm and pay · `Review` · `ReviewScreen.js`
- **Purpose:** final review and payment choice. This is where the booking is actually created.
- **Shows:** route, chosen operator, the patient summary entered earlier, payment options, and
  a fare breakdown — **Subtotal + Service Fee = Total**.
- **Payment options:** **Cash — pay the crew directly** (emergencies only), **Pay online —
  card / FPX** (hosted payment page), and **Link a card for one-tap payment** where a card is
  available.
- **Actions:** pick a method, **Confirm & Book**.
- **Next:** Requesting Your Unit. For online payment the phone opens the payment page first,
  and the operator is only told about the job **after** payment lands.

### Step 7 — Waiting for an operator · `Waiting` · `WaitingScreen.js`
- **Purpose:** the live race — one operator at a time, each with a countdown.
- **Shows:** "REQUESTING YOUR UNIT", a seconds-remaining counter, the operator being asked,
  the total price, and status text.
- **Actions:** **Skip to next operator**, **Cancel request**.
- **Next:** on acceptance, the confirmation screen. If every operator passes, the screen shows
  the **call 999** fallback.

### Step 8 — Booking confirmed · `Payment` · `PaymentScreen.js`
- **Purpose:** a confirmation receipt after an operator accepts. Despite the route name, this
  screen takes **no payment** — payment already happened at step 6. It shows the ambulance,
  method and fare, then **Continue to Tracking**.

### Step 9 — Follow the trip · `Tracking` · `TrackingScreen.js`
- **Purpose:** know what is happening, moment to moment.
- **Shows:** a live status banner ("Ambulance en route to you", "Ambulance has arrived",
  "Patient onboard", "Trip completed") with a LIVE pill; the assigned crew member and
  ambulance plate with a **call button**; and a timestamped **TRIP PROGRESS** timeline that
  fills in as the operator advances the job.
- **⚠ Not a map:** the map area is an explicit placeholder reading *"Live map — coming with
  operator live GPS"*. See §8.
- **Next:** on completion, the rating screen.

### Step 10 — Rate the trip · `Rating` · `RatingScreen.js`
- 1–5 stars plus an optional comment, once per completed trip. Feeds the operator's public
  average shown at step 5.

### Supporting screens
- **`Trips` (`TripsScreen.js`)** — every past and active booking with a status pill; tapping
  one reopens its timeline.
- **`Activity` (`ActivityScreen.js`)** — a combined feed of tracking events across bookings.
- **`Profile` (`ProfileScreen.js`)** — identity and sign out. Nothing else.
- **`Schedule` (`ScheduleScreen.js`)** — date/time picker for a future transport.

### Steps in the requester's example that do NOT exist
| Example step | Reality |
|---|---|
| "Registration" | No sign-up form, no password, no profile creation. Guest only (Google/Apple are non-functional). |
| "Select ambulance/service requirements" | The patient never picks ALS/BLS/Neonatal. They answer clinical questions; the operator decides the vehicle. |
| "Live ambulance tracking" (map) | **Not implemented.** Status timeline only — no vehicle position. |
| "Ambulance arrives / trip begins" as patient actions | These are *operator*-driven status updates the patient watches. |
| "Receipt" | The confirmation screen acts as a receipt on screen. There is **no PDF, emailed or downloadable receipt, and no invoice.** |

---

## 3. Patient App Features

### Currently implemented
- Guest sign-in (instant, no account).
- Emergency request, non-emergency **Patient Transfer**, and **Scheduled Transport** for a
  future date and time (the operator search starts 45 minutes before pickup).
- Current-location detection, address search, and a curated 16-hospital destination list.
- Google Maps on the route screen and the operator map (native apps and web).
- Patient assessment capture (age, sex, consciousness, oxygen + flow, IV, diagnosis, special
  request), passed through to the operator's offer card.
- Real quotes from real nearby operators, with sorting by ETA, price or distance.
- Booking creation with server-calculated, server-trusted pricing.
- Pay-first checkout: cash (emergencies only), hosted online payment, or a saved card.
- Live 60-second offer countdown, **skip to next operator**, and **cancel**.
- Automatic cascade to the next-nearest operator on decline or timeout.
- "No operators left → call 999" fallback, and a permanent 999 shortcut on Home.
- Live status updates over a socket connection, plus a timestamped trip timeline.
- Crew name, role and vehicle plate once assigned, with a one-tap call button.
- Star rating and comment after completion.
- Trips list and activity feed, both from real data.
- Automatic refund when a paid booking is cancelled or nobody accepts (see §7 for the
  e-wallet timing caveat).
- Installable on iPhone as a web app (PWA) at `lifeline-ios.netlify.app`.

### Planned / incomplete — do not advertise
- **Google and Apple sign-in** — buttons exist; the backend returns "not configured" unless a
  development flag is on, and in that mode it trusts whatever the client claims without
  verification (`backend/src/routes/auth.routes.js:45-72`).
- **Live map tracking of the ambulance** — a labelled placeholder (`TrackingScreen.js:95-100`).
- **In-app notification centre** — the bell on Home shows "Notifications aren't available yet."
- **Profile management** — no name, phone, medical profile, saved addresses or emergency
  contacts; sign-out only.
- **Receipts / invoices** — nothing generated, stored, emailed or downloadable.
- **In-app chat with the crew** — none (phone call only).
- **Fare estimate before choosing a destination** — pricing needs both ends of the route.
- **Native iOS app** — iPhone users install the web app; no App Store build (no Apple
  Developer account yet).

---

## 4. Operator App — Complete Journey

Android app (`/operator-app`). Eight screens; the bottom bar shows Home · Trips · Wallet ·
Profile.

### Step 1 — Sign in · `OperatorLoginScreen.js`
- Email and password issued by the Lifeline admin. "Forgot password?" is **text only — it does
  nothing**, and there is no self-service sign-up.
- **Patient sees:** nothing.

### Step 2 — Home / go online · `HomeScreen.js`
- **Shows:** an online/offline switch, wallet balance, today's completed trips and gross
  earnings, fleet list with each ambulance marked Available or On trip, and active trips.
- **Action:** switch **Online**. Refused with a prompt to top up if the wallet is below the
  admin-set minimum (default RM50).
- **Status change:** none — availability only.
- **Patient sees:** an offline operator never appears in search results.

### Step 3 — Incoming request · `IncomingRequestsScreen.js`
- **Shows:** each live offer with a draining countdown bar, route, distance away, the patient
  summary (age, consciousness, oxygen), the payout, and tags for **TRANSFER**, **PREPAID** or a
  scheduled pickup time. The app force-opens this screen when an offer arrives, and a push
  notification is sent.
- **Actions:** **Accept** or **Decline**.
- **Status change:** Accept → `accepted`. Decline (or letting it expire) → `declined`, and the
  job passes to the next operator.
- **Patient sees:** on accept, the waiting screen turns into a confirmation with the operator's
  name, then the tracking timeline. On decline, the patient's screen keeps waiting while the
  next operator is asked.

### Step 4 — Assign vehicle and crew · `ActiveTripScreen.js`
- **Shows:** an ambulance list (plate + type) as single-choice, and a crew list (name + role)
  as multi-select — the operator decides who rides.
- **Action:** **Confirm assignment** (at least one ambulance and one crew member).
- **Status change:** none — deliberately separate.
- **Patient sees:** "Crew & Ambulance Assigned" in the timeline, and the crew name and plate
  with a call button.

### Step 5-8 — Drive the job · `ActiveTripScreen.js`
One button, relabelled at each stage: **Mark en route** → **Mark arrived** → **Patient
onboard** → **Complete trip**, with a five-dot progress stepper.
- **Status changes:** `enroute` → `arrived` → `onboard` → `completed`.
- **Patient sees:** the status banner and a new timeline entry for each, in real time.
- **On completion:** the wallet settles automatically (see §7), and the patient is asked to
  rate the trip.
- The screen also has a **call button** that dials the assigned paramedic — it does **not**
  call the patient; operators never receive a patient phone number.

### Step 9 — Trip history · `TripHistoryScreen.js`
- Completed trips with totals, average per trip, and This week / Month / All filters.

### Step 10 — Wallet and top-up · `WalletScreen.js`, `TopUpScreen.js`
- Balance, the current commission rate, the minimum balance to stay online, and the last 50
  ledger entries. Top-up presets (RM50–1000) open the payment provider's hosted page.

### Not in the operator workflow at all
- **No map, no navigation, no route guidance** — the app shows pickup and destination as
  *text*. Coordinates are sent by the server and discarded by the app.
- No patient contact details; no clinical detail after acceptance (it appears only on the offer
  card).
- No cancellation handling on the active-trip screen — if the patient cancels mid-trip, the
  screen does not explain it.
- No scheduled-jobs calendar; an accepted scheduled trip sits in "active trips" even if pickup
  is days away.

---

## 5. Operator App Features

### Currently implemented
- Email/password login issued by admin.
- Go online / offline, gated on a minimum wallet balance.
- Push notification and in-app alert for each new job offer, with a live countdown.
- Accept or decline; automatic pass to the next operator.
- Ambulance and multi-member crew assignment per job, changeable mid-trip.
- Four-step status progression driving the patient's live view.
- Today's trips and gross earnings, fleet availability, active trips list.
- Trip history with period filters and totals.
- Wallet ledger (top-ups, trip fares, commission, adjustments) with the platform's commission
  deducted automatically on completion.
- Self-service top-up through the payment provider's hosted page.
- Call the assigned paramedic.

### Planned / incomplete — do not advertise
- **Navigation / maps / live GPS** — none. See §8.
- **Forgot password** — dead text; resets are manual.
- **Operator self-registration** — "Apply to join Lifeline" is static text; admin creates
  accounts.
- **Withdrawals / payouts** — the ledger supports a withdrawal entry, but nothing in the app
  can request one and there is no payout schedule or bank-details screen.
- **Fleet and crew management** — vehicles and crew are seeded/admin data; the operator app
  cannot add or edit them.
- **Rate-card control in-app** — operators do not edit their own prices in the app (admin
  enters them).
- **Scheduled-jobs calendar**, **cancellation handling on the trip screen**, **document
  upload**, **in-app chat**, **iOS version**.

---

## 6. Booking Status Lifecycle

Actual status values (`backend/src/lib/constants.js:5-19`). This list is locked in the
project's own rules — do not invent or rename statuses in the brochure.

```
                 (online payment)                     (cash, emergencies only)
pending_payment ─────────────────┐                   ┌──────────────────────────
   │ money not received in 15 min │                   │
   ▼                              ▼                   ▼
cancelled                      requested ◄────────────┘
                                  │
                                  ▼
                               offered ──► declined ──► offered (next operator)
                                  │             │
                                  │             └──► expired  ("call 999")
                                  ▼
                               accepted ──► enroute ──► arrived ──► onboard ──► completed
                                  │
                                  └──► cancelled (patient cancels; refund if prepaid)
```

| Status | Plain English |
|---|---|
| `pending_payment` | Booking created, waiting for the patient's payment. **No operator can see it yet.** |
| `requested` | Paid (or cash) and ready to be offered. A scheduled trip waits here until 45 minutes before pickup. |
| `offered` | One operator has the job in front of them, with a countdown. |
| `declined` | That operator said no (or timed out); the search moves to the next-nearest. A brief in-between state, not a dead end. |
| `accepted` | An operator has committed. The patient now has a named company and price. |
| `enroute` | The ambulance is on its way to the pickup. |
| `arrived` | The ambulance is at the pickup point. |
| `onboard` | The patient is in the ambulance, heading to the destination. |
| `completed` | The trip is finished. Payment settles, and the patient is asked to rate it. |
| `cancelled` | Cancelled by the patient, or automatically because payment was not completed within 15 minutes. Prepaid bookings are refunded. |
| `expired` | Every eligible operator passed or timed out. The app tells the patient to call 999, and refunds any payment. |

**Offer-level statuses** (one per operator asked): `pending`, `accepted`, `declined`,
`timed_out`, `skipped` (patient skipped them), `cancelled`.
**Payment statuses:** `pending`, `paid`, `refunded` (a `failed` value exists in code but is
never used).

---

## 7. Pricing

**The formula** (`backend/src/services/pricing.js:7-12`) — calculated on the server, never
trusted from the phone:

```
subtotal = operator's base fare + (operator's per-km rate × distance in km)
service fee = Lifeline's platform fee
total = subtotal + service fee
```

- **Operators have their own rates.** Base fare and per-km rate are stored per operator, so
  prices genuinely differ between companies — that is what the comparison screen shows.
  **Nuance:** in the current software the **admin types those rates in** on the operator's
  behalf; there is no operator-facing rate editor. Seeded demo rates run RM120–180 base and
  RM6–9 per km.
- **Distance** is the straight-line distance between pickup and destination — **not** road
  distance. No routing service is connected.
- **Lifeline's service fee** is set by the admin and applies platform-wide: either a flat RM
  amount **or** a percentage of the subtotal. Default: **RM15 flat**. It is shown to the
  patient as a separate "Service Fee" line.
- **No other charges exist.** There is no surge pricing, no night rate, no waiting-time
  charge, no equipment surcharge, no cancellation fee, no minimum fare.
- **The price is locked when the offer is made.** If the job passes to a more expensive
  operator, the patient still pays the price they agreed.

**Payment timing — "pay first".** Non-cash bookings are paid **before any operator is told
about the job**. Cash is allowed for **emergencies only**; scheduled transports and patient
transfers must be paid in the app.

**Payment methods.** Through the payment gateway's hosted page: Touch 'n Go eWallet, DuitNow
QR, FPX online banking and cards (exactly which appear depends on what the merchant account has
enabled — at the time of writing, Touch 'n Go is switched on). A patient may also link a card
for one-tap payment, which currently works on the Stripe path only.

**⚠ No real money has been taken yet.** Production runs the HitPay gateway in **sandbox**
mode, and Stripe is on **test keys**. Going live is a deliberate human step requiring business
registration. See §14.

**Who receives what.** For prepaid trips the operator is credited the full fare and the
commission is deducted as a separate line — two visible entries. For cash trips the crew keeps
the money and only the commission is deducted from the operator's wallet.

**Refunds and cancellations.** Cancelling refunds the patient **in full** — there is no
cancellation fee in this version. The same happens when no operator accepts. Refunds are
automatic. **One caveat:** Touch 'n Go charges can only be refunded after the gateway confirms
them (about two working days in Malaysia), so an immediate cancellation is retried
automatically, hourly, until it goes through.

**Unpaid bookings** are cancelled automatically after 15 minutes.

---

## 8. Live Location & Tracking

### What genuinely works
- **Patient location:** detected by GPS or entered by address search, shown on a Google map.
- **Destination:** chosen from 16 curated Klang Valley hospitals, or any searched address.
- **Nearby operator search:** operators are matched from their **registered base address**
  within their own service radius (up to 10 km), nearest first.
- **Live status updates:** a real-time socket connection pushes every status change and
  timeline entry to the patient's phone the moment it happens — no refreshing.
- **Trip timeline:** a timestamped, permanent record of each step (requested, offer sent,
  accepted, crew assigned, en route, arrived, onboard, completed).
- **Map provider:** Google Maps (native apps and web).
- **Distance:** straight-line between pickup and destination.
- **ETA:** straight-line distance from the operator's base ÷ an assumed average speed of
  **40 km/h**, shown before booking only.

### What does NOT exist — this is the single most important accuracy point
- **There is no live GPS tracking of the ambulance.** The operator app never reads or sends
  its location; the platform stores no vehicle position; the patient's map area is an explicit
  placeholder reading *"Live map — coming with operator live GPS"*.
- **No moving vehicle on a map**, no "2 minutes away" countdown after acceptance, no route
  drawn between ambulance and patient, no turn-by-turn navigation for drivers.
- **ETA is not traffic-aware** and is not recalculated during the trip.
- Distances are straight-line, so real road distance (and therefore real driving time) will be
  longer.

**Safe wording:** "real-time trip updates", "live status timeline", "know exactly what stage
your ambulance is at". **Unsafe wording:** "track your ambulance on the map", "live GPS",
"watch it approach", "real-time location".

---

## 9. Safety & Trust

### Implemented
- **Operator approval gate.** Every operator has a status of pending, approved or suspended,
  and **only approved operators can receive any booking**. New operators start as pending.
- **Suspension** takes an operator out of dispatch immediately.
- **Named crew and vehicle on every trip.** The patient sees the paramedic's name and role and
  the ambulance registration plate, with a one-tap call button.
- **Vehicle records:** plate (unique), type (ALS / BLS / Neonatal), equipment list, active flag.
- **Crew records:** name, role (driver or paramedic), phone.
- **Ratings and reviews:** 1–5 stars plus a comment, one per completed trip, enforced by the
  database; the average appears on the operator's card before booking.
- **Complete trip record / audit trail:** every booking keeps an immutable, timestamped event
  log of each step, including which operators were offered the job and who declined.
- **Wallet audit trail:** every balance movement has a matching ledger entry with the balance
  after it, and duplicate charges are impossible by database constraint.
- **Money-handling safeguards:** the payment path is protected against double-charging,
  double-dispatch and lost payments (verified under concurrent load), and unpaid bookings are
  cleaned up automatically.
- **Admin accounts** with individual logins, lockout after repeated wrong passwords, and the
  ability to disable a person's access instantly.

### NOT implemented — do not claim any of these
- **No document upload anywhere in the system.** No licences, permits, insurance certificates,
  registration papers or ID documents are collected, stored or verified.
- **No licensing or insurance data at all** — there is no field for a MOH/AMBDU registration,
  SSM company number, or insurance policy on any record.
- **No background checks** or identity verification for crew; no driver's-licence or medical
  certification fields.
- **No vehicle inspection, roadworthiness or equipment-expiry tracking** (the equipment list is
  free text).
- "Verification" in practice means **an administrator clicked Approve.** No checklist, evidence
  or reviewer is recorded.
- **No patient identity verification** — patients can be fully anonymous guests.
- **No emergency contacts, no SOS button, no location sharing with a family member.**
- **No incident reporting or complaints workflow.**
- **Medical-data compliance (PDPA) has not been reviewed** — retention, access control and
  encryption at rest are open questions flagged in the code itself.

---

## 10. Admin Platform

| Capability | Status | Detail |
|---|---|---|
| Admin login with individual accounts | **IMPLEMENTED** | Email + password, lockout after 5 failures, disable/enable, password reset by another admin. |
| Operator directory, search and filter | **IMPLEMENTED** | All operators with status counts (pending / approved / suspended). |
| Create an operator account | **IMPLEMENTED** | Name, email, password, phone, address, base location, service radius, base fare, per-km rate. |
| Edit operator details and rate card | **IMPLEMENTED** | Including base location and prices. Email/password cannot be edited. |
| Approve an operator | **IMPLEMENTED** | The gate that lets them receive bookings. |
| Suspend an operator | **IMPLEMENTED** | Immediate removal from dispatch. Re-approve to restore. |
| Operator wallet management | **IMPLEMENTED** | View balance and history; post top-ups, withdrawals or adjustments with a mandatory note. |
| Commission control | **IMPLEMENTED** | Flat RM or percentage, platform-wide, applied to the next booking. |
| Operator accept window | **IMPLEMENTED** | 15–300 seconds. |
| Minimum wallet balance to go online | **IMPLEMENTED** | RM0–1000; 0 disables the rule. |
| Booking monitoring | **PARTIAL** | Live table of the last 100 bookings with status, fare, operator and a live offer countdown, plus four KPI tiles (active now, completed, average accept time, 999 fallbacks). **View only** — no cancel, reassign, refund, or detail view, and no access to the trip timeline. |
| Operator applications / onboarding queue | **NOT IMPLEMENTED** | No application form or inbox; admins create accounts manually. |
| Vehicle and crew management | **NOT IMPLEMENTED** | No screen or API to add/edit ambulances or crew. |
| Document / licence verification | **NOT IMPLEMENTED** | Nothing is uploaded or stored. |
| Patient/user management | **NOT IMPLEMENTED** | No user list or lookup. |
| Disputes and complaints | **NOT IMPLEMENTED** | No workflow at all. |
| Refund controls | **NOT IMPLEMENTED** | Refunds are automatic on cancellation; there is no admin refund button. |
| Reports and exports | **NOT IMPLEMENTED** | No CSV, PDF or scheduled reports. |
| Analytics dashboard | **PLANNED** | The Analytics page is a single line reading "coming in a later phase". |
| Audit logs (admin actions) | **NOT IMPLEMENTED** | Booking and wallet histories exist, but admin actions themselves are not logged. |

---

## 11. Screens Recommended for the Brochure

| # | Screen | App | File / route | Purpose | Why it belongs |
|---|---|---|---|---|---|
| 1 | Home | Patient | `src/screens/WelcomeScreen.js` · `Welcome` | Entry point and service choice | One image says "this is an app for ambulances, and it is calm and simple" |
| 2 | Route & map | Patient | `src/screens/LocationScreen.js` · `Location` | Pickup + hospital destination | Shows real maps and the hospital shortlist |
| 3 | Patient assessment | Patient | `src/screens/AssessScreen.js` · `Assess` | Clinical details for the crew | Proves this is medical transport, not a taxi |
| 4 | **Compare ambulances** | Patient | `src/screens/AmbulancesScreen.js` · `Ambulances` | Operators, ETA, price | **The single most important screen** — the marketplace proposition in one view |
| 5 | Confirm & pay | Patient | `src/screens/ReviewScreen.js` · `Review` | Fare breakdown + payment choice | Price transparency and Malaysian payment methods |
| 6 | Requesting your unit | Patient | `src/screens/WaitingScreen.js` · `Waiting` | Countdown while an operator answers | Shows speed and the competitive dispatch model |
| 7 | Live tracking | Patient | `src/screens/TrackingScreen.js` · `Tracking` | Status + crew + timeline | Reassurance — but see the caption warning below |
| 8 | Trips | Patient | `src/screens/TripsScreen.js` · `Trips` | History of bookings | Records for families and insurers |
| 9 | Operator home | Operator | `operator-app/src/screens/HomeScreen.js` · `Home` | Online toggle, wallet, fleet | The operator-side pitch: jobs and earnings in one place |
| 10 | Incoming request | Operator | `operator-app/src/screens/IncomingRequestsScreen.js` | Offer card with countdown | Shows how fast and simple accepting work is |
| 11 | Active trip | Operator | `operator-app/src/screens/ActiveTripScreen.js` | Assign crew, advance status | Explains where the patient's live updates come from |
| 12 | Admin operators | Admin | `admin/src/pages/OperatorsPage.jsx` | Vetting and rate cards | For investor/partner audiences: the platform is managed, not a free-for-all |

---

## 12. Screenshot Package

**Captured and saved to `docs/brochure/screenshots/`.** These are real screenshots of the live
patient app (the production web build at `lifeline-ios.netlify.app`, at iPhone size, with real
data from the production database) — no mockups, no debug overlays.

| File | Screen |
|---|---|
| `01-patient-login.png` | Sign in |
| `02-patient-home.png` | Home with live overview stats |
| `03-patient-location.png` | Map, pickup detected, hospital shortlist |
| `04-patient-route-set.png` | Route confirmed, pickup → hospital |
| `05-patient-assessment.png` | Patient assessment form |
| `06-patient-operator-map.png` | **Compare ambulances** — map price pins + operator cards |
| `07-patient-review-payment.png` | Confirm & Pay — fare breakdown and payment methods |
| `09-patient-waiting-for-operator.png` | Requesting your unit, with countdown |
| `10-patient-operator-accepted.png` | The moment an operator accepts |
| `11-patient-live-tracking.png` | Live tracking — status, crew, plate, timeline |

**⚠ Caption warning for `11-patient-live-tracking.png`:** this screenshot visibly contains the
placeholder text *"Live map — coming with operator live GPS"*. Either crop that panel out or
caption the image around the timeline and crew details. **Never present it as map tracking.**

**Operator and admin screenshots were not captured.** The operator app is Android-only and
needs a physical device or emulator, which is not available in this environment. To produce
them, install the operator APK, sign in with a demo account, and capture: Home, Incoming
Requests (during a live offer), Active Trip, Wallet, Trip History. Design mockups exist at
`design_handoff_lifeline_operator/screenshots/` — these are **design references, not the built
app**, and should not be presented as product screenshots.

---

## 13. Marketing Messages

*(Every claim below is supported by working functionality — cross-checked in the fact-check
table.)*

### Main headline
**"Every second counts."** *(the product's existing tagline, already in the app and logo lockup)*

Alternatives: **"An ambulance, booked in minutes."** · **"Know who's coming, and what it costs."**

### Supporting statement
Lifeline connects patients and families in the Klang Valley with nearby private ambulance
operators — compare price and arrival time, book in the app, and follow every step of the trip.

### Five key benefits
1. **See the price before you book.** Every operator's fare is shown up front, with the service
   fee itemised — no phone quotes in a crisis.
2. **Choose who comes.** Compare nearby operators by arrival time, price or distance, and pick
   the one that suits.
3. **An answer in seconds.** Each operator has a 60-second window to accept; if they pass, the
   request moves on automatically — and if nobody can come, the app tells you to call 999.
4. **Know what's happening.** Live status updates from acceptance to arrival, with the crew
   member's name, the ambulance plate, and a button to call them.
5. **Pay the Malaysian way.** Touch 'n Go, DuitNow QR, online banking or card — or cash to the
   crew in an emergency.

### How Lifeline Works — four steps
1. **Tell us where you are and where you're going.**
2. **Compare nearby ambulances** — arrival time, price and operator.
3. **Book and pay in the app**, and an operator confirms in seconds.
4. **Follow every step** until the patient arrives safely.

### Operator-facing message
*"Jobs delivered to your phone."* Accept with one tap, assign your crew, and get paid — the
platform's commission settles automatically from your wallet, with every movement itemised.

---

## 14. Technical Accuracy Notes — what the brochure must NOT claim

1. **NO live GPS tracking or map tracking of the ambulance.** The single biggest risk. The app
   shows a status timeline; the map panel is a labelled placeholder. Never say "track your
   ambulance in real time on the map", "see the ambulance approaching", or "live location".
   *"Real-time status updates"* is accurate and safe.
2. **NO real payments have been processed.** The production payment gateway runs in **sandbox
   mode** and Stripe is on **test keys** — the platform has never taken real money. Going live
   requires business registration and a deliberate switch. Do not imply live transactions,
   payment volumes or "trusted by thousands".
3. **NO verified licensing, insurance or accreditation.** Nothing of the sort is collected or
   stored. Never claim "licensed", "certified", "insured", "MOH-approved", "background-checked"
   or "fully vetted". The honest claim is *"operators are approved by Lifeline before they can
   receive bookings."*
4. **NO real operators are live.** The operators in the system are **seeded demo companies**
   with fictional names (PJ Rapid Response, Klang Response Ambulance, etc.). Do not quote
   operator counts, coverage, fleet sizes or "partners" as real.
5. **NO usage statistics exist.** No trips completed, patients served, average arrival time or
   lives saved. The "average response time" shown in the app is the time an operator takes to
   **tap accept** — not how long an ambulance takes to arrive. Never present it as arrival time.
6. **ETAs are estimates from straight-line distance ÷ 40 km/h**, not traffic-aware routing, and
   they are not updated during the trip. Avoid "accurate ETA" or "precise arrival time".
7. **Google and Apple sign-in do not work.** Only guest access is real.
8. **iPhone has no App Store app.** iPhone users install a web app from Safari. Don't show an
   App Store badge or say "download on the App Store".
9. **Push notifications are not fully proven.** Android notifications are configured; iOS push
   needs an Apple Developer account that does not exist yet.
10. **Refunds for e-wallet payments are not instant** — Touch 'n Go charges become refundable
    only after the gateway confirms them (about two working days). Don't promise "instant
    refunds".
11. **No receipts, invoices, reports or exports** are generated anywhere.
12. **No hospital, clinic or insurance integrations, and no corporate accounts.** There is no
    hospital-facing product; the hospital list is a curated address list only.
13. **No coverage claim beyond the Klang Valley**, and even there, coverage depends on an
    operator being within 10 km of the pickup and online.
14. **No 24/7 claim.** Availability is whatever operators choose by toggling online.
15. **No ambulance-type choice for patients** (ALS/BLS/Neonatal) — the operator decides.
16. **Compliance with PDPA / medical-data rules has not been assessed.** Avoid any privacy,
    security or compliance certification claim.

---

## 15. Current Brand Assets

| Asset | Path |
|---|---|
| Logo lockup (symbol + "Lifeline") | `assets/brand/lifeline-lockup.png` |
| Symbol / mark only | `assets/brand/lifeline-mark.png` |
| Operator lockup ("Lifeline Operator") | `operator-app/assets/brand/lifeline-lockup.png` |
| Operator symbol (pin + headset badge) | `operator-app/assets/brand/lifeline-mark.png` |
| Patient app icon (1024²) | `assets/icon.png` |
| Operator app icon (1024²) | `operator-app/assets/icon.png` |
| Splash logo — patient / operator | `assets/splash.png` · `operator-app/assets/splash.png` |
| Web / PWA icons | `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png` |
| Admin dashboard logo | `admin/src/assets/brand/lifeline-mark.png` |
| **Original masters (highest quality — use these for print)** | `assets/brand/source/patient-icon.png`, `operator-icon.png`, `patient-lockup.png`, `operator-lockup.png` |

**Brand colours** (`src/theme/theme.js`):

| Role | Hex |
|---|---|
| Primary teal | `#1F8A8F` |
| Deep teal (gradient end, prices) | `#12545C` |
| Navy (headings, icon background) | `#14233F` |
| Soft teal (tints) | `#EAF4F3` |
| Background | `#F7FAFA` |
| Alert red (999, errors) | `#E5484D` |
| Success green | `#22A55B` |

**Fonts** — **Poppins** (600–800) for headings, numbers and the wordmark; **Plus Jakarta Sans**
(400–700) for body text and buttons. Both are free Google Fonts.

**Tagline:** *Every second counts.*

Do not create replacement logos — the artwork above is current as of 17 September 2026.

---

## 16. Recommended Brochure Story

For a reader who has never seen Lifeline, in this order:

1. **The problem, in one line.** "When you need an ambulance, you shouldn't have to phone
   around." One sentence, one image.
2. **What Lifeline is.** The marketplace idea in a sentence: nearby private ambulances,
   compared and booked in an app.
3. **How it works — four steps** (§13), with screenshots 03, 06, 07 and 11. This is the heart of
   the brochure; give it the most space.
4. **Why it's different: you choose.** Feature the compare screen (06). Price, arrival time and
   operator side by side is the thing nobody else offers.
5. **What happens after you book.** Confirmation, named crew and plate, live status updates,
   and the honest 999 fallback if nobody can come — this builds trust with families.
6. **Payment made local.** Touch 'n Go, DuitNow QR, online banking, card, or cash in an
   emergency.
7. **For ambulance operators** (a spread of its own, if the brochure serves both audiences).
   Jobs on your phone, one-tap accept, automatic commission, trip history. Screenshots 09–11
   from the operator app once captured.
8. **Built for the Klang Valley.** Local market, local payments, local hospitals.
9. **Close with the tagline and a call to action** — for patients, where to get the app; for
   operators, how to join (note: joining is currently a manual conversation, not a form).

**Tone:** calm, plain, reassuring. This is medical transport in stressful moments — the
brochure should feel like a competent paramedic, not a startup launch.

**Per audience:**
- **Patients and families** — lead with steps 1-5.
- **Ambulance operators** — lead with 7, then 4.
- **Hospitals / clinics** — be careful: there is no hospital-facing product yet. Position it as
  a way for their patients to arrange transport, not as an integration.
- **Investors / partners** — the marketplace mechanics (4), the operator economics (7), and the
  admin controls (§10) are the substance. Be candid that the platform is pre-launch.

---

# BROCHURE FACT CHECK

| Marketing Claim | Supported? | Evidence / Code Location | Notes |
|---|---|---|---|
| "Book a private ambulance from your phone" | ✅ Yes | Full flow `src/screens/` Welcome→Review; `POST /api/bookings` | Core function, works end to end |
| "Compare nearby operators by price and arrival time" | ✅ Yes | `AmbulancesScreen.js`; `POST /api/bookings/quote` | Real quotes, sortable |
| "Each operator sets their own price" | ✅ Yes | `services/pricing.js:7-12`; `Operator.baseFare/perKmRate` | True as a model; admin currently enters the rates |
| "See the total, including fees, before booking" | ✅ Yes | `ReviewScreen.js` fare breakdown | Subtotal + service fee + total |
| "An operator responds within 60 seconds" | ✅ Yes | `OFFER_TIMEOUT_SECONDS`, admin-settable 15–300s | Say "60-second window to accept", not "arrives in 60 seconds" |
| "If nobody is available, we tell you to call 999" | ✅ Yes | `expireBookingNoOperators`, `_EmergencyFallback.js` | A genuinely honest differentiator |
| "Real-time updates on your trip" | ✅ Yes | Socket.IO `booking:status_changed`, `tracking:event` | Status/timeline only |
| **"Track your ambulance live on a map"** | ❌ **NO** | `TrackingScreen.js:95-100` placeholder; no GPS anywhere in the operator app | **Never claim this** |
| "Live GPS location of the ambulance" | ❌ **NO** | No location endpoint; `TrackingEvent.lat/lng` always null | Never claim |
| "Know the crew and vehicle coming to you" | ✅ Yes | `TrackingScreen.js` crew + plate + call button | After the operator assigns them |
| "Call your ambulance crew" | ✅ Yes | `Linking.openURL('tel:…')` | Calls the operator's listed number |
| "Pay with Touch 'n Go, DuitNow QR, FPX or card" | ⚠️ Partly | HitPay integration verified with a sandbox TNG payment | **Sandbox only — no real money yet**; available methods depend on merchant activation |
| "Secure payment" | ⚠️ Careful | Hosted gateway pages; no card data stored on Lifeline servers | True as architecture; avoid implying live processing |
| "Cash accepted" | ✅ Yes | `bookings.routes.js` cash rules | **Emergencies only** — transfers and scheduled trips must prepay |
| "Pay only after an ambulance is confirmed" | ❌ No | Pay-first: payment precedes dispatch | The opposite is true |
| "Free cancellation with full refund" | ✅ Yes | `refundPrepaidBooking`, no cancellation fee | E-wallet refunds can take ~2 working days |
| "Instant refunds" | ❌ No | T+2 confirmation for TNG; hourly retry sweep | Say "automatic", never "instant" |
| "Schedule an ambulance in advance" | ✅ Yes | `ScheduleScreen.js`; 45-minute dispatch lead | Works |
| "Non-emergency patient transfers" | ✅ Yes | `bookingType: "transfer"` through the pipeline | Works |
| "Rate your experience" | ✅ Yes | `RatingScreen.js`; `Rating` model | One rating per completed trip |
| "See ratings before you choose" | ✅ Yes | Rating average on operator cards | Shows "New" until first rating |
| "Trip history you can refer back to" | ✅ Yes | `TripsScreen.js`, `ActivityScreen.js` | On screen only — no export or receipt |
| "Download a receipt / invoice" | ❌ **NO** | Nothing generates documents | Not implemented anywhere |
| "All operators are vetted before joining" | ⚠️ Careful | `vettingStatus` gate in `matching.js:17` | True: unapproved operators get no jobs. But vetting = an admin clicking Approve |
| **"Licensed, insured, certified operators"** | ❌ **NO** | No licence/insurance/document fields exist | **Never claim** |
| "Background-checked crew" | ❌ **NO** | `Crew` has name, role, phone only | Never claim |
| "ALS, BLS and neonatal ambulances" | ⚠️ Partly | `AMBULANCE_TYPE` exists; fleet summary shown | Real as vehicle data; the patient cannot choose a type |
| "Available 24/7" | ❌ No | Depends on operators toggling online | Never claim |
| "Covering the Klang Valley" | ⚠️ Careful | Seeded operators across KL/PJ/Klang/Shah Alam/Subang/Cheras; 10 km radius | Demo operators, not signed companies |
| "Trusted by X operators / Y trips completed" | ❌ **NO** | Seeded demo data only | No real usage exists |
| "Average response time of N minutes" | ❌ No | Stat = offer→accept seconds | Not arrival time; do not repurpose |
| "Available on iPhone and Android" | ⚠️ Partly | Android APK; iPhone = installable web app | No App Store listing or badge |
| "Sign in with Google or Apple" | ❌ No | Returns "not configured" | Guest access only |
| "Operators get jobs instantly on their phone" | ✅ Yes | Push + socket + auto-opening offer screen | Android push configured; iOS operator app doesn't exist |
| "Operators are paid automatically" | ⚠️ Careful | Wallet credits fare, deducts commission on completion | No payout/withdrawal mechanism exists yet |
| "Transparent commission for operators" | ✅ Yes | Wallet shows the current rate and every deduction | Admin-set, platform-wide |
| "Admin dashboard to manage the platform" | ✅ Yes | `/admin` — operators, bookings, settings, admin users | Analytics page is a placeholder |
| "Full analytics and reporting" | ❌ No | Analytics page = "coming in a later phase" | Four KPI tiles on the bookings page is the reality |
| "PDPA compliant / fully secure medical data" | ❌ **NO** | Compliance review outstanding | Never claim |
