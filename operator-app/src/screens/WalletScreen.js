import React from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius, gradients } from "../theme/tokens";
import { getOperatorWallet } from "../api/client";
import Header from "./_Header";
import Card from "../components/ui/Card";

// Prepaid fee float (Grab agent model): platform fees for cash trips deduct
// from this balance on completion; if it can't cover a job's fee, that job
// is offered to someone else. Top-ups are manual for the pilot (bank
// transfer → admin credits the wallet); self-serve top-up comes with the
// payment provider integration.

const TX_META = {
  topup: { label: "Top-up", icon: "arrow-down-circle", color: C.green },
  service_fee: { label: "Platform fee", icon: "remove-circle", color: C.red },
  trip_earning: { label: "Trip earning", icon: "cash", color: C.green },
  withdrawal: { label: "Withdrawal", icon: "arrow-up-circle", color: C.body },
  adjustment: { label: "Adjustment", icon: "create", color: C.body },
};

function txDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function WalletScreen({ navigation }) {
  const [state, setState] = React.useState({ loading: true, refreshing: false, error: null, balance: 0, transactions: [] });

  const load = React.useCallback(async (refreshing = false) => {
    setState((s) => ({ ...s, loading: !refreshing, refreshing, error: null }));
    try {
      const w = await getOperatorWallet();
      setState({ loading: false, refreshing: false, error: null, balance: w.balance, transactions: w.transactions });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, refreshing: false, error: e.message || "Could not load wallet." }));
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const low = state.balance < 30; // heads-up threshold; the hard gate is per-job fee

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <Header title="Wallet" onBack={() => navigation.goBack()} />
      {state.loading ? (
        <View style={w.center}><ActivityIndicator color={C.teal} size="large" /></View>
      ) : state.error ? (
        <View style={w.center}>
          <Text style={w.errorT}>{state.error}</Text>
          <TouchableOpacity style={w.retryBtn} onPress={() => load()}><Text style={w.retryT}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={state.transactions}
          keyExtractor={(t) => t.id}
          refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => load(true)} tintColor={C.teal} />}
          contentContainerStyle={{ padding: spacing.screenPad, paddingBottom: 30 }}
          ListHeaderComponent={
            <>
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={w.balanceCard}>
                <Text style={w.balanceL}>AVAILABLE BALANCE</Text>
                <Text style={w.balanceN}>RM {state.balance.toFixed(2)}</Text>
                <Text style={w.balanceSub}>Platform fees deduct from this balance when a trip completes.</Text>
              </LinearGradient>

              {low && (
                <View style={w.warnCard}>
                  <Ionicons name="alert-circle" size={18} color={C.red} />
                  <Text style={w.warnT}>
                    Low balance — jobs whose platform fee exceeds your balance will be offered to other operators. Top up to keep receiving every job.
                  </Text>
                </View>
              )}

              <Card style={{ marginBottom: spacing.cardGap }}>
                <Text style={w.sect}>HOW TO TOP UP</Text>
                <Text style={w.body}>
                  Bank-transfer the amount to Lifeline and send the receipt to your Lifeline
                  contact — your wallet is credited the same day. In-app top-up is coming soon.
                </Text>
              </Card>

              <Text style={w.sect}>HISTORY</Text>
              {state.transactions.length === 0 && <Text style={w.empty}>No transactions yet.</Text>}
            </>
          }
          renderItem={({ item: t }) => {
            const meta = TX_META[t.type] || { label: t.type, icon: "ellipse", color: C.body };
            return (
              <Card style={w.txCard}>
                <Ionicons name={meta.icon} size={20} color={meta.color} />
                <View style={{ flex: 1 }}>
                  <Text style={w.txLabel}>{meta.label}</Text>
                  {!!t.note && <Text style={w.txNote} numberOfLines={1}>{t.note}</Text>}
                  <Text style={w.txDate}>{txDate(t.createdAt)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[w.txAmt, { color: t.amount >= 0 ? C.green : C.red }]}>
                    {t.amount >= 0 ? "+" : "−"}RM {Math.abs(t.amount).toFixed(2)}
                  </Text>
                  <Text style={w.txBal}>bal RM {t.balanceAfter.toFixed(2)}</Text>
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const w = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorT: { fontSize: 13, color: C.red, textAlign: "center", marginBottom: 12 },
  retryBtn: { backgroundColor: C.teal, borderRadius: radius.button, paddingVertical: 11, paddingHorizontal: 26 },
  retryT: { ...type.buttonLabel, fontSize: 13.5, color: "#fff" },
  balanceCard: { borderRadius: radius.card, padding: 20, marginBottom: spacing.cardGap },
  balanceL: { ...type.caption, fontSize: 10.5, color: "rgba(255,255,255,0.75)" },
  balanceN: { ...type.screenTitle, fontSize: 34, color: "#fff", marginVertical: 4 },
  balanceSub: { ...type.body, fontSize: 11.5, color: "rgba(255,255,255,0.8)" },
  warnCard: {
    flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: C.redSoft,
    borderRadius: radius.card, padding: 14, marginBottom: spacing.cardGap,
  },
  warnT: { flex: 1, ...type.body, fontSize: 12, color: C.red, lineHeight: 17 },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8 },
  body: { ...type.body, fontSize: 12.5, color: C.body, lineHeight: 18 },
  empty: { ...type.body, fontSize: 12.5, color: C.faint, marginBottom: 10 },
  txCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 8 },
  txLabel: { ...type.bodySemibold, fontSize: 13, color: C.ink },
  txNote: { ...type.body, fontSize: 11, color: C.faint, marginTop: 1 },
  txDate: { ...type.body, fontSize: 10.5, color: C.faint, marginTop: 2 },
  txAmt: { ...type.bodySemibold, fontSize: 13.5 },
  txBal: { ...type.body, fontSize: 10.5, color: C.faint, marginTop: 2 },
});
