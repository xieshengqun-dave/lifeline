# Admin Dashboard — Screen Spec

3 screens. Web app, **React + Vite** (per BUILD-PLAN Phase 4). Design frame 1440×900, desktop. "Keep it plain and functional" — this is an internal console, not a marketing surface. Talks to the Phase 1 admin REST endpoints; Bookings uses the realtime channel for live status.

Shared shell (screens 2 & 3): a fixed **230px navy sidebar** (`#14233f`) + fluid content area on `#f7fafa`.

**Sidebar** (top→bottom):
- Brand: 36px white rounded tile with pin mark + "Lifeline" (Poppins 700/16, white).
- Nav items (12px vertical padding, radius 12, icon + label): **Operators**, **Bookings**, **Analytics**. Active item = teal gradient fill `linear-gradient(135deg,#1f8a8f,#12545c)`, white 700; inactive = `rgba(255,255,255,.65)`, 600.
- Footer (pinned bottom, top border `rgba(255,255,255,.1)`): 34px round avatar "AR", "Aisha R." / "Admin".

The browser-chrome bar (traffic lights + URL) shown in the mock is **presentation only** — don't build it.

---

## 1 · Admin sign in
**Purpose:** Authenticated entry for admins (simple login, per plan).
**Layout:** full-screen split. Left ~52% is a navy→teal gradient panel cut on a diagonal (`clip-path` polygon); right is `#f2f6f6`.
- **Left panel:** top-left brand lockup (48px white tile + pin mark, "Lifeline" / "ADMIN CONSOLE"). Bottom-left: "Every second counts." (Poppins 700/30 white) + "Vet operators and monitor live dispatch across the Klang Valley."
- **Login card** (right of center, 400px, white, radius 22, big soft shadow):
  - "Sign in" (Poppins 700/24) + "Authorised administrators only." (14/muted).
  - **Email** field (mail icon, "admin@lifeline.my") and **Password** field (lock icon, dots) — field bg `#f5f8f8`, 1.5px `#e2e8ee` border, radius 13.
  - Primary **"Sign in"** button (52px, teal gradient, radius 14).
  - Caption "Protected by 2FA · PDPA compliant".

## 2 · Operators — vetting, rates & fleet
**Purpose:** Review applicants, approve/suspend, inspect rate card and fleet. **This is the core admin job** (BUILD-PLAN "done when": approve a pending operator → they appear in patient quote results).
**Layout:** sidebar + a two-column main = **list column** (fluid) + **detail drawer** (400px, right, white, left border).

**List column:**
- **Header bar** (white, bottom border): title "Operators" + subline "14 total · **3 pending review**" (pending in amber). Right: search box (`#f2f6f6`, magnifier, "Search operators…", 240px).
- **Filter chips:** All · 14 (active navy) · **Pending · 3** (amber on `#fdf3e3`) · Approved · 9 · Suspended · 2.
- **Table** — a 5-column grid `2.4fr 1fr 1fr 1fr 1.1fr`: **Operator** (42px avatar + name + "trips · area"), **Tier** (ALS/BLS/Critical), **Fleet** (n units), **Rating** (★ amber, "—" if none yet), **Status** pill. Each row is a card (white, radius 14, 1px border). Selected row = 2px teal border + teal lift shadow. Suspended row = dimmed (opacity .72).
  - Status pills: **PENDING** amber `#e8a13a`/`#fdf3e3`; **APPROVED** green `#22a55b`/`#eaf6ef`; **SUSPENDED** red `#e5484d`/`#fdecec`.
  - Rows shown: MediKlang Emergency (pending, selected), Klang Valley Medical Response (approved ★4.9), Selangor Ambulance Services (approved ★4.7), MediRescue KL (approved ★4.8), PJ Ambulans (suspended ★4.2).

**Detail drawer** (reflects the selected operator):
- Header: 52px avatar + name + status line ("Pending review · applied 2 Jul 2026").
- **Company details** list: SSM reg. no., MOH licence ("Verified ✓" in green), Base location, Contact.
- **Rate card** (`#f7fafa` box): Base dispatch RM 90 · Per km RM 5.50 · ALS equipment RM 10. (These feed the patient fare estimate.)
- **Fleet · N units**: rows with ambulance icon tile + "PLATE · TIER" + "make · year" (available = teal tile, out = grey).
- **Action bar** (pinned bottom, top border): primary **"Approve"** (teal gradient, check icon) + **"Reject"** (white, red text/border). For an already-approved operator these become **Suspend** / **Edit**.

## 3 · Bookings — live dispatch table
**Purpose:** Watch every booking across the region in real time.
**Layout:** sidebar + content. Content = header/KPIs band (white) over a scrollable table.
- **Header:** "Bookings" + a green **LIVE** pill (green dot + "LIVE" on `#eaf6ef`). Right: range chips Today (active navy) · 7 days · All.
- **KPI grid** (4 cards, `#f7fafa`, radius 14): **Active now** 5 (teal) · **Completed today** 38 · **Avg. accept time** 22s · **999 fallbacks** 2 (red).
- **Table** — 6-column grid `1fr 1.5fr 1.7fr 1.2fr 1fr 1.1fr`: **Booking** (#id + time), **Route** (A → B), **Operator** (28px avatar + name; "Awaiting accept…" italic grey if unassigned), **Stage** pill (En route / Onboard / Offer · m:ss / Completed / 999 fallback), **Fare** (RM, teal; "—" if none), **Status** (● ACTIVE teal / ● PENDING amber / ✓ DONE grey / ● 999 red).
  - Active rows carry a 4px **left accent border** (teal for active, amber for pending offer).
  - Rows shown: #LFL-2841 KLCC→Gleneagles KV Medical · En route · RM145 · ACTIVE; #LFL-2840 Bangsar→Pantai MediRescue · Onboard · RM160 · ACTIVE; #LFL-2839 TTDI→UMMC awaiting · Offer 0:41 · RM130 · PENDING; #LFL-2838 Ampang→HKL Selangor · Completed · RM98 · DONE; #LFL-2837 Cheras→HKL **No units — 999** · RM— · 999; #LFL-2836 PJ→Assunta KV · Completed · RM112 · DONE.

---

## Behavior notes
- **Approve/Suspend** hit the admin endpoints and must reflect immediately in the operator's eligibility for patient quotes (the plan's acceptance test).
- **Bookings table** subscribes to the realtime channel; the "Offer · m:ss" countdown ticks down live per the 60s offer window; rows re-sort/append as new bookings arrive.
- **999 fallback** bookings are visually flagged red so admins can spot coverage gaps — a key pilot metric.
- Analytics nav item is a placeholder for a later phase (not designed).
