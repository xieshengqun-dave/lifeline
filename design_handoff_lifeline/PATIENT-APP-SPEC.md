# Patient App — Screen Spec

8 core screens + a post-login **Home** screen + 2 variation directions. Frame 390×844. Client **approved `1a` (card-led operator list) and `1c` (timeline-led tracking)** as the chosen directions — build those; `1b`/`1d` are alternates kept for reference only.

Every screen has: iOS/Android status bar row (time `9:41` + signal/wifi/battery glyphs), a screen background, and content. Status bar text is navy on light screens, white on dark/gradient screens. **Do not build the device bezel or camera hole-punch.**

---

## 0 · Home (post-login landing) — `2a`
**Purpose:** The landing screen after sign-in; the launchpad for every action. (Replaces an earlier Claude Code draft — this is the approved redesign.)
**Background:** `#f5f8f8`; fixed bottom tab bar.
**Layout (scrollable body over fixed nav):**
- **Header row:** Lifeline **logo lockup** (height ~30px, left) + notification bell tile (42px white, red unread dot) + profile avatar tile (42px teal gradient, initial).
- **Greeting:** "Hello there" (15px muted) then "How can we help you today?" (Poppins 800/30, navy).
- **Hero card — Request Ambulance:** brand gradient `linear-gradient(140deg,#2ba7a0,#1a7c80,#12545c)`, radius 24, soft radial glow, primary shadow. Ambulance glyph in a translucent rounded tile top-right. Title "Request Ambulance" (Poppins 800/26 white), subtitle "Emergency or immediate medical transport", and a white pill CTA "Start request →" (teal text). Tapping starts the request flow (screen 2).
- **Two secondary cards** (2-col grid): **Schedule Transport** (calendar icon, "Book for a later time") and **Patient Transfer** (person-plus icon, "Non-emergency medical transfer"). White, radius 18, 40px soft-teal icon tile.
- **Live overview:** overline "LIVE OVERVIEW", then a 3-up stat grid (white cards, centered): **8 min** Avg. response · **42** Active units · **120+** Hospitals. Numbers in Poppins 800/20 teal-deep.
- **Emergency strip:** full-width `#fdecec` pill, phone icon + "Emergency? Call 999" (red `#e5484d`). Reserved emergency styling — dials 999 directly.
- **Bottom tab bar** (white, 76px): **Home** (active teal) · Trips · Activity · Profile.

---

## 1 · Welcome / Sign in
**Purpose:** Enter the app fast; guest-first because emergencies can't wait for signup.
**Background:** hero gradient `linear-gradient(165deg,#2ba7a0,#1a7c80,#12545c)` with a soft radial glow top-right.
**Layout (top→bottom):**
- Hero block centered ~120px from top: glass tile (104px, radius 34, `rgba(255,255,255,.14)` + border) containing a white 70px rounded tile with the **pin mark**. Below: "Lifeline" (Poppins 800/40, white), tagline "Every second counts." (Poppins 500/17, white 82%), then supporting line (15px, white 72%, max 260px).
- **Bottom sheet** (white, radius 36 top, pinned to bottom, padding 34/26/30):
  - Primary button **"Continue as Guest"** (gradient, 60px, trailing arrow) + caption "Fastest in an emergency — no account needed".
  - Divider "or sign in to save details".
  - **Continue with Google** (white, 1.5px border, Google glyph) and **Continue with Apple** (navy `#14233f`, white, Apple glyph), each 54px, radius 16.
  - Legal caption referencing Terms and **PDPA** (Malaysia privacy act).

## 2 · Set pickup & destination
**Purpose:** Confirm where to collect the patient and which hospital.
**Background:** map (see token map style), route polyline from pickup to destination.
**Layout:**
- Map fills screen. **Pickup pin** (navy label "Pickup" + green dot) and **destination pin** (teal pin w/ 🏥) on the map with a dashed teal route between.
- Top row (below status bar): circular back button + recenter button (44px white tiles, radius 14, floating-control shadow).
- **Bottom sheet** (white, radius 32 top, drag handle):
  - Title "Where to?" (Poppins 700/20).
  - Two stacked location rows joined by a vertical connector line: **Pickup** (green dot) = "Menara KLCC, Jalan Ampang"; **Destination** (teal square, active teal border) = "Gleneagles Hospital KL". Each row: field bg `#f5f8f8`, radius 15, uppercase label + value.
  - Quick chips row: "Nearest ER" (active teal), "Pantai KL", "HKL", "Prince Court".
  - Trip meta row: clock icon "8.2 km · ~14 min" + "Traffic: moderate".
  - Primary button **"Confirm route"** (58px gradient).

## 3 · Patient & condition
**Purpose:** Capture who needs help + severity + symptoms so the right unit responds.
**Background:** `#f7fafa`.
**Layout:**
- Header row: back button + title "Who needs help?" + 3-dot progress indicator (step 2 of 3 active, teal bars).
- Scrollable body (fixed footer):
  - **Who segmented toggle**: [Myself | Someone else] in a `#eef2f4` track; active pill white with shadow. (Mock shows "Someone else" selected.)
  - **Severity** heading, three selectable cards (radio on right):
    - **Critical** — red shield icon, bg `#fdecec`; "Not breathing, unconscious, severe bleeding".
    - **Serious** — amber icon, bg `#fdf3e3`; **selected** (2px teal border, teal filled radio w/ check, card lift shadow); "Chest pain, breathing difficulty, injury".
    - **Stable** — teal pulse icon, bg `#eaf4f3`; "Non-urgent transfer, mobility help".
    - Each card: white, radius 16, 44px icon tile, title (700/15) + description (12/faint).
  - **Symptoms** (optional) heading, wrapping chips. Selected chips = solid `#12545c` white text with a ✓ (e.g. "Chest pain ✓", "Difficulty breathing ✓"); unselected = white, 1.5px border, `#475569` text (Trauma / injury, Stroke signs, Bleeding, Allergic reaction).
- **Footer** (gradient-fade over bg): primary button **"Find ambulances"** (58px, trailing arrow).

## 4 · Nearby operators  `1a`  ✅ chosen
**Purpose:** Compare operators bidding on ETA/price; pick one.
**Background:** `#f2f6f6`.
**Layout:**
- **Sticky header** (white, subtle bottom shadow): back button + "4 units near you" (Poppins 700/18) + subline "KLCC → Gleneagles · **Serious**" (Serious in amber). Sort chips: **Fastest ETA** (active navy), "Lowest price", "Nearest".
- Scrollable list:
  - **Best-match card** — white, 2px teal border, teal card-lift shadow. Top ribbon: gradient bar "★ BEST MATCH" (uppercase). Body: 50px gradient avatar "KV", name "Klang Valley Medical Response", meta row "★ 4.9 · 320 trips · ALS" (ALS in a teal badge). Metric row (three columns, Poppins 700): **ETA** 8 min · **Distance** 3.2 km · **Price** RM145 (price in `#12545c`). Full-width **"Request this unit"** button (50px gradient).
  - **Standard operator cards** (×2): white, 1.5px light border. 50px soft-teal avatar (initials), name, "★ rating · trips · [BLS/Critical Care badge]", compact 3-metric row (19px numerals), and a pill **"Request"** button (44px, teal outline). Examples: "Selangor Ambulance Services" ★4.7 · 11 min · 4.1 km · RM120 · BLS; "MediRescue KL" ★4.8 · 14 min · 5.6 km · RM165 · Critical Care.
  - **Info strip** (`#eef2f4`, info icon): "Prices set by each operator. In a life-threatening emergency, **call 999** directly." (999 in red.)

## 5 · Waiting for accept
**Purpose:** Hold state while the chosen operator decides, with escape hatches.
**Background:** dark gradient `linear-gradient(180deg,#14233f,#12545c)` + radial glow.
**Layout:**
- Top: overline "REQUESTING YOUR UNIT" (white 60%) + title "Waiting for the operator to confirm…" (Poppins 700/24, white).
- **Countdown ring** centered: 210px SVG ring, track `rgba(255,255,255,.14)`, progress arc teal-bright `#2ba7a0` (rounded cap). Center: big "48" (Poppins 800/52 white) + "seconds to accept".
- **Operator card** (white, radius 22): 52px gradient avatar "KV", name, "★ 4.9 · ETA 8 min · RM145". Divider, then animated 3-dot indicator + "Operator is reviewing your request…".
- Bottom actions: **"Skip to next operator"** (ghost-on-dark, arrow icon) and **"Cancel request"** (red-tinted ghost: bg `rgba(229,72,77,.18)`, border `rgba(229,72,77,.5)`, text `#ff9ea1`).

## 6 · Confirm & pay
**Purpose:** Review fare, choose payment, dispatch.
**Background:** `#f7fafa`; fixed footer on white.
**Layout:**
- Header: back button + "Confirm & pay".
- Scrollable body:
  - **Accepted banner** — success bg `#eaf6ef`, green check circle, "Unit accepted — confirm to dispatch".
  - **Trip summary card** — operator row (46px gradient avatar, name, "★ 4.9 · ALS · ETA 8 min") over a divider, then pickup→destination mini-timeline.
  - **Fare estimate card** — line items: Base dispatch RM 90.00 · Distance · 8.2 km RM 45.00 · ALS equipment RM 10.00; dashed divider; **Total RM 145** (Poppins 800/22, teal-deep).
  - **Payment method** list (radio-select rows, 38px icon tile each):
    - **Touch 'n Go eWallet** (📱, "Balance RM 320.50") — **selected** (2px teal border, teal check).
    - **FPX Online Banking** (🏦, "Maybank, CIMB, and more").
    - **Card ···· 4242** (💳, "Visa").
  - Caption: "Payment is held now and charged when your trip completes."
- **Footer:** primary button with lock icon **"Confirm & dispatch — RM 145"** (58px gradient).

## 7 · Live tracking  `1c`  ✅ chosen
**Purpose:** Watch the ambulance approach; reach the crew; see progress.
**Background:** map with route from ambulance to pickup.
**Layout:**
- Map fills top. **Ambulance marker** (white rounded tile, teal border, ambulance glyph) on route; **pickup marker** (green dot). Route = solid teal polyline.
- **ETA banner** (floating, navy `#14233f`, radius 18): ambulance icon tile + "Ambulance en route to you" / "Arriving in 6 min" (Poppins 700/20 white) + **LIVE** pill (teal dot + mint text).
- **Bottom sheet** (white, drag handle):
  - **Crew row**: 52px avatar (🧑‍⚕️), "Ahmad Faiz · Paramedic", "Unit **WXX 4821** · ALS · KV Medical", plus **call** and **message** icon buttons (44px soft-teal tiles).
  - **Vertical timeline** (connector line, teal fill up to current step):
    1. **Request accepted** — teal check node, "9:38".
    2. **En route to pickup** — active ringed node, "In progress · 6 min away" (teal), "9:41".
    3. Patient onboard — future (faint, empty node).
    4. Arrived at Gleneagles KL — future (faint).

## Emergency · 999 fallback
**Purpose:** When no unit is available/accepts, route to national emergency line.
**Background:** `#fbf4f4` with faint red radial glow. (Red path only.)
**Layout:**
- Centered: 96px `#fdecec` tile with red warning-triangle icon; title "No units available right now" (Poppins 700/24); body "Every nearby operator is busy. In a life-threatening emergency, don't wait — call the national emergency line now."
- **"Call 999 now"** button — solid red `#e5484d`, 72px, phone icon, Poppins 700/20, strong red shadow.
- Row of two outline buttons: **"Try again"** · **"Notify me"** (54px each).
- Bottom **"While you wait"** card (white, 1px `#f2dede` border): two red-bullet tips ("Keep the patient still and stay on the line with 999." / "We'll keep searching and alert you the moment a unit frees up.").

---

## Variation directions (reference only — NOT selected)
- **`1b` Nearby operators — map-first:** operators shown as price bubbles on a full map; a peeking bottom sheet lists the top 2 + a single "Request Klang Valley Medical" CTA. Use if you later want a map-primary browse.
- **`1d` Tracking — status-forward:** big teal hero with a giant "6 min" countdown and EN ROUTE · LIVE pill, crew card overlapping the hero, and a horizontal 4-segment progress bar over stacked status rows (no map). Use if map cost/perf is a concern.
