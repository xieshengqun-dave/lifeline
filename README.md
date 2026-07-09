# Lifeline — React Native App + Backend

This is the **starting scaffold** for the Lifeline native app. It is NOT a finished
product — it's a correct foundation you (or a developer, or Claude Code) extend and deploy.

Two parts:
- **/** — the Expo (React Native) mobile app
- **/backend** — the Node + Prisma + PostgreSQL API

> **Best way to continue this:** open this folder in **Claude Code**. A multi-file native
> app needs a real dev environment (install packages, run a device simulator, run the DB).
> Claude Code can do all of that; this chat cannot. Install it from
> https://www.npmjs.com/package/@anthropic-ai/claude-code

---

## What's already here

**Mobile app (Expo + React Navigation):**
- All 7 screens wired into a navigation stack (Welcome → Location → Assess → Ambulances → Review → Payment → Tracking)
- Shared booking state via React Context (`App.js`)
- Brand theme in `src/theme/theme.js`
- **Real native GPS** on the Location screen (`expo-location` + `react-native-maps`) — this is the big upgrade over the web version: precise, permission-prompted, no https hassle
- Your app icon + splash wired in `app.json`
- API client in `src/api/client.js`

**Backend (Express + Prisma):**
- Database schema for users, ambulances, bookings, patients, tracking events (`backend/prisma/schema.prisma`)
- REST endpoints: list ambulances, create booking, get booking, tracking timeline
- Seed script with sample ambulances

---

## Run the mobile app

```bash
# from this folder
npm install
npx expo start
```
Then press `i` (iOS simulator), `a` (Android), or scan the QR code with the **Expo Go**
app on your phone. (iOS simulator needs a Mac; Android needs Android Studio. Expo Go on a
real phone is the easiest.)

> **Maps note:** `react-native-maps` with `PROVIDER_GOOGLE` needs a **Google Maps API key**
> for production builds. For early testing in Expo Go on iOS it falls back to Apple Maps.
> Add keys in `app.json` under `ios.config.googleMapsApiKey` / `android.config.googleMaps...`
> when you set up Google Cloud.

## Run the backend

```bash
cd backend
npm install
cp .env.example .env          # then edit DATABASE_URL
npx prisma migrate dev --name init
npm run seed
npm run dev                    # API on http://localhost:4000
```
Point the app at it: in `app.json`, set `extra.apiBaseUrl` to your machine's IP
(e.g. `http://192.168.1.10:4000`) so your phone can reach it on the same wifi.

---

## How this maps to the Grab architecture we discussed

| Layer | This scaffold | Production target |
|---|---|---|
| App | Expo / React Native | Same, built with EAS for the stores |
| Maps | react-native-maps | + Google Maps API key, Places Autocomplete, Directions |
| Backend | Express + Prisma | Same, or NestJS; add auth |
| Database | PostgreSQL | Managed Postgres (Railway/Render/Supabase) |
| Payments | placeholder | Stripe or local gateway (iPay88/Billplz) |
| Realtime tracking | poll endpoint | WebSockets / Socket.IO for live ambulance position |

---

## What still needs building (the real work)

1. **Address search** — Location screen currently uses placeholder taps. Wire up
   **Google Places Autocomplete** for real address entry (see the TODO in `LocationScreen.js`).
2. **Auth** — phone/OTP login, so bookings tie to a user.
3. **Payments** — integrate a real gateway; never store raw card data yourself.
4. **Live tracking** — replace the tracking placeholder with a socket feed + driver app.
5. **Driver/dispatcher side** — someone has to receive and accept bookings.
6. **Deploy** — backend to Railway/Render; app to TestFlight/Play Console via EAS Build.

## ⚠️ Important: this handles health data and emergencies

This app collects **patient medical information** and is meant for **emergency dispatch**.
That carries real responsibility:
- Health data needs secure handling and likely legal/compliance review (data-protection law
  in your jurisdiction, hospital agreements).
- An emergency-dispatch app failing has real-world consequences — it needs proper testing,
  error handling, and ideally professional review before real patients rely on it.
- Don't ship payment or medical features to real users without a developer who can take
  responsibility for security and correctness.

Treat this scaffold as a prototype to build on, not a launch-ready product.

---

## Icons
The generated icon set is in the separate `lifeline-icons` folder:
- `icon-1024-appstore.png` — App Store (1024, no transparency)
- `icon.png` / `adaptive-icon.png` — Expo iOS + Android adaptive
- `splash.png` — splash screen
- `favicon.png` + `icon-*.png` — web/PWA sizes
The key ones (`icon.png`, `adaptive-icon.png`, `splash.png`, `favicon.png`) are already
copied into `/assets` and referenced by `app.json`.
