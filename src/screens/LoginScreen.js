import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { gradients, type, spacing, radius } from "../theme/tokens";
import { AuthContext } from "../../App";
import GradientButton from "../components/ui/GradientButton";
import BottomSheetShell from "../components/ui/BottomSheetShell";

// Google/Apple: present, tappable, but flagged rather than functional — real
// verification needs a Google Cloud OAuth client / Apple Developer account,
// which don't exist yet (see backend/README.md's "Known limitations"). We
// deliberately do NOT call the backend's ALLOW_UNVERIFIED_SOCIAL_AUTH dev
// escape-hatch from here: prompting for a hand-typed name/email and
// presenting it as a real sign-in would look identical to a verified login
// in a demo — exactly the "faked verification" this phase must avoid.
function notConfigured(provider) {
  Alert.alert(
    `${provider} sign-in`,
    `Needs a real ${provider} developer account and API keys — not yet configured. Continue as guest for now.`
  );
}

export default function LoginScreen({ navigation }) {
  const { signInGuest } = React.useContext(AuthContext);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  async function continueAsGuest() {
    setLoading(true);
    setError(null);
    try {
      await signInGuest();
      navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
    } catch (e) {
      setError(e.message || "Could not start a session. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={gradients.hero} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={s.hero}>
          <View style={s.glassTile}>
            <View style={s.markTile}>
              <Image source={require("../../assets/brand/lifeline-mark.png")} style={s.mark} resizeMode="contain" />
            </View>
          </View>
          <Text style={s.wordmark}>Lifeline</Text>
          <Text style={s.tagline}>Every second counts.</Text>
          <Text style={s.support}>Get an ambulance to you fast — nearby operators compete on ETA and price.</Text>
        </View>

        <BottomSheetShell style={s.sheet}>
          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <GradientButton label="Continue as Guest" onPress={continueAsGuest} loading={loading} style={{ marginBottom: 8 }} />
          <Text style={s.guestCaption}>Fastest in an emergency — no account needed</Text>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or sign in to save details</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity style={s.socialBtn} onPress={() => notConfigured("Google")} disabled={loading}>
            <Ionicons name="logo-google" size={18} color={C.ink} />
            <Text style={s.socialBtnT}>Continue with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.socialBtn, s.appleBtn]} onPress={() => notConfigured("Apple")} disabled={loading}>
            <Ionicons name="logo-apple" size={19} color="#fff" />
            <Text style={[s.socialBtnT, { color: "#fff" }]}>Continue with Apple</Text>
          </TouchableOpacity>

          <Text style={s.legal}>By continuing you agree to our Terms and PDPA privacy notice.</Text>
        </BottomSheetShell>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.screenPad },
  glassTile: {
    width: 104, height: 104, borderRadius: 34, backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center", marginBottom: 22,
  },
  markTile: { width: 70, height: 70, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  mark: { width: 46, height: 46 },
  wordmark: { ...type.wordmark, color: "#fff", marginBottom: 6 },
  tagline: { ...type.bodySemibold, fontSize: 17, color: "rgba(255,255,255,0.82)", marginBottom: 14 },
  support: { ...type.body, color: "rgba(255,255,255,0.72)", textAlign: "center", maxWidth: 260 },
  sheet: { paddingHorizontal: spacing.screenPad, paddingTop: 30, paddingBottom: 26 },
  errorBox: { backgroundColor: C.redSoft, borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { color: C.red, fontSize: 12.5, textAlign: "center" },
  guestCaption: { ...type.caption, textTransform: "none", letterSpacing: 0, color: C.faint, textAlign: "center", marginBottom: 20 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.line },
  dividerText: { ...type.caption, textTransform: "none", letterSpacing: 0, color: C.faint, marginHorizontal: 10 },
  socialBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    height: 54, borderRadius: radius.icon + 3, borderWidth: 1.5, borderColor: C.line,
    marginBottom: 12, backgroundColor: "#fff",
  },
  appleBtn: { backgroundColor: C.navy, borderColor: C.navy },
  socialBtnT: { ...type.buttonLabel, fontSize: 15, color: C.ink },
  legal: { ...type.body, fontSize: 11.5, color: C.faint, textAlign: "center", marginTop: 12 },
});
