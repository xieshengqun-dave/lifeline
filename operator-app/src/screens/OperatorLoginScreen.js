import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { gradients, type, spacing, radius } from "../theme/tokens";
import { AuthContext } from "../../App";
import GradientButton from "../components/ui/GradientButton";
import BottomSheetShell from "../components/ui/BottomSheetShell";

export default function OperatorLoginScreen({ navigation }) {
  const { signIn } = React.useContext(AuthContext);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (e) {
      setError(e.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={gradients.darkHeroIncoming} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={s.hero}>
          <View style={s.markTile}>
            <Image source={require("../../assets/brand/lifeline-mark.png")} style={s.mark} resizeMode="contain" />
          </View>
          <Text style={s.title}>Operator Portal</Text>
          <Text style={s.sub}>Sign in to start receiving ambulance requests near you.</Text>
        </View>

        <BottomSheetShell style={s.sheet}>
          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <Text style={s.label}>OPERATOR ID OR EMAIL</Text>
          <View style={s.field}>
            <Ionicons name="mail-outline" size={17} color={C.faint} />
            <TextInput
              style={s.input}
              placeholder="ops@kvmedical.my"
              placeholderTextColor={C.faint}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text style={s.label}>PASSWORD</Text>
          <View style={s.field}>
            <Ionicons name="lock-closed-outline" size={17} color={C.faint} />
            <TextInput
              style={s.input}
              placeholder="••••••••"
              placeholderTextColor={C.faint}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={C.faint} />
            </TouchableOpacity>
          </View>

          <Text style={s.forgot}>Forgot password?</Text>

          <GradientButton
            label="Sign in"
            onPress={submit}
            loading={loading}
            disabled={!email || !password}
            showIcon={false}
            colors={gradients.primary}
            style={{ marginTop: 8 }}
          />

          <Text style={s.footer}>Approved operators only. New here? Apply to join Lifeline</Text>
        </BottomSheetShell>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.screenPad },
  markTile: { width: 78, height: 78, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 22 },
  mark: { width: 50, height: 50 },
  title: { ...type.wordmark, color: "#fff", marginBottom: 10, textAlign: "center" },
  sub: { ...type.body, color: "rgba(255,255,255,0.72)", textAlign: "center", maxWidth: 280 },
  sheet: { paddingHorizontal: spacing.screenPad, paddingTop: 28, paddingBottom: 26 },
  errorBox: { backgroundColor: C.redSoft, borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { color: C.red, fontSize: 12.5, textAlign: "center" },
  label: { ...type.caption, textTransform: "uppercase", color: C.faint, marginBottom: 7, marginTop: 4 },
  field: {
    flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.bg,
    borderRadius: radius.input, paddingHorizontal: 14, height: 50, marginBottom: 14,
  },
  input: { flex: 1, fontSize: 14.5, color: C.ink },
  forgot: { ...type.bodySemibold, fontSize: 13, color: C.teal, textAlign: "right", marginBottom: 20 },
  footer: { ...type.body, fontSize: 12, color: C.faint, textAlign: "center", marginTop: 18 },
});
