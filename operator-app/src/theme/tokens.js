// New design-system tokens (design_handoff_lifeline/DESIGN-TOKENS.md) —
// duplicated from the patient app's src/theme/tokens.js, same no-monorepo
// rationale as theme.js. Additive to `C`: anything C already expresses stays
// there; this file covers gradients, font roles, spacing/radius/shadow
// presets the new screens are built from.

export const colors = {
  navyDeep: "#0f3a42",
  tealBright: "#2ba7a0",
  tealMint: "#7fffdc",
  fieldBg: "#f5f8f8",
  borderLight: "#eef2f4",
  warningAmber: "#e8a13a",
  warningBg: "#fdf3e3",
  successBg: "#eaf6ef",
};

export const gradients = {
  primary: ["#1f8a8f", "#12545c"],
  hero: ["#2ba7a0", "#1a7c80", "#12545c"],
  darkHeroWaiting: ["#14233f", "#12545c"],
  darkHeroIncoming: ["#14233f", "#0f3a42"], // operator sign-in + incoming-request use this one
};

export const type = {
  screenTitle: { fontFamily: "Poppins_700Bold", fontSize: 19 },
  wordmark: { fontFamily: "Poppins_800ExtraBold", fontSize: 26, letterSpacing: -0.4 },
  bigNumeral: { fontFamily: "Poppins_800ExtraBold", fontSize: 44 },
  cardTitle: { fontFamily: "Poppins_700Bold", fontSize: 15 },
  statNumber: { fontFamily: "Poppins_800ExtraBold", fontSize: 24 },
  price: { fontFamily: "Poppins_800ExtraBold", fontSize: 20 },
  body: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 14.5, lineHeight: 21 },
  bodySemibold: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14.5 },
  buttonLabel: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 16 },
  caption: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 12, letterSpacing: 0.6 },
  overline: { fontFamily: "Poppins_700Bold", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" },
};

export const spacing = { screenPad: 22, cardPad: 17, cardGap: 12 };

export const radius = { button: 18, card: 20, sheet: 34, input: 15, icon: 13, pill: 999 };

export const shadows = {
  primaryButton: { shadowColor: "#12545c", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8 },
  cardLift: { shadowColor: "#1f8a8f", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 20, elevation: 6 },
  neutralCard: { shadowColor: "#14233f", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4 },
  bottomSheet: { shadowColor: "#0b1220", shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 12 },
  floatingControl: { shadowColor: "#14233f", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 5 },
};

export const FONT_WEIGHTS_USED = [
  "Poppins_500Medium",
  "Poppins_600SemiBold",
  "Poppins_700Bold",
  "Poppins_800ExtraBold",
  "PlusJakartaSans_400Regular",
  "PlusJakartaSans_500Medium",
  "PlusJakartaSans_600SemiBold",
  "PlusJakartaSans_700Bold",
  "PlusJakartaSans_800ExtraBold",
];
