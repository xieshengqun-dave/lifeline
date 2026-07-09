import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius, shadows } from "../theme/tokens";
import { BookingContext } from "../../App";
import { getBooking, getTracking } from "../api/client";
import { subscribeToBooking } from "../api/socket";
import Header from "./_Header";

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS = {
  requested: "Requested", offered: "Offered", accepted: "Accepted", enroute: "Ambulance en route to you",
  arrived: "Ambulance has arrived", onboard: "Patient onboard", completed: "Trip completed",
};

export default function TrackingScreen({ navigation }) {
  const { booking, resetDraft } = React.useContext(BookingContext);
  const bookingId = booking.bookingId;
  const [loading, setLoading] = React.useState(true);
  const [details, setDetails] = React.useState(null);
  const [status, setStatus] = React.useState(booking.bookingStatus);
  const [events, setEvents] = React.useState([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [b, tracking] = await Promise.all([getBooking(bookingId), getTracking(bookingId)]);
      if (cancelled) return;
      setDetails(b);
      setStatus(b.status);
      setEvents(tracking);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  React.useEffect(() => {
    if (loading) return;
    const unsubscribe = subscribeToBooking(bookingId, {
      onTrackingEvent: (payload) => {
        setEvents((prev) => (prev.some((e) => e.id === payload.event.id) ? prev : [...prev, payload.event]));
      },
      onStatusChanged: (payload) => setStatus(payload.status),
    });
    return unsubscribe;
  }, [loading, bookingId]);

  function backToHome() {
    if (status === "completed") {
      navigation.replace("Rating");
      return;
    }
    resetDraft();
    navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.card }}>
        <ActivityIndicator color={C.teal} size="large" />
      </SafeAreaView>
    );
  }

  const crew = details.crew;
  const ambulance = details.ambulance;
  const operator = details.operator;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={["top"]}>
      <Header title="Live Tracking" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPad }}>
        <View style={tr.etaBanner}>
          <View style={tr.etaIconTile}>
            <Ionicons name="medical" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={tr.etaSmall}>{STATUS_LABELS[status] || status}</Text>
          </View>
          {["enroute", "accepted", "arrived", "onboard"].includes(status) && (
            <View style={tr.livePill}>
              <View style={tr.liveDot} />
              <Text style={tr.livePillT}>LIVE</Text>
            </View>
          )}
        </View>

        {/* TODO (Claude Code): live ambulance position via socket + MapView —
            operators only have a fixed base location in v1 (no live GPS),
            so there's no real moving-position data to back this yet. */}
        <View style={tr.mapPlaceholder}>
          <Ionicons name="map-outline" size={22} color={C.faint} />
          <Text style={tr.mapPlaceholderT}>Live map — coming with operator live GPS</Text>
        </View>

        <View style={tr.crew}>
          <View style={tr.avatar}>
            <Text style={tr.avatarT}>{crew ? crew.name.split(" ").map((n) => n[0]).join("").slice(0, 2) : "?"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={tr.name}>{crew ? crew.name : "Crew not yet assigned"}</Text>
            <Text style={tr.role}>
              {crew ? crew.role : "—"} · {ambulance ? ambulance.plate : "Ambulance not yet assigned"}
            </Text>
          </View>
          {operator?.phone && (
            <TouchableOpacity style={tr.callBtn} onPress={() => Linking.openURL(`tel:${operator.phone}`)}>
              <Ionicons name="call" size={17} color={C.tealDeep} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={tr.sect}>TRIP PROGRESS</Text>
        {events.map((e, i) => (
          <View key={e.id} style={tr.step}>
            <View style={tr.connector}>
              <View style={[tr.pdot, tr.pdotDone]}><Ionicons name="checkmark" size={12} color="#fff" /></View>
              {i < events.length - 1 && <View style={tr.line} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 16 }}>
              <Text style={tr.pn}>{e.label}</Text>
              <Text style={tr.time}>{formatTime(e.createdAt)}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={tr.btn} onPress={backToHome}>
          <Text style={tr.btnT}>{status === "completed" ? "Done" : "Back to Home"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
const tr = StyleSheet.create({
  etaBanner: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.navy, borderRadius: radius.card,
    padding: 16, marginBottom: spacing.cardGap, ...shadows.neutralCard,
  },
  etaIconTile: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  etaSmall: { ...type.cardTitle, fontSize: 15, color: "#fff" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#7fffdc" },
  livePillT: { ...type.caption, fontSize: 10, color: "#7fffdc" },
  mapPlaceholder: { height: 140, borderRadius: radius.card, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", marginBottom: spacing.cardGap, gap: 6 },
  mapPlaceholderT: { ...type.body, fontSize: 12, color: C.faint },
  crew: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20, backgroundColor: "#fff", borderRadius: radius.card, padding: 14, borderWidth: 1, borderColor: C.line },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  avatarT: { ...type.cardTitle, color: "#fff", fontSize: 16 },
  name: { ...type.cardTitle, fontSize: 15, color: C.ink },
  role: { ...type.body, fontSize: 11.5, color: C.faint },
  callBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.tealSoft, alignItems: "center", justifyContent: "center" },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 14 },
  step: { flexDirection: "row" },
  connector: { alignItems: "center", marginRight: 12 },
  pdot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  pdotDone: { backgroundColor: C.teal },
  line: { width: 2, flex: 1, backgroundColor: C.tealLine, marginTop: 2 },
  pn: { ...type.bodySemibold, fontSize: 13.5, color: C.ink },
  time: { ...type.body, fontSize: 11.5, color: C.faint, marginTop: 2 },
  btn: { backgroundColor: C.navy, borderRadius: radius.button, padding: 15, alignItems: "center", marginTop: 8 },
  btnT: { ...type.buttonLabel, fontSize: 15.5, color: "#fff" },
});
