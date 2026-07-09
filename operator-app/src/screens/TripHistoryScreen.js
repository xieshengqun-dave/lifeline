import React from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { gradients, type, spacing, radius } from "../theme/tokens";
import { getOperatorBookings } from "../api/client";
import Header from "./_Header";

const RANGES = [
  { key: "week", label: "This week", days: 7 },
  { key: "month", label: "Month", days: 30 },
  { key: "all", label: "All", days: null },
];

// "Next payout" and declined-offer rows are both omitted here, not faked —
// there's no real payout/settlement system, and a booking's operatorId no
// longer points at an operator who declined it (only the current/final one),
// so a true declined-history list needs a separate BookingOffer-scoped query
// this pass didn't build. Trips/earnings/avg-per-trip below are all real,
// computed from actually-fetched data.
export default function TripHistoryScreen({ navigation }) {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [bookings, setBookings] = React.useState([]);
  const [range, setRange] = React.useState("week");

  const load = React.useCallback(async () => {
    const list = await getOperatorBookings();
    setBookings(list);
  }, []);

  React.useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const rangeSpec = RANGES.find((r) => r.key === range);
  const cutoff = rangeSpec.days ? Date.now() - rangeSpec.days * 86400000 : 0;
  const completed = bookings.filter((b) => b.status === "completed");
  const inRange = completed.filter((b) => new Date(b.updatedAt).getTime() >= cutoff);
  const total = inRange.reduce((sum, b) => sum + b.subtotal, 0);
  const avgPerTrip = inRange.length ? total / inRange.length : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <Header title="Earnings & History" onBack={() => navigation.goBack()} />
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={h.band}>
        <Text style={h.bandLabel}>{rangeSpec.label}'s earnings</Text>
        <Text style={h.bandN}>RM {total.toFixed(0)}</Text>
        <Text style={h.bandMeta}>Trips {inRange.length} · Avg / trip RM {avgPerTrip.toFixed(0)}</Text>
      </LinearGradient>

      <View style={h.chipRow}>
        {RANGES.map((r) => (
          <TouchableOpacity key={r.key} style={[h.chip, range === r.key && h.chipOn]} onPress={() => setRange(r.key)}>
            <Text style={[h.chipT, range === r.key && h.chipTOn]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={h.center}><ActivityIndicator color={C.teal} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPad }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
        >
          {inRange.length === 0 && <Text style={h.empty}>No completed trips in this range.</Text>}
          {inRange.map((b) => (
            <View key={b.id} style={h.row}>
              <View style={h.iconTile}>
                <Ionicons name="checkmark" size={16} color={C.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={h.route}>{b.pickupName} → {b.destinationName}</Text>
                <Text style={h.date}>{new Date(b.updatedAt).toLocaleDateString()} · {b.ambulance?.type || "—"}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={h.fare}>+RM {b.subtotal.toFixed(2)}</Text>
                <Text style={h.status}>Completed</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const h = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  band: { padding: spacing.screenPad, paddingBottom: 24 },
  bandLabel: { ...type.body, fontSize: 13, color: "rgba(255,255,255,0.75)" },
  bandN: { ...type.bigNumeral, fontSize: 38, color: "#fff", marginTop: 4 },
  bandMeta: { ...type.bodySemibold, fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 8 },
  chipRow: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.screenPad, marginTop: -12, marginBottom: 8 },
  chip: { backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
  chipT: { ...type.bodySemibold, fontSize: 12.5, color: C.body },
  chipTOn: { color: "#fff" },
  empty: { ...type.body, fontSize: 12.5, color: C.faint, textAlign: "center", marginTop: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: radius.card, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  iconTile: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#eaf6ef", alignItems: "center", justifyContent: "center" },
  route: { ...type.bodySemibold, fontSize: 13, color: C.ink },
  date: { ...type.body, fontSize: 11, color: C.faint, marginTop: 3 },
  fare: { ...type.cardTitle, fontSize: 13, color: C.green },
  status: { ...type.body, fontSize: 10, color: C.faint, marginTop: 2 },
});
