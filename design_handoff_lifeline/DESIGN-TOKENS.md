# Lifeline — Design Tokens

All values are pulled directly from the HTML design references. Frame width = 390px (logical). Map px → dp/pt 1:1.

## Brand
Logo mark is a teal gradient location-pin containing a white cross/pulse; wordmark "Lifeline" in deep navy. Tagline: **"Every second counts."**

## Colors

### Core brand
| Token | Hex | Use |
|---|---|---|
| Navy (primary text / dark surfaces) | `#14233f` | Headings, primary text, dark headers, active nav |
| Navy deep (gradient end / login bg) | `#0f3a42` | Operator incoming-request gradient end |
| Teal | `#1f8a8f` | Primary accent, active borders, links |
| Teal bright | `#2ba7a0` | Gradient start, highlights |
| Teal deep | `#12545c` | Gradient end, prices, secondary accent text |
| Teal mint (on-dark accent) | `#7fffdc` | LIVE/online dot & labels on dark backgrounds |

**Primary gradient (buttons, hero, brand fills):** `linear-gradient(135deg, #1f8a8f, #12545c)`
**Hero/login gradient:** `linear-gradient(165deg, #2ba7a0 0%, #1a7c80 42%, #12545c 100%)`
**Dark hero gradient (waiting / operator):** `linear-gradient(180deg, #14233f 0%, #12545c 100%)`

### Neutrals
| Token | Hex | Use |
|---|---|---|
| Canvas (board bg) | `#eef2f4` | — (canvas only, not in-app) |
| App bg light | `#f7fafa` / `#f2f6f6` | Screen backgrounds |
| Surface | `#ffffff` | Cards, sheets |
| Field bg | `#f5f8f8` | Input fields |
| Border light | `#eef2f4` | Card borders |
| Border | `#e2e8ee` / `#d7e0e3` | Input borders, dividers |
| Text muted | `#64748b` | Secondary text |
| Text faint | `#94a3b8` | Captions, labels, placeholders |
| Fill soft teal | `#eaf4f3` / `#eef4f5` / `#d6ebe9` | Chips, icon tiles, badges |

### Semantic
| Token | Hex | Use |
|---|---|---|
| Success green | `#22a55b` / `#22c55e` | Completed, available, pickup pin |
| Success bg | `#eaf6ef` | Success banners/tiles |
| Warning amber | `#e8a13a` | "Serious" severity, ratings (★) |
| Warning bg | `#fdf3e3` | Serious severity tile |
| Emergency red | `#e5484d` | **999 / critical ONLY** |
| Emergency bg | `#fdecec` / `#fbf4f4` | Critical tiles, 999 screen bg |

## Typography
Two families (load via `@expo-google-fonts`):
- **Poppins** — headings, numerals, brand. Weights 500/600/700/800.
- **Plus Jakarta Sans** — UI/body/buttons. Weights 400/500/600/700/800.

| Role | Family | Size | Weight | Notes |
|---|---|---|---|---|
| Screen title | Poppins | 18–20px | 700 | |
| Brand wordmark (splash) | Poppins | 40px | 800 | letter-spacing -0.02em |
| Big numeral (ETA, countdown, earnings) | Poppins | 44–60px | 800 | line-height ~1 |
| Card title | Poppins | 14–15px | 700 | |
| Stat number | Poppins | 22–26px | 800 | |
| Price | Poppins | 16–22px | 800 | color `#12545c` |
| Body | Plus Jakarta Sans | 14–15px | 400–600 | line-height 1.5 |
| Button label | Plus Jakarta Sans | 15–17px | 700 | |
| Caption / label | Plus Jakarta Sans | 11–13px | 600 | uppercase labels: letter-spacing .06em |
| Overline (section) | Poppins | 14px | 700 | uppercase, letter-spacing .14em, color `#12545c` |

## Spacing
Screen horizontal padding: **22px**. Card padding: **16–18px**. Gaps between stacked cards: **10–14px**. Section vertical rhythm: **16–26px**.

## Radius
| Element | Radius |
|---|---|
| Primary buttons | 17–18px |
| Cards | 16–22px |
| Bottom sheets | 30–36px top corners |
| Input fields | 15px |
| Icon tiles | 10–16px |
| Chips / pills | 999px |
| Severity/list icon tiles | 11–15px |

## Shadows
- **Primary button:** `0 12px 24px -10px rgba(18,84,92,.7)`
- **Card lift:** `0 14px 30px -18px rgba(31,138,143,.55)` (teal-tinted, for best-match card)
- **Neutral card:** `0 8px 20px -12px rgba(20,35,63,.2)`
- **Bottom sheet:** `0 -18px 44px -18px rgba(11,18,32,.35)`
- **Floating map control:** `0 6px 16px -6px rgba(20,35,63,.3)`

## Buttons
- **Primary:** full-width, height 58–64px, teal gradient, white 700 label, radius 17–18px, primary shadow. Often a trailing arrow or leading lock/check icon.
- **Secondary/outline:** white bg, 1.5px border `#e2e8ee` (or teal `#1f8a8f` for teal-outline), navy/teal 700 label.
- **Emergency:** solid `#e5484d`, white, height up to 72px, phone icon. 999 only.
- **Ghost-on-dark:** translucent white fill `rgba(255,255,255,.14)` + `1.5px rgba(255,255,255,.3)` border.

## Iconography
Line icons, 2–2.4px stroke, rounded caps/joins, ~20–24px. Currency shown as `RM` prefix. A custom ambulance glyph (rounded van + cross) appears on tracking and operator unit tiles. Emoji used sparingly in mock (🏥 🧑‍⚕️ 📱 🏦 💳) — replace with real icons/illustration in production.

## Map styling
Soft off-white/green land (`#e7ede9`), parks `#d8e7d3`, water `#cfe1e6`, roads white. Route drawn as teal (`#1f8a8f`) dashed/solid polyline. Pickup = green dot with white ring; destination = teal pin; ambulance = white rounded tile w/ teal border + ambulance glyph. Price bubbles on the map-first variant. Use these as the target style for the real map layer.
