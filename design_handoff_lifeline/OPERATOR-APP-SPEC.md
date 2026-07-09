# Operator App — Screen Spec

5 screens. Frame 390×844. Single Expo build shared with the patient app; this is the operator-facing surface. Status bar rules and "don't build the bezel" note are the same as the patient spec.

---

## 1 · Operator sign in
**Purpose:** Credentialed login for approved operators (no guest).
**Background:** dark gradient `linear-gradient(165deg,#14233f,#12545c)` + radial glow top-right.
**Layout:**
- Hero (centered ~96px from top): white 78px rounded tile with **pin mark**; "Operator Portal" (Poppins 800/26 white); subline "Sign in to start receiving ambulance requests near you." (15px, white 72%).
- **Bottom sheet** (white, radius 32 top):
  - Label "Operator ID or email" + field (mail icon, "ops@kvmedical.my").
  - Label "Password" + field (lock icon, dots, eye toggle).
  - "Forgot password?" right-aligned teal link.
  - Primary **"Sign in"** button (58px gradient).
  - Footer caption: "Approved operators only. New here? **Apply to join Lifeline**".

## 2 · Home & online toggle
**Purpose:** Go online to receive requests; see today's performance and fleet.
**Background:** `#f2f6f6`; fixed bottom tab bar.
**Layout:**
- Header: 46px gradient avatar "KV", "Good morning" / "KV Medical Response", notification bell tile.
- Scrollable body:
  - **Online card** — primary gradient, radius 22, card shadow. Left: mint status dot (glow ring) + "You're online" / "Receiving requests near you". Right: an **on** toggle (56×32 track, white knob right, teal-deep knob). This is the master availability switch.
  - **Today** stat grid (2×2 cards): **Trips** 6 · **Earnings** RM 870 (teal-deep) · **Acceptance** 92% · **Online** 5h 20m. Each: white card, faint label, Poppins 800/26 number.
  - **Your fleet** header + "2 of 3 available". Vehicle list card (rows divided):
    - WXX 4821 · ALS — green ambulance tile, **Available** (green).
    - WYY 1102 · BLS — **Available** (green).
    - WZZ 3390 · ALS — grey tile, **On trip** (faint), row dimmed.
- **Bottom tab bar** (white, 76px): **Home** (active teal, house icon), Trips (list icon), Earnings ($ icon), Profile (person icon). Inactive = faint.

## 3 · Incoming request · 60s
**Purpose:** Decide on a live request within a 60-second window.
**Background:** dark gradient `linear-gradient(180deg,#14233f,#0f3a42)`.
**Layout:**
- Top row: **NEW REQUEST** pill (teal-tint bg, mint dot + mint text) + countdown **"0:52"** (Poppins 800/28 white). Below: progress bar (track `rgba(255,255,255,.14)`, ~86% teal→mint fill) — depletes over 60s.
- **Condition card** (white, radius 22): severity row (amber square + "Serious") + "ALS needed" badge (teal); condition summary box (`#f7fafa`): "Chest pain & difficulty breathing · patient ~55, conscious · 1 patient". Then pickup→dropoff mini-timeline with distances: Pickup · 3.2 km away — "Menara KLCC, Jalan Ampang"; Drop-off · 8.2 km trip — "Gleneagles Hospital KL".
- **Payout card** (translucent on dark): "You earn" **RM 123** (Poppins 800/34 white) + "RM 145 fare · after 15% platform fee"; teal-tint $ icon tile. (Platform fee = 15%, per BUILD-PLAN.)
- Bottom actions: **"Accept request"** (64px, bright teal→deep gradient, check icon, Poppins 700/19) + **"Decline"** (ghost-on-dark outline).

## 4 · Active trip · assign & advance
**Purpose:** Assign the unit/crew and step the trip through its statuses.
**Background:** `#f2f6f6`; fixed footer on white.
**Layout:**
- Header: back button + "Active trip" / "#LFL-2841 · Serious" + **EN ROUTE** status badge (teal).
- Scrollable body:
  - **Assign row** (2 cards, both active teal border): **Unit** = "WXX 4821" ▾ / "ALS"; **Crew** = "A. Faiz +1" ▾ / "Paramedic". Both are dropdown pickers.
  - **Patient/route card**: header "Chest pain · breathing" + call & location icon tiles; pickup→dropoff mini-timeline.
  - **Trip status** stepper — 5 segments with labels: **Accepted** ✓, **En route** ✓ (both teal), Arrived, Onboard, Done (faint `#cfe0e2`). Advancing calls the status update.
- **Footer**: a square **call** button (56px, teal phone icon) + primary **"Mark arrived"** (58px gradient, trailing arrow). The CTA label changes per current status (Mark arrived → Patient onboard → Complete trip).

## 5 · Earnings & history
**Purpose:** Track income and past trips; see next payout.
**Background:** `#f2f6f6` with a teal gradient header band (top 280px).
**Layout:**
- **Header band** (gradient): "This week's earnings" (white 70%) + **RM 4,230** (Poppins 800/44 white). Meta row: Trips 28 · Next payout Fri, 4 Jul · Avg / trip RM 151.
- Scrollable body (overlaps band):
  - Range chips: **This week** (active navy) · Month · All.
  - **Trip history list** (white card, divided rows). Each row: status icon tile (green check = completed, red ✕ = declined), route + timestamp + tier, and right-aligned amount + status label:
    - KLCC → Gleneagles KL · Today 9:38 · ALS · **+RM 123** · Completed.
    - Ampang → HKL · Today 7:12 · BLS · **+RM 98** · Completed.
    - Bangsar → Pantai KL · Yesterday 21:04 · ALS · **+RM 140** · Completed.
    - Cheras → HKL · Yesterday 18:20 · **—** · Declined (red).

---

## Behavior notes specific to operator app
- **Online toggle** governs whether incoming-request pushes arrive; reflect on Home card + persist server-side.
- **60s window**: the incoming-request countdown and progress bar must be driven by the real offer expiry from the backend; on expiry auto-dismiss and free the operator for the next offer.
- **Status advance** on the active trip is the source of truth for the patient's live-tracking timeline (screen `1c`) — same state machine, mirrored views.
- **Payout math**: operator earning = fare − 15% platform fee. Show both the fare and the net.
