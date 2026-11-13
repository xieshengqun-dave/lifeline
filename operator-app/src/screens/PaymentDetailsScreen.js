import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { getPaymentDetails } from "../api/client";
import Header from "./_Header";
import Card from "../components/ui/Card";

// Where patients pay this operator (2026-11-13) — the bank details and
// DuitNow QR patients see in their app and the crew shows at the end of a
// trip. Read-only on purpose: Lifeline's back office sets it after checking
// the account belongs to the operator, so a stolen login can't redirect
// patients' money.

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={d.detailRow}>
      <Text style={d.detailL}>{label}</Text>
      <Text style={d.detailV} selectable>{value}</Text>
    </View>
  );
}

export default function PaymentDetailsScreen({ navigation }) {
  const [state, setState] = React.useState({ loading: true, error: null, details: null });

  const load = React.useCallback(async () => {
    setState({ loading: true, error: null, details: null });
    try {
      setState({ loading: false, error: null, details: await getPaymentDetails() });
    } catch (e) {
      setState({ loading: false, error: e.message || "Could not load your payment details.", details: null });
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const p = state.details;
  const hasAny = p && (p.accountName || p.bankName || p.accountNumber || p.instructions || p.qrImage);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <Header title="Payment details" onBack={() => navigation.goBack()} />
      {state.loading ? (
        <View style={d.center}><ActivityIndicator color={C.teal} size="large" /></View>
      ) : state.error ? (
        <View style={d.center}>
          <Text style={d.errorT}>{state.error}</Text>
          <TouchableOpacity style={d.retryBtn} onPress={load}><Text style={d.retryT}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.screenPad }}>
          <Text style={d.sect}>HOW PATIENTS PAY YOU</Text>
          {hasAny ? (
            <Card style={{ padding: 16 }}>
              <DetailRow label="Account name" value={p.accountName} />
              <DetailRow label="Bank" value={p.bankName} />
              <DetailRow label="Account number" value={p.accountNumber} />
              {!!p.qrImage && (
                <View style={d.qrWrap}>
                  <Image source={{ uri: p.qrImage }} style={d.qr} resizeMode="contain" accessibilityLabel="Your DuitNow QR" />
                </View>
              )}
              {!!p.instructions && <Text style={[d.body, { marginTop: 10 }]}>{p.instructions}</Text>}
            </Card>
          ) : (
            <Card style={{ padding: 16 }}>
              <Text style={d.body}>
                Nothing on file yet, so patients are told to pay your crew in cash. Send Lifeline your
                bank details and DuitNow QR to accept transfers and e-wallet payments too.
              </Text>
            </Card>
          )}

          <View style={d.notice}>
            <Ionicons name="lock-closed-outline" size={16} color={C.tealDeep} />
            <Text style={d.noticeT}>
              Patients pay you directly — this money never passes through Lifeline. To change these
              details, contact Lifeline; for your protection they can't be edited in the app.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const d = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorT: { ...type.body, fontSize: 13, color: C.body, textAlign: "center", marginBottom: 12 },
  retryBtn: { backgroundColor: C.teal, borderRadius: radius.button, paddingVertical: 11, paddingHorizontal: 26 },
  retryT: { ...type.buttonLabel, fontSize: 13.5, color: "#fff" },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8, marginLeft: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7 },
  detailL: { ...type.body, fontSize: 12.5, color: C.faint },
  detailV: { ...type.bodySemibold, fontSize: 13.5, color: C.ink, flexShrink: 1, textAlign: "right" },
  qrWrap: { alignItems: "center", marginTop: 12 },
  qr: { width: 220, height: 220, borderRadius: 12, backgroundColor: "#fff" },
  body: { ...type.body, fontSize: 12.5, color: C.body, lineHeight: 18 },
  notice: {
    flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: C.tealSoft,
    borderRadius: radius.card, padding: 13, marginTop: 16,
  },
  noticeT: { flex: 1, ...type.body, fontSize: 12, color: C.body, lineHeight: 17 },
});
