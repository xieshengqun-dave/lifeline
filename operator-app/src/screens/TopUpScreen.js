import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Linking, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../theme/theme";
import { type, spacing, radius, shadows } from "../theme/tokens";
import { getOperatorWallet, createTopup } from "../api/client";
import Header from "./_Header";
import Card from "../components/ui/Card";
import GradientButton from "../components/ui/GradientButton";

// W3 · Top up. Amount selection happens here; the actual payment runs on the
// provider's hosted page (Stripe test mode today — the spec's TNG/FPX/card
// method picker arrives with the Malaysian gateway switch, deliberately not
// mocked before then).
const PRESETS = [50, 100, 200, 500, 1000];

export default function TopUpScreen({ navigation }) {
  const [balance, setBalance] = React.useState(null);
  const [amount, setAmount] = React.useState(200);
  const [custom, setCustom] = React.useState(false);
  const [customValue, setCustomValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    getOperatorWallet().then((w) => setBalance(w.balance)).catch(() => {});
  }, []);

  const effective = custom ? Number(customValue) || 0 : amount;
  const valid = Number.isFinite(effective) && effective >= 10 && effective <= 5000;

  async function pay() {
    if (!valid) {
      Alert.alert("Top up", "Enter an amount between RM10 and RM5000.");
      return;
    }
    setBusy(true);
    try {
      const { url } = await createTopup(effective);
      Linking.openURL(url);
      navigation.goBack(); // Wallet refetches on focus and shows the credit when it lands
    } catch (e) {
      Alert.alert("Top-up failed", e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7fafa" }} edges={["top"]}>
      <Header title="Top up wallet" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPad }}>
        <Card style={t.amountCard}>
          <Text style={t.amountLabel}>AMOUNT</Text>
          <View style={t.amountRow}>
            <Text style={t.rm}>RM</Text>
            {custom ? (
              <TextInput
                style={t.amountInput}
                autoFocus
                keyboardType="numeric"
                value={customValue}
                onChangeText={setCustomValue}
                placeholder="0"
                placeholderTextColor={C.faint}
              />
            ) : (
              <Text style={t.amountN}>{amount}</Text>
            )}
          </View>
          <Text style={t.newBalance}>
            {balance != null && valid
              ? `New balance will be RM ${(balance + effective).toFixed(2)}`
              : balance != null
              ? `Current balance RM ${balance.toFixed(2)}`
              : " "}
          </Text>
        </Card>

        <View style={t.grid}>
          {PRESETS.map((p) => {
            const selected = !custom && amount === p;
            return (
              <TouchableOpacity
                key={p}
                style={[t.pill, selected && t.pillOn]}
                onPress={() => { setCustom(false); setAmount(p); }}
              >
                <Text style={[t.pillT, selected && t.pillTOn]}>RM {p}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[t.pill, custom && t.pillOn]} onPress={() => setCustom(true)}>
            <Text style={[t.pillT, custom && t.pillTOn]}>Other</Text>
          </TouchableOpacity>
        </View>

        <Text style={t.note}>
          Payment opens on a secure payment page in your browser. Available methods
          (card / FPX / Touch 'n Go / DuitNow) depend on the active payment gateway.
        </Text>
      </ScrollView>
      <View style={t.footer}>
        <GradientButton
          label={valid ? `Top up RM ${effective}` : "Top up"}
          onPress={pay}
          loading={busy}
          disabled={!valid}
        />
      </View>
    </SafeAreaView>
  );
}

const t = StyleSheet.create({
  amountCard: { alignItems: "center", paddingVertical: 24, marginBottom: 16, borderRadius: 20 },
  amountLabel: { ...type.caption, fontSize: 10.5, color: C.faint },
  amountRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8 },
  rm: { ...type.cardTitle, fontSize: 22, color: C.faint, marginBottom: 8 },
  amountN: { ...type.screenTitle, fontSize: 48, color: C.navy, lineHeight: 54 },
  amountInput: { ...type.screenTitle, fontSize: 48, color: C.navy, minWidth: 120, padding: 0, borderBottomWidth: 2, borderBottomColor: C.teal },
  newBalance: { ...type.body, fontSize: 12.5, color: C.body, marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  pill: {
    width: "31%", height: 48, borderRadius: 14, backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: C.line, alignItems: "center", justifyContent: "center",
    ...shadows.neutralCard,
  },
  pillOn: { backgroundColor: "#eaf4f3", borderWidth: 2, borderColor: C.teal },
  pillT: { ...type.bodySemibold, fontSize: 13.5, color: C.body },
  pillTOn: { color: C.tealDeep },
  note: { ...type.body, fontSize: 11.5, color: C.faint, lineHeight: 16 },
  footer: { padding: spacing.screenPad, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: C.line },
});
