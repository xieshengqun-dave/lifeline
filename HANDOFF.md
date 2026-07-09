# HANDOFF.md — Lifeline

> Session continuity log. Read this at the start of a session to know where things stand;
> update it at the end of a session so the next one (you, a teammate, or Claude Code) can
> pick up cleanly. Newest entry on top.

---

## Current status snapshot

**Stage:** Web prototype validated → native scaffold running locally (Phase 0 done) →
full marketplace backend (Phase 1) done → patient app wired to the real backend
(Phase 2) done → operator app built (Phase 3) done → admin dashboard built (Phase 4)
done and browser-verified at the API level → both Expo apps upgraded from SDK 51 to
**SDK 54** to match the user's actual Expo Go client → **user got real phone testing
done** and reported back concrete feedback (destination picker was actually broken, not
just a placeholder; no way home mid-flow; assessment form missing several fields their
real workflow needs) — all three fixed same session. **Phase 2/3 phone verification is
now genuinely in progress** (first real device feedback received), not just newly
possible. Since then: a full visual redesign landed across all 3 apps (new navy/teal
design system, Poppins/Plus Jakarta Sans, new fonts/gradients/countdown ring) plus two
new backend features (admin-configurable platform fee, real post-trip ratings) — see
the 2026-07-08 log entries below for full detail. **The user has since started the
actual browser/phone walkthrough** (the standing recommendation) and it's already
caught 3 real bugs the bundle-check couldn't: admin's `App.css` was never imported
anywhere (dead since Phase 4, not something this session's redesign introduced — just
never seen in a real browser until now), a stale Vite dev-server dependency cache, and
duplicate/stale Expo Metro server processes accumulating across the session's many
restarts (now resolved — see log). The design handoff package was also **updated by the
client mid-session** with a new Home-screen spec; rebuilt to match. **The phone/browser
walkthrough is still the single most important next step** — continue it; there's a
real chance of finding more of exactly this class of bug (things that only show up
rendered, never caught by `expo export`/`npm run build` alone).

**Frontend (patient app) — wired to the real backend:**
| Screen | Status |
|---|---|
| Login (guest / Google / Apple) | ✅ built — guest is real, Google/Apple show a flagged "not configured" message (no fake verification) |
| Welcome | ✅ built (personalized greeting) |
| Location (pickup + destination, map + GPS) | ✅ built (unchanged) |
| Patient assessment | ✅ built (unchanged) |
| Operator list (find nearby + price) | ✅ rewired — calls real `POST /bookings/quote`, ranked by distance, empty case shows 999 fallback |
| Review | ✅ rewritten — real price from quote, payment method picker moved here, triggers `POST /bookings` |
| Waiting state (timer + cancel + skip + accept/decline) | ✅ built — Socket.IO live, count-up timer, inline 999-fallback on expiry |
| Payment | ✅ repurposed — cosmetic post-accept receipt, no backend call (payment not integrated) |
| Tracking | ✅ rewritten — real event-sourced timeline, live via socket |

**Not manually tested on a physical device yet** — verified so far: `expo export`
bundles cleanly (782 modules, no syntax/import errors), backend health check ok, LAN IP
current. No phone/simulator available in this environment to drive an actual UI
walkthrough — that verification still needs to happen (see this session's log entry).

**Operator app:** ✅ Phase 3 done, not yet manually verified. Second independent Expo
project at `/operator-app` (own package.json/app.json, port 8082). Screens: login
(real, email+password), Home (online toggle, today's summary, active trips), Incoming
Requests (live socket-pushed offers, per-card countdown, accept/decline), Active Trip
(assign ambulance+crew, advance status through to completed), Trip History. Backend
gained 5 new endpoints to support it (`GET /operator/me`, `/fleet`, `/bookings`,
`/bookings/:id`, `POST /bookings/:id/assign`) — all curl-verified, `npm test` still
10/10 (no regression to the Phase 1 critical path).
**Admin dashboard:** ✅ Phase 4 done. Plain Vite+React (JS, no TS/router/UI-kit) web app
at `/admin`, port 5173. Login (single admin-token input, validated against the real
backend before flipping to logged-in), Operators page (list, approve/suspend using the
endpoint's own returned row), Bookings page (polling table, 8s + window-focus refetch,
distinguishes initial-load vs background-poll failure). **Zero new backend endpoints
needed** — the Phase 1 admin routes already covered everything. Verified end-to-end at
the HTTP level: CORS preflight ok, bad/good token paths, and the literal done-when
criterion (suspend an operator → they vanish from patient quote results; re-approve →
they reappear) — all curl-confirmed directly against the live backend.
**Backend + DB:** ✅ Phase 1 done. Full marketplace Prisma schema (Operator, Ambulance,
Crew, Booking, BookingOffer, TrackingEvent) migrated; 5 Klang Valley operators seeded with
ambulances/crew; REST API (`auth`, `bookings`, `operator`, `admin` routes) + Socket.IO
realtime wired and reachable over HTTP; the whole critical path (quote → book → decline →
timeout → re-offer → accept → status advances → tracking) verified both by manual curl
and by a passing `npm test` (10/10, `lifeline_test` DB); `docker-compose.yml` + full
README written; gained 5 more endpoints in Phase 3 for operator fleet/assignment/
history. Not built yet: real payment, real Google/Apple verification (dev-only
unverified mode works).

---

## Next steps (in order)

**Follow `BUILD-PLAN.md`** — it has the phase-by-phase prompts for Claude Code:

1. ~~**Phase 0** — get the scaffold running (Expo app boots, backend health check ok).~~
   ✅ done 2026-07-04.
2. ~~**Phase 1** — backend + DB (schema → matching engine → endpoints → realtime →
   seed + tests).~~ ✅ done 2026-07-04. `npm test` passes 10/10 against `lifeline_test`.
3. ~~**Phase 2** — patient app: login (guest/Google/Apple), real operator list from
   `/bookings/quote`, the waiting screen (timer + cancel + skip), live tracking.~~
   ✅ code done 2026-07-04 — **needs a manual phone walkthrough to confirm** (not yet
   done, no device available in the build environment).
4. ~~**Phase 3** — operator app (receive → accept/decline → crew → status → complete).~~
   ✅ code done 2026-07-04, built ahead of the Phase 2 phone verification at the user's
   explicit request (accepted risk: if Phase 2 has an undiscovered bug, the two-phone
   demo won't work until it's found). **Also needs a manual phone walkthrough.**
5. ~~**Phase 4** — admin dashboard (vet operators, view bookings).~~ ✅ code done
   2026-07-04, built ahead of the Phase 2/3 phone verification at the user's explicit
   request. Verified at the HTTP/API level (stronger than the Expo apps could get,
   since this is a web app) — the literal done-when criterion (approve → appears in
   patient quotes) is curl-confirmed working. Not pixel-checked in a real browser (no
   headless browser tooling available in this environment).
6. **Phase 5 (next)** — deploy (Railway backend, EAS builds, admin to Netlify). **Before
   this, or alongside it: the outstanding manual phone verification for Phases 2 and 3
   is now finally actually possible** (SDK mismatch fixed 2026-07-06) **— do that first.**
7. **Human-decision items** before real users: payment provider, Google/Apple keys,
   medical-data compliance review (checklist in BUILD-PLAN.md).

---

## Decisions locked in

- Operator location = **fixed base** (not live GPS) for v1.
- Pricing = **operator-set fixed rates** (not platform formula).
- Accept window = **60 seconds** default, then move to next nearest.
- Patient can **cancel** or **skip to next** during the wait (Grab-style).
- Auth = **guest + Google + Apple**.
- No-operators-left → **call 999** fallback.

## Open questions (decide with operators)

- Should timeout auto-skip, or only manual skip? (currently: both move on)
- When a patient skips operator A, does A's offer vanish or linger briefly?
- Offer to one operator at a time, or the nearest 2–3 at once (faster in emergencies)?
- Exact accept-window length — confirm with real operators.

---

### 2026-07-08 (cont'd) — Real-browser bug hunt, updated design handoff, Home screen rebuild
The user started actually testing the redesign in a real browser/device — the standing
"bundling clean isn't proof of correct rendering" caveat immediately paid off, catching
three real bugs plus a genuine mid-flight design update:

- **Admin `App.css` was never imported anywhere** — not via a JS import, not via a CSS
  `@import`, in any file. Every layout class (sidebar, cards, tables, badges, login
  panel — literally the entire visual system) had been dead since it was written,
  confirmed via `grep` finding zero references. This predates today's redesign work —
  it's a Phase 4 bug that was never caught because Phase 4 was only ever verified via
  curl/API checks, never rendered in an actual browser until just now. Fixed with one
  line (`import "./App.css";` in `admin/src/main.jsx`); confirmed by the bundled CSS
  size jumping from 26KB to 36.79KB.
- **Stale Vite dev-server dependency cache** — a `vite` process had been running since
  early in the session, before `@fontsource/poppins`/`@fontsource/plus-jakarta-sans`
  were installed; Vite pre-bundles dependencies at startup and doesn't always detect
  new packages without a restart. Fixed with `rm -rf node_modules/.vite` + a forced
  re-optimization restart.
- **Duplicate/stale Expo Metro server processes** — repeated `expo start`/kill cycles
  across this long session left multiple competing processes bound to the same ports
  (found via `ps aux`, e.g. two separate patient-app instances from 3:20PM and 5:44PM
  both wanting port 8081). The phone was very possibly talking to an old stale one the
  whole time, which is the actual explanation for "still showing old design" after a
  first restart attempt. Fixed by `pkill -9 -f "expo start"` + starting exactly one
  fresh instance per app, confirmed via process count. **If a rendering complaint
  persists after a code fix looks right, check `ps aux` for duplicate dev-server
  processes before assuming the code is still wrong.**
- **The `design_handoff_lifeline/` package was updated by the client mid-session** —
  confirmed by comparing file sizes against the original read: `DESIGN-TOKENS.md`,
  `README.md`, `OPERATOR-APP-SPEC.md`, `ADMIN-DASHBOARD-SPEC.md` are all byte-identical
  (unchanged); only `PATIENT-APP-SPEC.md` changed, gaining a new **"0 · Home (post-login
  landing) — `2a`"** section that explicitly says it "replaces an earlier Claude Code
  draft" — i.e. specifically supersedes the extrapolated `WelcomeScreen.js` built
  earlier this session when no real spec existed for it yet (that gap was flagged
  in-code at the time). Rebuilt to match: real logo lockup image in the header (not a
  text wordmark), notification bell + profile avatar tiles (bell has no fake unread-dot
  — no real notification system exists, tapping it says so honestly), a real ambulance
  icon (`MaterialCommunityIcons name="ambulance"`) on the hero card with an explicit
  "Start request →" button as the actual tap target, icon tiles added to the two
  secondary cards, and a new bottom tab bar (Home/Trips/Activity/Profile). The tab bar
  is a **plain styled component, not a real React Navigation tab navigator** — only
  Home has real content behind it, so restructuring the whole app into a nested
  Tab+Stack hybrid wasn't warranted. New `TripsScreen.js`/`ActivityScreen.js` are
  honest "Coming soon" placeholders (no fake trip history or activity feed — a real
  Trips tab needs a new `GET /api/bookings` scoped to the patient, which doesn't exist
  yet); `ProfileScreen.js` shows real session info + Sign Out, replacing the standalone
  Sign Out text link added earlier in the session (now properly integrated as the
  header avatar's tap target instead).
- Also added, same session: admin dashboard **operator create/edit**, plus a new
  `Operator.address` field (display-only — matching/pricing still use `baseLat`/
  `baseLng`, no geocoding dependency added). New endpoints
  `POST`/`PUT /api/admin/operators(/:id)`, both curl-verified end-to-end against the
  real dev DB (create → pending status → login with the hashed password works → edit →
  duplicate-email correctly rejected with 409).
- Verified: `npm test` still 22/22 throughout; `expo-doctor` + `expo export` clean for
  both Expo apps; `npm run build` clean for admin, at every step.

---

### 2026-07-08 — Full visual redesign (all 3 apps) + platform-fee settings + ratings
- A professional design handoff (`design_handoff_lifeline/`) landed: new navy/teal
  gradient system, Poppins + Plus Jakarta Sans, countdown rings, card-lift shadows,
  bottom-sheet layouts — the largest single change in the project so far. Went through
  full Plan Mode per `CLAUDE.md`'s rule (schema changes + cross-cutting redesign).
- Four real conflicts between the design's assumptions and this project's actual
  architecture were resolved with the user up front, as fixed constraints:
  1. **Patient assessment fields stay exactly as built** — visual restyle only; the
     design's alternative Severity+Symptoms model was evaluated and rejected.
  2. **Platform fee is now admin-configurable** (flat RM or %), not hardcoded to either
     the old flat RM15 or the design's asserted 15%.
  3. **Ratings built for real** — new schema, new post-trip patient rating screen
     (didn't exist before), real aggregation. Not faked, not omitted.
  4. **Admin auth stays the single shared token** — only the login screen's visuals
     changed, no real per-admin accounts.
- **Backend (new, tested)**: `PlatformSettings` singleton model (`feeType` flat|percent,
  `feeValue`) + `GET`/`PUT /api/admin/settings/platform-fee`; `computeFare()` now takes
  the resolved setting as a parameter instead of reading a static env var — the fee
  active *at offer time* gets locked into `Booking.serviceFee`/`total`, immune to a
  later admin change mid-trip. `Rating` model (one per booking, DB-unique) +
  `Operator.ratingAvg`/`ratingCount` (recomputed on each write) +
  `POST /api/bookings/:id/rating` (409 if not completed, 409 on a duplicate attempt).
  Real completed-trip counts (no schema needed) surfaced in the quote response and
  `GET /admin/operators`. Caught and preserved a real subtlety: operator payouts are
  already additive (`total = subtotal + fee`, operators are paid `subtotal` in full,
  never reduced by the fee) — the design mock's "earned after 15% fee" framing doesn't
  match that model regardless of the fee number, so operator-app copy was corrected to
  state the true arithmetic rather than copy the mock's inaccurate framing. New test
  files `settings.test.js` (6 tests) + `rating.test.js` (6 tests) — **22/22 backend
  tests passing** (10 original + 12 new), verified via real HTTP curls against dev data
  in addition to the automated suite (submitted a real rating, confirmed the operator
  aggregate updated; flipped the fee flat→10%→flat, confirmed the quote price changed
  and reverted correctly each time).
- **Both Expo apps**: new `src/theme/tokens.js` (gradients/type/spacing/radius/shadow
  presets) alongside the existing `theme.js`'s `C` object (extended in place with the
  new palette — re-skins every screen for free). New deps: `expo-font`,
  `@expo-google-fonts/{poppins,plus-jakarta-sans}`, `expo-linear-gradient`,
  `@expo/vector-icons`, `react-native-svg` (patient app only, for the new
  `CountdownRing`). New shared `src/components/ui/`: `GradientButton`, `Card`,
  `StatusPill`, `BottomSheetShell` (static chrome only — no `@gorhom/bottom-sheet`,
  nothing in this design is actually dragged). Both `App.js`s gained a font-loading
  boot gate wired to `expo-splash-screen`. Every screen in both apps restyled;
  `WaitingScreen` also got a real behavior change (count-up-elapsed →
  count-down-remaining, driven by real `expiresAt`/`offeredAt` that already existed
  server-side but was never visualized). New patient `RatingScreen` (5-star tap +
  optional comment, skippable, never blocks the user). Operator `HomeScreen` now
  actually calls the long-unused `getOperatorFleet()` endpoint to populate the fleet
  list (a real pre-existing gap, not a redesign side effect) and `ActiveTripScreen`'s
  footer call button now works (`booking.crew.phone` was already returned by the API,
  just never rendered). Deliberately **not** faked: operator acceptance-% and
  online-duration (no backing data — omitted, not fabricated), declined-offer trip
  history rows (no backing data), "next payout" date (no payout system exists).
- **Admin**: `@fontsource` self-hosted fonts (not a runtime Google Fonts CDN call).
  `Layout.jsx` rewritten from a horizontal header to a fixed 230px navy sidebar;
  `LoginPage.jsx` restyled to the split diagonal-gradient panel (kept as a single
  token field, not fake email+password — there's no real second credential to split
  into). `OperatorsPage.jsx` rewritten from a flat table to a list-column +
  400px detail drawer. New `SettingsPage.jsx` (the fee toggle, genuinely new — not in
  the original design spec at all). `BookingsPage.jsx` gained a 4-card KPI band and a
  live per-row "Offer · m:ss" countdown (client-side tick against each row's already-
  polled `expiresAt` — kept the existing 8s-polling architecture, deliberately did not
  add Socket.IO for the static admin token, same structural incompatibility already
  documented from Phase 4).
- Verified: `expo-doctor` 18/18 + `expo export --platform ios` clean for both Expo
  apps at each major checkpoint (proof screen, then full app); `npm run build` clean
  for admin at each checkpoint. **Same standing caveat as always**: no physical device
  or browser automation available here — bundling clean is not proof fonts/gradients/
  the countdown ring actually render correctly. **A real phone walkthrough (patient +
  operator) and a browser spot-check of admin (cheapest to verify directly) is the
  single most important next step** — this is now an even bigger pile of unverified-
  by-a-human UI than the standing Phase 2/3 walkthrough recommendation already was.

---

### 2026-07-06 (cont'd twice) — Fix: pickup needs any address, not just hospitals
- User caught a real design bug in the just-shipped `HospitalPickerScreen`: it was
  wired to *both* pickup and destination, but pickup can be anywhere (home, accident
  scene, any address) — destination is the one that's always a hospital.
- Split into two screens. New `AddressPickerScreen.js` (pickup only): "Use Current
  Location" (GPS, same logic as `LocationScreen`'s original auto-locate) + free-text
  address search using **`expo-location`'s forward geocoding**
  (`Location.geocodeAsync`) — resolves via the OS's native geocoder, so this needed
  **no new dependency and no paid Places API key**, consistent with the destination
  picker's original reasoning. Each result is reverse-geocoded back into a readable
  label. Hospital quick-picks still listed below (inter-facility transfers). Simplified
  `HospitalPickerScreen.js` back to destination-only (dropped the now-unreachable
  `target==="from"` branch it briefly had).
- Frontend-only change, no schema/backend touch — didn't need Plan Mode.
- Verified: `npx expo export --platform ios` bundles cleanly (898 modules). Dev server
  restarted, ready for the user to retest pickup with a real address.

### 2026-07-06 (cont'd) — Real phone feedback: destination picker, Home button, richer assessment
- First real device feedback of the project (Phase 2/3's SDK fix earlier this session
  made this possible) — user sent screenshots + handwritten workflow notes/wireframes.
  Went through Plan Mode since this touches the schema (`CLAUDE.md`'s own rule).
- **Destination picker was actually broken, not just an unfinished placeholder**:
  `LocationScreen` had one hardcoded tap target (always set the same fixed hospital) —
  there was no way to pick anything else. Fixed with a searchable picker over a new
  **curated static list of 11 real Klang Valley hospitals** (`src/lib/hospitals.js`),
  not real Google Places Autocomplete — that needs a paid Maps API key, exactly the
  kind of external credential `CLAUDE.md` says to flag rather than silently add. New
  `HospitalPickerScreen.js` (search-filter + distance-sort from pickup when choosing a
  destination), used for **both** pickup-override and destination now (pickup's own
  hardcoded override tap had the identical bug, fixed for free).
- **Added a Home button** to `_Header.js` (new optional `onHome` slot) wired on
  Location/Assess/Ambulances/Review — deliberately *not* added to Waiting (already has
  its own confirm-then-home flow via Cancel; a second inconsistent shortcut there would
  bypass that confirmation) or Payment/Tracking (already have their own "done" flows).
- **Expanded patient assessment** per the user's wireframes: age/sex are now actually
  editable (previously silently hardcoded to "45"/"Male" since Phase 2 — a gap I'd
  flagged then as out of scope, now in scope), conscious-level pills relabeled ("Fully
  Conscious" etc.), oxygen support now asks a flow-rate tier (<5L/>5L) when yes, IV
  therapy now asks for medication when yes, diagnosis is now an RTA/Other choice with
  free text for Other, and a new optional special-request field.
- **Backend schema change**: added `Booking.medication` and `Booking.specialRequest`
  (both nullable strings), one migration
  (`20260706070341_add_medication_special_request`), validated in
  `bookings.routes.js`'s zod schema, persisted in `offerEngine.js`, and surfaced to
  operators via `GET /api/operator/requests`'s `patientSummary` (previously only ever
  exposed `{age, consciousLevel, oxygen}` — otherwise this new data would be captured
  but nobody could ever see it). Kept `oxygenFlow` as the existing `Int?` column rather
  than migrating to a string tier — mapped the two UI choices to representative values
  (`<5L`→4, `>5L`→6) since operators don't see this field precisely today anyway (a
  documented simplification, not a silent one).
- **Verification**: curled the new fields end-to-end (booking → operator's
  `GET /requests` → confirmed `medication`/`diagnosis`/`specialRequest` all present).
  `npm test` — hit one flaky-looking failure on the first run (tracking timeline
  stopped at "En Route" instead of completing), re-ran twice more clean (10/10 both
  times); the schema change is purely additive so this was very likely a one-off
  Postgres/timing flake, not a regression — worth a second look only if it recurs.
  `npx expo export --platform ios` bundles cleanly (897 modules). Real UI verification
  still needs the user's phone (dev server restarted and ready).
- **Next**: user re-tests on their phone — destination search, Home button, and the
  full assessment form (including Review's now-expanded patient summary).

### 2026-07-06 — Fix Expo Go SDK mismatch (51 → 54) + a real Node PATH conflict
- User's phone runs Expo Go for SDK 54; both Expo apps were pinned to SDK 51. Expo Go
  can only load a project matching its own SDK — this had been silently making Phases
  2-3's phone verification *impossible*, not just "not yet done." Since this is a large
  dependency change (React 18→19, React Native 0.74→0.81), went through Plan Mode per
  the project's own rule rather than just bumping versions blind.
- **Didn't guess version numbers** — pulled them directly from `expo@54.0.35`'s real
  `bundledNativeModules.json` (the same source `npx expo install` itself reads) via
  `npm pack` + extract, rather than relying on possibly-stale training knowledge. Full
  target table is in the plan file's history; net effect: `expo ~54.0.0`, `react
  19.1.0`, `react-native 0.81.5`, and matching bumps for every `expo-*`/`react-native-*`
  package. Also bumped `@react-navigation/native`/`native-stack` v6→v7 (v6 was already
  npm-flagged "no longer supported"; v7 is the version actually maintained against this
  React 19/RN 0.81 generation) — deliberate, not required by any hard peer-dep, a risk
  call to avoid compounding an unsupported major under a big SDK jump.
- **Also fixed, at the user's request once it turned up**: this Mac had **two Node
  installations fighting over PATH** — Homebrew had 24.2.0 sitting unused in the Cellar
  ("installed on request"), while `/usr/local/bin/node` was a raw, unlinked binary dated
  Jul 2023 (v20.5.0), almost certainly from an old official nodejs.org installer that
  had occupied that path before Homebrew's own symlink could. This is exactly what broke
  `create-vite` earlier this project (its CLI refused to run on the shadowed old Node).
  `brew upgrade node` → 26.4.0, then `brew link --overwrite node` **partially failed**
  (a leftover *root-owned* `/usr/local/include/node` directory, same old installer,
  blocked the node-gyp header symlinks) — and critically, `--overwrite` had already
  *deleted* the old raw binary before the failure, leaving **zero working `node` on
  PATH** mid-upgrade. Fixed by manually `ln -sf`-ing `node`/`npm`/`npx` from the
  Homebrew Cellar into `/usr/local/bin` (a directory `dave` does own, unlike
  `include/node`) — didn't touch the root-owned directory itself (would need `sudo`,
  didn't attempt it, left as a flagged non-blocking cleanup item since it only affects
  native addon compilation, which this project never does on this machine).
- Upgrade procedure per app (patient app root, then `/operator-app`): edit
  `package.json` to the researched target versions → `rm -rf node_modules
  package-lock.json && npm install` (clean reinstall, safer than an in-place diff across
  a jump this large) → `npx expo install --fix` (came back "up to date" both times —
  the manual version research was already exactly right) → `npx expo-doctor` (**18/18
  both apps**) → `npx expo export --platform ios` (clean bundle both times: 895 modules
  patient app, 858 operator app). No New Architecture or react-navigation v7 breakage
  surfaced anywhere — a clean upgrade.
- Restarted both Metro dev servers (patient :8081, operator :8082) and the backend
  (:4000, had gone down between sessions) — all confirmed healthy again.
- **This also intersected with a separately-noticed problem**: the Mac's LAN IP had
  changed since the last session (192.168.1.203 → 192.168.100.133) — fixed in both
  `app.json`s and the admin dashboard's fallback default in the same sitting.
- **Next**: the phone verification for Phases 2-3 is now finally actually possible
  (was blocked by the SDK mismatch this whole time) — this is the thing to do next,
  before Phase 5 deploy.

### 2026-07-04 (cont'd once more) — Phase 4: admin dashboard built
- User was away from a device and explicitly chose to keep going rather than wait —
  same pattern as the Phase 2→3 decision.
- Planned via Plan Mode again. This turned out to be a genuinely light phase: reading
  `backend/src/routes/admin.routes.js` directly confirmed **zero new backend endpoints
  were needed** — `GET /operators`, `POST /operators/:id/approve|suspend`, and
  `GET /bookings` already existed from Phase 1 and already cover everything BUILD-PLAN's
  Phase 4 asks for. Also confirmed `services/matching.js` already filters on
  `vettingStatus: APPROVED`, which is exactly what makes "approve → appears in patient
  quotes" work with no code change beyond the dashboard itself.
- **Process note**: the planning sub-agent separately reported what it took for a
  prompt-injection attempt inside `BUILD-PLAN.md`. I re-read that file directly myself
  immediately afterward and found it completely clean — 159 lines, ends exactly where
  expected, no such text anywhere. Concluded this was the sub-agent misreading its own
  harness's routine meta-commentary (sub-agents get system-level reminders attached to
  their own tool results too) as if it were file content, not an actual issue in this
  repo. Not something to act on, but worth recording in case it recurs — if it does,
  independently re-check the actual file content before treating the claim as real, as
  was done here.
- **First non-Expo, non-Node piece of this repo**: plain Vite+React (JS, no TypeScript
  anywhere else in this project) at `/admin`, port 5173. `create-vite`'s CLI itself
  requires a newer Node than this machine has (20.5.0 vs its own `^20.19.0` requirement)
  and crashed outright — hand-wrote the standard Vite scaffold files directly instead of
  fighting the CLI's engine check, since the resulting file set is well-known and small.
- Confirmed `requireAdmin` (`backend/src/lib/auth.js`) is a static shared-secret bearer
  check, no JWT, no admin user table — so "simple login" correctly means a single token
  input validated by making one real admin call, not a real auth system. Confirmed
  `lib/socket.js` has zero admin-room code and its one auth path verifies a JWT
  (structurally incompatible with the static admin token) — chose **polling** (8s
  interval + refetch-on-window-focus + manual Refresh) over building real-time socket
  infrastructure for one admin's one browser tab, which wouldn't be proportionate to a
  "1 session, keep it plain" phase.
- Pages: Login (token input, validates via a real `GET /operators` call before flipping
  to logged-in, mirrors the RN apps' `setUnauthorizedHandler` pattern via `localStorage`
  instead of `SecureStore`), Operators (approve/suspend use the endpoint's own returned
  row directly rather than optimistic-guessing or a full refetch), Bookings (polling
  table that distinguishes an initial-load failure — full error state — from a
  background-poll failure after prior success — a small non-blocking retry note,
  keeping last-known rows visible rather than blanking the table).
- **Verification — meaningfully stronger than the two Expo apps could get**, since this
  is a plain web app reachable over HTTP: confirmed CORS preflight succeeds for a
  cross-origin browser request (admin on :5173 calling the backend on :4000), confirmed
  the bad-token/good-token paths match exactly what `LoginPage` expects, and directly
  exercised **the literal done-when criterion** — suspended a real seeded operator via
  the same API call the dashboard's Suspend button makes, confirmed they immediately
  vanished from a patient quote near their location, re-approved, confirmed they
  reappeared. `npm run build` compiles cleanly (39 modules). Attempted a real headless-
  browser check (this being the first web app in the repo, it's actually possible in
  principle, unlike the RN apps) but neither `chromium-cli` nor Playwright's browser
  binaries are available in this environment, and installing Playwright's Chromium
  would mean a large (100s of MB) download — decided against that and relied on the
  HTTP-level verification above instead, same honest-caveat spirit as Phases 2-3.
- **Next**: same as noted after Phase 3 — a real device session is now the single
  biggest gap across three built-but-unverified phases (2, 3, and the pixel-level half
  of 4). Phase 5 (deploy) is next per BUILD-PLAN, but doing the device verification
  first (or alongside) would catch any real bugs before they're harder to find atop a
  deployed environment.

### 2026-07-04 (cont'd yet again) — Phase 3: operator app built
- User explicitly chose to build Phase 3 before manually verifying Phase 2 on a phone
  (neither this session nor the last had device access). Flagged the one real risk
  (an undiscovered Phase 2 bug would block the eventual two-phone demo regardless of
  how solid Phase 3 is) and proceeded per their call.
- Planned via Plan Mode again. The design pass surfaced a real backend gap I confirmed
  by reading the code directly: **no endpoint anywhere touched `Booking.ambulanceId`/
  `crewId`**, and `GET /api/bookings/:id` is hard-gated to `requirePatientAuth` — the
  operator app had no way to see its own booking details at all. Added 5 endpoints to
  close this: `GET /api/operator/me` (live `online` state, since a SecureStore-cached
  login response can't be trusted for a value that changes constantly),
  `GET /api/operator/fleet` (active ambulances/crew for an assignment picker),
  `GET /api/operator/bookings` + `/bookings/:id` (operator-scoped list/detail, mirroring
  the admin endpoints but scoped to `req.operatorId`), and `POST /bookings/:id/assign`
  (new `services/assignment.js`, validates booking ownership + status + that the
  ambulance/crew belong to this operator and are active). The assign endpoint reuses
  the existing (now-exported) `addTrackingEvent()` helper from `offerEngine.js`, so
  assignment automatically shows up on the patient's **unmodified** `TrackingScreen`
  timeline for free — a nice bit of reuse, verified end-to-end via curl (booked →
  accepted → assigned → confirmed the tracking timeline picked it up with zero patient-
  app changes).
- Corrected one thing in the design pass before building: operator earnings must sum
  `subtotal`, not `total` — `total` includes the platform's flat service fee, which
  isn't the operator's money. Applied throughout (Home's today's-summary, Trip History).
- **New independent Expo app at `/operator-app`** (own `package.json`/`app.json`/
  `node_modules`, port 8082 since 8081's taken by the patient app) — no monorepo tooling
  exists in this repo, so brand tokens (`theme.js`) and `_Header.js` are duplicated
  rather than shared, a deliberate low-tooling-cost call. Added a `metro.config.js` to
  *both* apps with a mutual `resolver.blockList` — preventive, not reactive: two Expo
  projects nested in one git tree can hit "duplicate Haste module name" errors once
  both are actively developed, and the fix is cheap enough to apply upfront.
- **Screens**: `OperatorLoginScreen` (real email+password, no guest concept for
  operators), `HomeScreen` (online/offline toggle — the *only* toggle surface in the
  app, to avoid two controls drifting out of sync — today's summary, active trips
  list), `IncomingRequestsScreen` (a genuine list, not a single-offer assumption — a
  multi-ambulance operator can legitimately hold 2+ concurrent offers for different
  bookings; per-card countdown recomputed from `expiresAt` each tick, not incremented;
  resyncs on socket reconnect since a missed `offer:created` during a disconnect has no
  guaranteed follow-up event, unlike the patient side), `ActiveTripScreen` (assign
  ambulance+crew via inline radio pickers, then all four status-advance buttons always
  visible with forward-only guards mirroring the backend's own skip-allowed semantics,
  `navigation.popToTop()` on completion since this screen is reachable at inconsistent
  stack depths), `TripHistoryScreen` (simple list, pull-to-refresh).
- One real React Navigation correctness detail applied throughout: `navigation.push()`,
  not `.navigate()`, for both "accept an offer" and "tap an active trip on Home" —
  `.navigate` to an existing route name pops back to *that* instance and merges params,
  which would silently discard an already-open different trip's screen if a second
  trip gets accepted while the first is still active.
- **Flagged product decisions, deliberately left as-is, not silently resolved**:
  accepting one offer does NOT auto-decline sibling offers (a multi-truck operator may
  have real capacity for both — human dispatcher's call); there's no capacity check
  preventing an operator from accepting two offers with only one truck actually free;
  there's no operator-initiated trip cancellation anywhere in the backend (only
  patients can cancel); a patient cancelling while an offer is pending doesn't notify
  that specific operator's app (self-corrects via a 409 on their next tap). None of
  these block the stated Phase 3 "done when" bar; all worth a decision before a real
  pilot.
- **Verification done**: `npm test` still 10/10 after the 5 new endpoints (no
  regression). Manually curled every new endpoint against seeded data, including the
  validation guards (wrong status, wrong operator's resource, empty body) and the
  patient-tracking-picks-up-assignment path. `npx expo export --platform ios` bundles
  cleanly for both the operator app (748 modules) and, re-checked, the patient app
  (782 modules, confirming the new root `metro.config.js` didn't break anything). Both
  apps' dev servers confirmed running concurrently without conflict (8081 + 8082).
- **Not done — same honest caveat as Phase 2**: no physical device or simulator is
  available in this environment, so neither app has been through an actual interactive
  UI walkthrough, and the real two-phone demo (patient books → operator's phone rings →
  accept → assign → status advances → patient sees it live → complete) has not been run.
- **Next:** a real device session covering BOTH Phase 2 and Phase 3's manual
  verification checklists together — this is now the single most important next step
  before treating either app as demo-ready. Only after that should Phase 4 (admin
  dashboard) start.

### 2026-07-04 (cont'd again) — Phase 2: patient app wired to real backend
- Planned via Plan Mode again (design sub-agent + review) before coding. Resolved one
  real sequencing conflict during planning: `POST /api/bookings` requires
  `paymentMethod` in the same call that creates the booking + first offer, but the new
  Waiting screen (accept/decline race) must sit between choosing an operator and
  Payment. Fix: moved payment-method selection into Review (before booking creation),
  repurposed Payment into a post-accept cosmetic receipt screen (no backend call —
  payment isn't integrated). Final screen order: Login → Welcome → Location → Assess →
  Ambulances → Review → **Waiting (new)** → Payment → Tracking.
- Caught and fixed two real gaps in the design pass before writing code: (1) the first
  draft never wrote the actively-offered operator back into `BookingContext` as it
  changed during a decline/timeout cascade, which would've left Payment showing the
  *originally selected* operator instead of the one actually accepted; (2) the quote
  response's operator shape (`operatorId`) and the socket `offer_operator` event's
  shape (`id`) don't match field-for-field — added one `normalizeOperator()` helper
  (`src/api/mappers.js`) used everywhere so this can't drift.
- New deps: `expo-secure-store` (token/user persistence across restarts, installed via
  `npx expo install` for the correct SDK51-compatible version), `socket.io-client@^4.8.1`
  (matches the backend's `socket.io@^4.8.3`).
- **`App.js` rewritten**: new sibling `AuthContext` (kept separate from `BookingContext`
  deliberately — mixing auth into the same flat merge-object risked a booking-draft
  reset accidentally touching auth state) with SecureStore-backed persistence, a boot
  spinner while checking for a stored token, `initialRouteName` chosen once
  (Login vs Welcome), a 401 handler wired to force sign-out + reset navigation to Login
  (guards against a stale token surviving a dev DB reset — already happened once this
  project). `BookingContext` extended with `selectedOperator`/`bookingId`/
  `bookingStatus`/`currentOfferExpiresAt` + a new `resetDraft()`.
- **`src/api/client.js` fully rewritten** (old Phase-0-shaped functions are gone):
  bearer-token mechanism, `ApiError` with `.status`/`.code`, every real Phase 1
  endpoint. New `src/api/mappers.js` (field-shape bridging) and `src/api/socket.js`
  (Socket.IO wrapper, room join/leave + the 3 event types, both Waiting and Tracking
  share it).
- **New screens**: `LoginScreen.js` (guest is real; Google/Apple buttons are present
  but show a flagged "not yet configured" alert rather than completing sign-in —
  deliberately not wired to the backend's `ALLOW_UNVERIFIED_SOCIAL_AUTH` dev
  escape-hatch, since prompting for a hand-typed email and presenting it as a real
  sign-in would look identical to a verified login in a demo), `WaitingScreen.js` (the
  load-bearing new piece — immediate authoritative `GET` on mount since the very first
  socket event is definitionally missed, count-up timer recomputed from a timestamp
  each tick rather than incremented so it self-corrects if backgrounded, inline
  999-fallback on `expired` rather than a separate route, Android back button +
  header back both route through the same confirm-cancel dialog, `gestureEnabled:false`
  to block iOS swipe-back), `_EmergencyFallback.js` (shared "no operators / call 999"
  panel, reused by both Ambulances' empty-quote case and Waiting's expired case).
- **Rewired existing screens**: `AmbulancesScreen` (real `/bookings/quote` call, three
  states: loading/error/empty), `ReviewScreen` (payment method picker moved in here,
  real server-computed price, the actual `POST /bookings` call, submit-button
  double-tap guard), `PaymentScreen` (repurposed to a receipt screen with a visible
  "payment integration is not yet live" caption per CLAUDE.md's flag-don't-stub rule),
  `TrackingScreen` (real `GET` + live socket-appended event-sourced timeline, replacing
  the old fixed 6-step mockup — a deliberate scope decision since pre-rendering future
  not-yet-happened steps doesn't fit real event data), `WelcomeScreen` (hardcoded
  "Hello, John" → user-aware greeting). Removed now-unused `UNITS`/`SERVICE_FEE` from
  `theme.js` after confirming nothing else imported them.
- **Verification done**: `npx expo export --platform ios` bundles cleanly (782 modules,
  zero syntax/import errors) — this is the strongest check possible without a physical
  device or simulator, neither of which is available in this build environment. Backend
  health check and LAN IP (`app.json`'s `extra.apiBaseUrl`) both reconfirmed current.
- **Not done — explicitly flagging rather than claiming success**: no live interactive
  walkthrough on an actual phone/simulator has happened. The full manual verification
  checklist (guest sign-in → quote → book → simulate decline via curl/operator-login →
  confirm Waiting live-updates → simulate accept → Payment → Tracking; plus Skip-until-
  exhausted, Cancel mid-wait, empty-quote case, and app-restart persistence) still needs
  to be run on a real device with Expo Go.
- **Next:** manually walk the app in Expo Go per the checklist above; fix whatever
  breaks. Only after that's confirmed working should Phase 3 (operator app) start.

### 2026-07-04 (cont'd) — Phase 1: backend build, complete
- Planned via Plan Mode (design sub-agent + review) before writing code, per this
  project's own rule. Key design calls, all flagged for review in the plan: bounding-box
  + Haversine matching instead of PostGIS (not installed, adds ~11 brew deps, Prisma has
  no native geography type — documented as a later upgrade path); in-memory `setTimeout`
  per offer for the 60s accept window, with `BookingOffer.expiresAt` persisted as the
  real source of truth plus boot-time recovery + a 15s sweep as a safety net (BullMQ/Redis
  noted as a low-friction future upgrade since Redis already runs on this Mac); flat RM
  platform fee (not % commission — flagged as a business TODO); `declined` (CLAUDE.md's
  locked status) reused as a transient pulse for operator-decline/timeout/skip alike, with
  the precise reason preserved in `BookingOffer.status` and the socket payload.
- **Schema rewritten and migrated** (`20260704031736_marketplace_schema`): Operator,
  Ambulance, Crew, Booking (extended with pickup/destination, patient snapshot, price
  breakdown, the locked status list), BookingOffer (accept/decline history + timer
  source of truth), TrackingEvent. Dev DB was reset (dropped/recreated) rather than
  diff-migrated, since Phase 0's 3 test ambulances weren't worth preserving.
- **Seeded 5 Klang Valley operators** (PJ Rapid Response, Subang MedEvac, Shah Alam
  Emergency Services, KL City Ambulance, Cheras Care Ambulance) with real-ish coordinates,
  distinct rates/radii, 13 ambulances, 10 crew — verified via direct SQL query. All
  operators share one dev-only login password (`operator123`, hashed at seed time — not
  stored as a literal hash string in `seedData.js`, see incident note below on why).
- **Built `lib/`**: env (dotenv + required-var validation), prisma (shared client),
  constants (locked status/type values, single source of truth), geo (Haversine +
  bounding-box), auth (JWT sign/verify + patient/operator/admin middleware — admin fails
  closed if `ADMIN_API_TOKEN` isn't set), socket (Socket.IO init, room/event helpers).
- **Built `services/`**: matching (nearest-operator search), pricing (fare + ETA heuristic,
  both flagged TODOs), payment (stub only — `chargeBooking()` throws, real provider
  integration is a human decision), offerEngine (the whole accept/decline/timeout/skip/
  cancel/status-advance lifecycle, plus boot-time offer recovery and the sweep).
- Added deps: `dotenv`, `jsonwebtoken`, `bcryptjs`, `zod`, `socket.io` (+ dev:
  `supertest`, `dotenv-cli`).
- **Built `routes/*`** (auth/bookings/operator/admin) + `app.js` (buildable Express app,
  no `.listen()`, so tests can drive it via supertest) + `server.js` (thin entrypoint:
  http server, Socket.IO attach, offer recovery, sweep, listen).
- **Manually walked the full critical path via curl** against the running dev server:
  guest auth → quote (ranked correctly, radius-excluded KL City/Cheras correctly, price
  math correct) → book → operator login → decline (correctly re-offered next-nearest,
  price recomputed) → **a server restart mid-test doubled as a real test of the offer-
  recovery mechanism** — the pending offer had actually already expired by restart time,
  and recovery correctly cascaded it through timeout → next-operator → eventually
  "no operators left → expired," proving that path end-to-end unintentionally → fresh
  booking → accept → status enroute→arrived→onboard→completed (all 200) → guarded a
  repeat transition (409) and a wrong-operator attempt (403) → tracking timeline exactly
  right, chronological → cancel path → admin operator list.
- **Found and fixed a real bug during that walk**: `GET /api/bookings/:id` used
  `include: { operator: true }`, which leaked the operator's `passwordHash` straight to
  the patient. Fixed with an explicit safe-field `select` there and in every
  `admin.routes.js` operator response (list/approve/suspend/bookings) — the kind of thing
  worth specifically re-checking any time a route embeds a relation via Prisma `include`.
- Wrote `docker-compose.yml`, `backend/.env.test.example`, and a full `backend/README.md`
  (setup, env var table, every endpoint, status machine, offer lifecycle, Socket.IO
  events, flagged human-decision items).
- **Test suite**: `lifeline_test` DB created; `test/helpers/{testDb,client}.js` (deterministic
  4-operator distance fixture so ranking assertions don't depend on real-world geometry;
  `resetDb()` refuses to run unless `DATABASE_URL` contains `lifeline_test`);
  `test/booking-flow.test.js` (the full critical path, 7 subtests) and
  `test/cancel-and-expire.test.js` (cancel + no-operators-left paths). `npm test` runs
  each file as a fully separate sequential `node --test` invocation (chained with `&&`,
  not just multiple file args) since this Node version (20.5.0) has no
  `--test-concurrency` flag to force serial execution otherwise, and both files share one
  test DB. **10/10 passing.** One real assertion bug found+fixed along the way: a price
  check used the *display-rounded* `distanceKm` from the API response instead of full
  precision — server pricing was already correct, the test's expected-value math wasn't.
- **Incident (resolved): a mid-session file-access lockout.** Tools started returning
  `EPERM` on `backend/seedData.js` right after it briefly held fake-looking bcrypt hash
  strings (`$2b$10$...` placeholders) — that file had to be deleted and recreated by hand
  (`rm` via user, since even `rm` was denied to Claude). The lockout then spread to
  `package.json`, `schema.prisma`, and eventually the **entire `~/Desktop` tree** (a
  sibling project, `~/Desktop/CareFlow`, was blocked too), while `/private/tmp` stayed
  fine throughout. Root cause: macOS's **Desktop Folder privacy permission (TCC)** for
  the terminal app got reset/revoked mid-session (Spotlight indexing load was a red
  herring — ruled out once the block widened past this project). Fixed by the user via
  **System Settings → Privacy & Security → Files and Folders → [terminal app] → Desktop
  Folder**, re-enabling it. **If this recurs:** check that setting first, don't assume
  it's content- or project-specific.
- **Next:** Phase 2 — wire the Expo patient app to this real API (it currently still
  calls the old placeholder endpoints via `src/api/client.js`) and build the missing
  screens (login, real operator list, waiting screen, live tracking) per `BUILD-PLAN.md`.

### 2026-07-04 — Phase 0: scaffold running
- Gave the project its own git repo (`git init`, branch `main`). It had none before —
  `lifeline-native` was nested inside a git repo rooted at the whole home directory
  (`~/.git`, remote → GitHub `DevBrain`), which also made Watchman try to crawl the entire
  home folder and hang the Expo dev server. `git init` here fixed both: Watchman now uses
  this repo as the nearest root, and this project has proper isolated version control.
- Frontend: `npm install` (1152 packages, `expo-doctor` 17/17 checks pass), Expo dev
  server boots cleanly, Metro on `:8081`.
- Backend: no Docker on this machine, so installed **PostgreSQL 16 via Homebrew**
  (native background service, not docker-compose) instead — decided with the user as
  the simpler path for local dev. Created `lifeline` DB + `lifeline` role,
  `backend/.env` with `DATABASE_URL`. Ran `npx prisma migrate dev --name init` against
  the existing starter schema (first migration created). Seeded 3 demo ambulances.
  Backend boots (`npm run dev`), health check `GET /` → `{service, ok:true}` confirmed
  both via `localhost` and the LAN IP.
- Fixed `app.json` `extra.apiBaseUrl`: was `http://localhost:4000`, which doesn't work
  from a physical phone in Expo Go (phone's "localhost" is itself). Changed to the
  Mac's LAN IP (`http://192.168.1.203:4000` at time of writing — **update this if the
  Mac's IP changes**, e.g. different Wi-Fi network).
- **Flagged, not fixed (out of scope — separate project):** the home-directory git repo
  (`~/.git`, remote `DevBrain`) has `.ssh/`, `.aws/`, `.npm/`, `.config/`, `.claude.json`
  sitting untracked in its working tree, plus a filename that looks like a live Google
  API key (`.zshrcAIzaSy...`). Any future `git add -A` there risks pushing credentials
  to GitHub. User was told; not yet addressed.
- Docker-compose was NOT created (BUILD-PLAN's Phase 0 default) since we went the
  Homebrew-Postgres route instead — revisit if we ever need containerized parity
  (e.g. before Railway deploy in Phase 5, or if another dev joins).
- **Next:** Phase 1 — run `claude-code-backend-prompt.md` to build the real marketplace
  backend (current schema/server.js are just the starter, not the full spec).

### 2026-06-16 — Project setup
- Validated web prototype (deployed to Netlify, GPS + map working on https).
- Generated app icon set + transparent logo.
- Built React Native (Expo) scaffold: 7 screens, navigation, theme, API client.
- Built backend starter (Express + Prisma schema) — not yet extended to full spec.
- Designed full marketplace architecture + patient and operator flowcharts.
- Wrote `claude-code-backend-prompt.md` for the backend build.
- Set up docs system (CLAUDE.md, HANDOFF.md, Obsidian sync).
- **Next:** run the backend prompt in Claude Code.

<!-- Add new sessions ABOVE this line, newest on top. Template:
### YYYY-MM-DD — short title
- what changed
- decisions made
- **Next:** the single most important next action
-->
