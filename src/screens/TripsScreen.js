import React from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius, shadows } from "../theme/tokens";
import { getMyBookings, ApiError } from "../api/client";
import { BookingContext } from "../../App";
import Header from "./_Header";
import BottomTabBar from "../components/ui/BottomTabBar";
import Card from "../components/ui/Card";
import StatusPill from "../components/ui/StatusPill";

// Booking status -> pill variant. Statuses per the locked state machine in
// CLAUDE.md — don't add cases without updating that list and the backend enum.
const STATUS_PILL = {
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "neutral" },
  expired: { label: "No operator", variant: "danger" },
  declined: { label: "Declined", variant: "danger" },
  requested: { label: "Requested", variant: "warning" },
  offered: { label: "Finding unit", variant: "warning" },
  accepted: { label: "Accepted", variant: "active" },
  enroute: { label: "En route", variant: "active" },
  arrived: { label: "Arrived", variant: "active" },
  onboard: { label: "Onboard", variant: "active" },
};

function tripDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function TripsScreen({ navigation }) {
  const { update } = React.useContext(BookingContext);
  const [state, setState] = React.useState({ loading: true, refreshing: false, error: null, trips: [] });

  // TrackingScreen reads bookingId from BookingContext — point it at the
  // tapped trip. Its event timeline works for every status, including
  // scheduled trips that haven't dispatched yet.
  function openTrip(t) {
    update({ bookingId: t.id, bookingStatus: t.status });
    navigation.navigate("Tracking");
  }

  const load = React.useCallback(async (refreshing = false) => {
    setState((s) => ({ ...s, loading: !refreshing, refreshing, error: null }));
    try {
      const trips = await getMyBookings();
      setState({ loading: false, refreshing: false, error: null, trips });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Could not reach the server. Check your connection.";
      setState((s) => ({ ...s, loading: false, refreshing: false, error: message }));
    }
  }, []);

  React.useEffect(() => {
    load();
    // Refetch when the tab is revisited — a trip may have just completed.
    const unsub = navigation.addListener("focus", () => load(true));
    return unsub;
  }, [load, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f8f8" }} edges={["top"]}>
      <Header title="Trips" onBack={() => navigation.goBack()} />

      {state.loading && (
        <View style={s.center}>
          <ActivityIndicator color={C.teal} size="large" />
        </View>
      )}

      {!state.loading && state.error && state.trips.length === 0 && (
        <View style={s.center}>
          <Text style={s.errorT}>{state.error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
            <Text style={s.retryBtnT}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!state.loading && !state.error && state.trips.length === 0 && (
        <View style={s.center}>
          <Ionicons name="list-outline" size={40} color={C.faint} />
          <Text style={s.emptyTitle}>No trips yet</Text>
          <Text style={s.emptySub}>Your bookings will show up here.</Text>
        </View>
      )}

      {state.trips.length > 0 && (
        <FlatList
          data={state.trips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing.screenPad, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => load(true)} tintColor={C.teal} />}
          renderItem={({ item: t }) => {
            const scheduledPending = t.scheduledAt && t.status === "requested";
            const pill = scheduledPending
              ? { label: "Scheduled", variant: "active" }
              : STATUS_PILL[t.status] || { label: t.status, variant: "neutral" };
            return (
              <TouchableOpacity activeOpacity={0.85} onPress={() => openTrip(t)}>
              <Card style={s.card}>
                <View style={s.topRow}>
                  <Text style={s.date}>{tripDate(t.createdAt)}</Text>
                  <StatusPill label={pill.label} variant={pill.variant} />
                </View>
                {t.scheduledAt && (
                  <Text style={s.scheduled}>Pickup: {tripDate(t.scheduledAt)}</Text>
                )}
                <View style={s.routeRow}>
                  <View style={s.routeIcons}>
                    <View style={[s.dot, { backgroundColor: C.green }]} />
                    <View style={s.routeLine} />
                    <View style={[s.dotSq, { backgroundColor: C.teal }]} />
                  </View>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={s.place} numberOfLines={1}>{t.pickupName}</Text>
                    <Text style={s.place} numberOfLines={1}>{t.destinationName}</Text>
                  </View>
                </View>
                <View style={s.bottomRow}>
                  <Text style={s.op} numberOfLines={1}>
                    {t.operator?.name || "—"}
                    {t.rating ? `  ·  ★ ${t.rating.stars}` : ""}
                  </Text>
                  <Text style={s.price}>{t.total != null ? `RM${t.total.toFixed(0)}` : ""}</Text>
                </View>
              </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <BottomTabBar navigation={navigation} active="Trips" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.screenPad, gap: 8 },
  errorT: { fontSize: 13, color: C.red, textAlign: "center", marginBottom: 10 },
  retryBtn: { backgroundColor: C.teal, borderRadius: radius.button, paddingVertical: 11, paddingHorizontal: 26 },
  retryBtnT: { ...type.buttonLabel, fontSize: 13.5, color: "#fff" },
  emptyTitle: { ...type.cardTitle, fontSize: 16, color: C.ink },
  emptySub: { ...type.body, fontSize: 13, color: C.faint, textAlign: "center" },
  card: { padding: spacing.cardPad, marginBottom: spacing.cardGap, ...shadows.neutralCard },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  date: { ...type.body, fontSize: 12, color: C.faint },
  scheduled: { ...type.bodySemibold, fontSize: 12.5, color: C.tealDeep, marginBottom: 10, marginTop: -4 },
  routeRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  routeIcons: { alignItems: "center", paddingTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotSq: { width: 10, height: 10, borderRadius: 2 },
  routeLine: { width: 1.5, flex: 1, backgroundColor: C.line, marginVertical: 3 },
  place: { ...type.bodySemibold, fontSize: 13.5, color: C.ink },
  bottomRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line,
  },
  op: { ...type.body, fontSize: 12.5, color: C.body, flex: 1, marginRight: 10 },
  price: { ...type.cardTitle, fontSize: 15, color: C.tealDeep },
});
