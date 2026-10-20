import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { getOperatorWallet, getOperatorStatement, getPayTo, getPaymentsStatus } from "../api/client";
import Header from "./_Header";
import Card from "../components/ui/Card";

// How to pay (monthly billing, 2026-10-20). Patients pay the operator
// directly; Lifeline's platform fees build up in the wallet as an amount
// owed and are billed monthly. The operator pays by bank transfer / DuitNow
// to the company details the admin sets in Settings, and the admin records
// the payment — so nothing here moves money in-app. If an online gateway is
// configured, the old card/FPX top-up stays available as an extra option.

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={p.detailRow}>
      <Text style={p.detailL}>{label}</Text>
      <Text style={p.detailV} selectable>{value}</Text>
    </View>
  );
}

export default function PayBillScreen({ navigation }) {
  const [state, setState] = React.useState({ loading: true, error: null });

  const load = React.useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      const [wallet, statement, payTo, payments] = await Promise.all([
        getOperatorWallet(),
        getOperatorStatement(),
        getPayTo(),
        getPaymentsStatus().catch(() => ({ enabled: false })),
      ]);
      setState({ loading: false, error: null, wallet, statement, payTo, onlineEnabled: !!payments.enabled });
    } catch (e) {
      setState({ loading: false, error: e.message || "Could not load billing details." });
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const { wallet, statement, payTo } = state;
  const hasBank = payTo && (payTo.accountName || payTo.bankName || payTo.accountNumber);
  const hasAnyDetails = hasBank || payTo?.qrImage || payTo?.instructions;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7fafa" }} edges={["top"]}>
      <Header title="How to pay" onBack={() => navigation.goBack()} />
      {state.loading ? (
        <View style={p.center}><ActivityIndicator color={C.teal} size="large" /></View>
      ) : state.error ? (
        <View style={p.center}>
          <Text style={p.errorT}>{state.error}</Text>
          <TouchableOpacity style={p.retryBtn} onPress={load}><Text style={p.retryT}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.screenPad }}>
          <Card style={p.owedCard}>
            <Text style={p.owedL}>{wallet.amountOwed > 0 ? "AMOUNT OWED TO LIFELINE" : "NOTHING OWED"}</Text>
            <Text style={p.owedN}>RM {wallet.amountOwed.toFixed(2)}</Text>
            <Text style={p.owedS}>
              This month: {statement.trips} trip{statement.trips === 1 ? "" : "s"} · RM {statement.fees.toFixed(2)} in platform fees
            </Text>
            {wallet.creditLimit > 0 && (
              <Text style={p.owedS}>
                Credit limit RM {wallet.creditLimit.toFixed(0)} · RM {Math.max(0, wallet.availableCredit).toFixed(2)} left before new jobs pause
              </Text>
            )}
          </Card>

          <Text style={p.sect}>PAY BY BANK TRANSFER OR DUITNOW</Text>
          {!hasAnyDetails ? (
            <Card style={{ padding: 16 }}>
              <Text style={p.body}>
                Lifeline hasn't added its payment details yet. Please contact Lifeline support for
                where to send your payment.
              </Text>
            </Card>
          ) : (
            <Card style={{ padding: 16 }}>
              <DetailRow label="Account name" value={payTo.accountName} />
              <DetailRow label="Bank" value={payTo.bankName} />
              <DetailRow label="Account number" value={payTo.accountNumber} />
              {!!payTo.qrImage && (
                <View style={p.qrWrap}>
                  <Image source={{ uri: payTo.qrImage }} style={p.qr} resizeMode="contain" accessibilityLabel="Lifeline DuitNow QR" />
                  <Text style={p.qrHint}>Scan with your banking app or Touch 'n Go eWallet, then enter the amount.</Text>
                </View>
              )}
              {!!payTo.instructions && <Text style={[p.body, { marginTop: 10 }]}>{payTo.instructions}</Text>}
            </Card>
          )}

          <View style={p.notice}>
            <Ionicons name="information-circle-outline" size={17} color={C.tealDeep} />
            <Text style={p.noticeT}>
              Patients pay you directly for each trip. Lifeline's platform fee is billed monthly.
              After you pay, your balance updates once Lifeline confirms the transfer.
            </Text>
          </View>

          {state.onlineEnabled && (
            <TouchableOpacity style={p.onlineBtn} onPress={() => navigation.navigate("TopUp")}>
              <Text style={p.onlineBtnT}>Pay online instead (card / FPX)</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const p = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorT: { ...type.body, fontSize: 13, color: C.body, textAlign: "center", marginBottom: 12 },
  retryBtn: { backgroundColor: C.teal, borderRadius: radius.button, paddingVertical: 11, paddingHorizontal: 26 },
  retryT: { ...type.buttonLabel, fontSize: 13.5, color: "#fff" },
  owedCard: { alignItems: "center", paddingVertical: 22, marginBottom: 18, borderRadius: 20 },
  owedL: { ...type.caption, fontSize: 10.5, color: C.faint },
  owedN: { ...type.screenTitle, fontSize: 40, color: C.navy, marginTop: 6 },
  owedS: { ...type.body, fontSize: 12, color: C.body, marginTop: 6, textAlign: "center" },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7 },
  detailL: { ...type.body, fontSize: 12.5, color: C.faint },
  detailV: { ...type.bodySemibold, fontSize: 13.5, color: C.ink, flexShrink: 1, textAlign: "right" },
  qrWrap: { alignItems: "center", marginTop: 12 },
  qr: { width: 220, height: 220, borderRadius: 12, backgroundColor: "#fff" },
  qrHint: { ...type.body, fontSize: 11.5, color: C.faint, marginTop: 8, textAlign: "center" },
  body: { ...type.body, fontSize: 12.5, color: C.body, lineHeight: 18 },
  notice: {
    flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#eaf4f3",
    borderRadius: radius.card, padding: 13, marginTop: 16,
  },
  noticeT: { flex: 1, ...type.body, fontSize: 12, color: C.body, lineHeight: 17 },
  onlineBtn: { alignItems: "center", paddingVertical: 16 },
  onlineBtnT: { ...type.bodySemibold, fontSize: 13, color: C.tealDeep, textDecorationLine: "underline" },
});
