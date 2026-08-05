import React from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius, shadows } from "../theme/tokens";
import { getOperatorWallet } from "../api/client";
import Card from "../components/ui/Card";
import BottomTabBar from "../components/ui/BottomTabBar";

// W2 · Wallet & transactions. Float-account model: trip fares credit in
// full, platform commission deducts as its own auditable row (two lines per
// prepaid trip), top-ups add funds, and the BO-set minimum balance gates the
// online toggle. Spec deltas kept honest: no "pending/24h hold" card (no
// clearing system exists) and commission shows the REAL BO-configured fee,
// not the mock's hardcoded 15%.

const TX_META = {
  topup: { label: "Top up", icon: "add", tile: "#eaf4f3", color: C.tealDeep, amountColor: C.green },
  service_fee: { label: "Platform commission", icon: "remove", tile: "#eef2f4", color: C.body, amountColor: C.red },
  trip_earning: { label: "Trip fare", icon: "arrow-up", tile: "#eaf6ef", color: C.green, amountColor: C.green },
  withdrawal: { label: "Withdrawal", icon: "arrow-down", tile: "#eef2f4", color: C.body, amountColor: C.red },
  adjustment: { label: "Adjustment", icon: "create-outline", tile: "#eef2f4", color: C.body, amountColor: C.body },
};

function txDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    ", " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function WalletScreen({ navigation }) {
  const [state, setState] = React.useState({
    loading: true, refreshing: false, error: null,
    balance: 0, minBalance: 50, fee: null, transactions: [],
  });

  const load = React.useCallback(async (refreshing = false) => {
    setState((s) => ({ ...s, loading: !refreshing, refreshing, error: null }));
    try {
      const w = await getOperatorWallet();
      setState({
        loading: false, refreshing: false, error: null,
        balance: w.balance, minBalance: w.minBalance ?? 50, fee: w.fee, transactions: w.transactions,
      });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, refreshing: false, error: e.message || "Could not load wallet." }));
    }
  }, []);

  React.useEffect(() => {
    load();
    const unsub = navigation.addListener("focus", () => load(true));
    return unsub;
  }, [load, navigation]);

  const feeLabel = state.fee
    ? state.fee.feeType === "percent" ? `${state.fee.feeValue}%` : `RM ${state.fee.feeValue.toFixed(0)}`
    : "—";

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={[C.navy, "#12545c"]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={w.band} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <Text style={w.bandTitle}>Wallet</Text>
        {state.loading ? (
          <View style={w.center}><ActivityIndicator color="#fff" size="large" /></View>
        ) : state.error ? (
          <View style={w.center}>
            <Text style={w.errorT}>{state.error}</Text>
            <TouchableOpacity style={w.retryBtn} onPress={() => load()}><Text style={w.retryT}>Retry</Text></TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={state.transactions}
            keyExtractor={(t) => t.id}
            refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => load(true)} tintColor="#fff" />}
            contentContainerStyle={{ paddingHorizontal: spacing.screenPad, paddingBottom: 20 }}
            ListHeaderComponent={
              <>
                <Text style={w.balanceL}>AVAILABLE BALANCE</Text>
                <Text style={w.balanceN}>RM {state.balance.toFixed(2)}</Text>
                <TouchableOpacity style={w.topupBtn} activeOpacity={0.9} onPress={() => navigation.navigate("TopUp")}>
                  <Ionicons name="add" size={17} color={C.tealDeep} />
                  <Text style={w.topupBtnT}>Top up</Text>
                </TouchableOpacity>

                <View style={w.infoRow}>
                  <Card style={w.infoCard}>
                    <Text style={w.infoL}>COMMISSION</Text>
                    <Text style={w.infoN}>{feeLabel}</Text>
                    <Text style={w.infoS}>auto-deducted per trip</Text>
                  </Card>
                  <Card style={w.infoCard}>
                    <Text style={w.infoL}>MIN BALANCE</Text>
                    <Text style={w.infoN}>RM {state.minBalance.toFixed(0)}</Text>
                    <Text style={w.infoS}>required to go online</Text>
                  </Card>
                </View>

                {state.minBalance > 0 && (
                  <View style={w.notice}>
                    <Ionicons name="information-circle-outline" size={17} color={C.tealDeep} />
                    <Text style={w.noticeT}>
                      Keep at least <Text style={{ fontWeight: "800" }}>RM {state.minBalance.toFixed(0)}</Text> to
                      stay online. Commission for each completed trip is deducted automatically.
                    </Text>
                  </View>
                )}

                <Text style={w.sect}>TRANSACTIONS</Text>
                {state.transactions.length === 0 && <Text style={w.empty}>No transactions yet.</Text>}
              </>
            }
            renderItem={({ item: t }) => {
              const meta = TX_META[t.type] || { label: t.type, icon: "ellipse", tile: "#eef2f4", color: C.body, amountColor: C.body };
              return (
                <Card style={w.txCard}>
                  <View style={[w.txTile, { backgroundColor: meta.tile }]}>
                    <Ionicons name={meta.icon} size={17} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={w.txLabel}>{meta.label}</Text>
                    {!!t.note && <Text style={w.txNote} numberOfLines={1}>{t.note}</Text>}
                    <Text style={w.txDate}>{txDate(t.createdAt)}</Text>
                  </View>
                  <Text style={[w.txAmt, { color: meta.amountColor }]}>
                    {t.amount >= 0 ? "+" : "−"}{Math.abs(t.amount).toFixed(2)}
                  </Text>
                </Card>
              );
            }}
          />
        )}
        <BottomTabBar navigation={navigation} active="Wallet" />
      </SafeAreaView>
    </View>
  );
}

const w = StyleSheet.create({
  band: { position: "absolute", top: 0, left: 0, right: 0, height: 330 },
  bandTitle: { ...type.screenTitle, fontSize: 19, color: "#fff", textAlign: "center", paddingVertical: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorT: { fontSize: 13, color: "#fff", textAlign: "center", marginBottom: 12 },
  retryBtn: { backgroundColor: "#fff", borderRadius: radius.button, paddingVertical: 11, paddingHorizontal: 26 },
  retryT: { ...type.buttonLabel, fontSize: 13.5, color: C.tealDeep },
  balanceL: { ...type.caption, fontSize: 11, color: "rgba(255,255,255,0.65)", textAlign: "center", marginTop: 6 },
  balanceN: { ...type.screenTitle, fontSize: 44, color: "#fff", textAlign: "center", marginTop: 4 },
  topupBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#fff", borderRadius: 15, paddingVertical: 14, marginTop: 16, marginBottom: 18,
    ...shadows.cardLift,
  },
  topupBtnT: { ...type.buttonLabel, fontSize: 14.5, color: C.tealDeep },
  infoRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  infoCard: { flex: 1, paddingVertical: 14 },
  infoL: { ...type.caption, fontSize: 10, color: C.faint },
  infoN: { ...type.screenTitle, fontSize: 20, color: C.ink, marginTop: 4 },
  infoS: { ...type.body, fontSize: 10.5, color: C.faint, marginTop: 2 },
  notice: {
    flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#eaf4f3",
    borderRadius: radius.card, padding: 13, marginBottom: 16,
  },
  noticeT: { flex: 1, ...type.body, fontSize: 12, color: C.body, lineHeight: 17 },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8 },
  empty: { ...type.body, fontSize: 12.5, color: C.faint, marginBottom: 10 },
  txCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, marginBottom: 8 },
  txTile: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txLabel: { ...type.bodySemibold, fontSize: 13, color: C.ink },
  txNote: { ...type.body, fontSize: 11, color: C.faint, marginTop: 1 },
  txDate: { ...type.body, fontSize: 10.5, color: C.faint, marginTop: 2 },
  txAmt: { ...type.cardTitle, fontSize: 15 },
});
