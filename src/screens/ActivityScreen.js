import React from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { getActivityFeed, ApiError } from "../api/client";
import { BookingContext } from "../../App";
import Header from "./_Header";
import Card from "../components/ui/Card";
import BottomTabBar from "../components/ui/BottomTabBar";

// Real activity feed: the tracking-event timelines of the patient's
// bookings, merged newest-first. Every row is a real recorded event —
// nothing synthesized (this replaced the earlier "Coming soon" placeholder
// once the data existed to back it).

// Icon by event label keywords — labels are human copy written by the
// backend (offerEngine.addTrackingEvent), so match loosely.
function eventIcon(label) {
  const l = label.toLowerCase();
  if (l.includes("payment received") || l.includes("paid")) return { icon: "card", color: C.green };
  if (l.includes("refund")) return { icon: "arrow-undo", color: C.tealDeep };
  if (l.includes("accepted")) return { icon: "checkmark-circle", color: C.green };
  if (l.includes("offer sent")) return { icon: "paper-plane", color: C.tealDeep };
  if (l.includes("declined") || l.includes("cancel")) return { icon: "close-circle", color: C.faint };
  if (l.includes("999") || l.includes("no operators")) return { icon: "warning", color: C.red };
  if (l.includes("en route") || l.includes("arrived") || l.includes("onboard")) return { icon: "navigate", color: C.teal };
  if (l.includes("completed")) return { icon: "flag", color: C.green };
  if (l.includes("scheduled")) return { icon: "calendar", color: C.tealDeep };
  if (l.includes("assigned")) return { icon: "people", color: C.tealDeep };
  return { icon: "ellipse-outline", color: C.faint };
}

function when(iso) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Today, ${time}` : `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time}`;
}

export default function ActivityScreen({ navigation }) {
  const { update } = React.useContext(BookingContext);
  const [state, setState] = React.useState({ loading: true, refreshing: false, error: null, events: [] });

  const load = React.useCallback(async (refreshing = false) => {
    setState((s) => ({ ...s, loading: !refreshing, refreshing, error: null }));
    try {
      const events = await getActivityFeed();
      setState({ loading: false, refreshing: false, error: null, events });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Could not reach the server.";
      setState((s) => ({ ...s, loading: false, refreshing: false, error: message }));
    }
  }, []);

  React.useEffect(() => {
    load();
    const unsub = navigation.addListener("focus", () => load(true));
    return unsub;
  }, [load, navigation]);

  function openBooking(event) {
    update({ bookingId: event.booking.id });
    navigation.navigate("Tracking");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f8f8" }} edges={["top"]}>
      <Header title="Activity" onBack={() => navigation.goBack()} />

      {state.loading && (
        <View style={a.center}><ActivityIndicator color={C.teal} size="large" /></View>
      )}

      {!state.loading && state.error && (
        <View style={a.center}>
          <Text style={a.errorT}>{state.error}</Text>
          <TouchableOpacity style={a.retryBtn} onPress={() => load()}><Text style={a.retryT}>Retry</Text></TouchableOpacity>
        </View>
      )}

      {!state.loading && !state.error && state.events.length === 0 && (
        <View style={a.center}>
          <Ionicons name="time-outline" size={40} color={C.faint} />
          <Text style={a.emptyTitle}>Nothing yet</Text>
          <Text style={a.emptySub}>Booking updates — payments, operator responses, trip progress — will appear here.</Text>
        </View>
      )}

      {state.events.length > 0 && (
        <FlatList
          data={state.events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.screenPad, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => load(true)} tintColor={C.teal} />}
          renderItem={({ item: e }) => {
            const meta = eventIcon(e.label);
            return (
              <TouchableOpacity activeOpacity={0.85} onPress={() => openBooking(e)}>
                <Card style={a.row}>
                  <View style={a.iconTile}>
                    <Ionicons name={meta.icon} size={17} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={a.label}>{e.label}</Text>
                    <Text style={a.route} numberOfLines={1}>
                      {e.booking.pickupName} → {e.booking.destinationName}
                    </Text>
                    <Text style={a.time}>{when(e.createdAt)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={C.faint} />
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <BottomTabBar navigation={navigation} active="Activity" />
    </SafeAreaView>
  );
}

const a = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.screenPad, gap: 8 },
  errorT: { fontSize: 13, color: C.red, textAlign: "center", marginBottom: 10 },
  retryBtn: { backgroundColor: C.teal, borderRadius: radius.button, paddingVertical: 11, paddingHorizontal: 26 },
  retryT: { ...type.buttonLabel, fontSize: 13.5, color: "#fff" },
  emptyTitle: { ...type.cardTitle, fontSize: 16, color: C.ink },
  emptySub: { ...type.body, fontSize: 13, color: C.faint, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, marginBottom: 8 },
  iconTile: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#eef4f5", alignItems: "center", justifyContent: "center" },
  label: { ...type.bodySemibold, fontSize: 13, color: C.ink },
  route: { ...type.body, fontSize: 11.5, color: C.body, marginTop: 1 },
  time: { ...type.body, fontSize: 10.5, color: C.faint, marginTop: 2 },
});
