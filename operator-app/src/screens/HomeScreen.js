import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { gradients, type, spacing, radius, shadows } from "../theme/tokens";
import { AuthContext, OperatorContext } from "../../App";
import { getOperatorMe, getOperatorBookings, getOperatorFleet, setAvailability } from "../api/client";
import Header from "./_Header";
import Card from "../components/ui/Card";

const ACTIVE_STATUSES = ["accepted", "enroute", "arrived", "onboard"];

function isSameLocalDay(iso, now) {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function HomeScreen({ navigation }) {
  const { operator, signOut } = React.useContext(AuthContext);
  const { pendingOffers, online, setOnline } = React.useContext(OperatorContext);
  const [loading, setLoading] = React.useState(true);
  const [bookings, setBookings] = React.useState([]);
  const [fleet, setFleet] = React.useState({ ambulances: [] });
  const [toggling, setToggling] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const [me, list, fleetRes] = await Promise.all([getOperatorMe(), getOperatorBookings(), getOperatorFleet()]);
          if (cancelled) return;
          setOnline(me.online);
          setBookings(list);
          setFleet(fleetRes);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  async function toggleOnline(next) {
    setToggling(true);
    setOnline(next); // optimistic
    try {
      await setAvailability(next);
    } catch {
      setOnline(!next); // rollback
    } finally {
      setToggling(false);
    }
  }

  const now = new Date();
  const completedToday = bookings.filter((b) => b.status === "completed" && isSameLocalDay(b.updatedAt, now));
  const earningsToday = completedToday.reduce((sum, b) => sum + b.subtotal, 0);
  const activeTrips = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status));
  const activeAmbulanceIds = new Set(activeTrips.map((b) => b.ambulance?.id).filter(Boolean));
  const availableCount = fleet.ambulances.length - activeAmbulanceIds.size;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <Header
        title={operator?.name || "Home"}
        right={
          <TouchableOpacity onPress={signOut}>
            <Text style={h.signOut}>Sign Out</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPad }}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={h.onlineCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={h.statusDot} />
            <View>
              <Text style={h.onlineLabel}>{online ? "You're online" : "You're offline"}</Text>
              <Text style={h.onlineSub}>{online ? "Receiving requests near you" : "Not receiving requests"}</Text>
            </View>
          </View>
          <Switch value={online} onValueChange={toggleOnline} disabled={toggling} trackColor={{ true: "rgba(255,255,255,0.4)", false: "rgba(255,255,255,0.25)" }} thumbColor="#fff" />
        </LinearGradient>

        {pendingOffers.length > 0 && (
          <TouchableOpacity style={h.banner} onPress={() => navigation.navigate("IncomingRequests")}>
            <Text style={h.bannerT}>
              You have {pendingOffers.length} pending request{pendingOffers.length > 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} />
        ) : (
          <>
            <Text style={h.sect}>TODAY</Text>
            <View style={h.statGrid}>
              <Card style={h.statCard}>
                <Text style={h.statL}>Trips</Text>
                <Text style={h.statN}>{completedToday.length}</Text>
              </Card>
              <Card style={h.statCard}>
                <Text style={h.statL}>Earnings</Text>
                <Text style={[h.statN, { color: C.tealDeep }]}>RM {earningsToday.toFixed(0)}</Text>
              </Card>
            </View>

            <View style={h.fleetHeaderRow}>
              <Text style={h.sect}>YOUR FLEET</Text>
              <Text style={h.fleetSub}>{Math.max(0, availableCount)} of {fleet.ambulances.length} available</Text>
            </View>
            <Card noPad style={{ marginBottom: 20 }}>
              {fleet.ambulances.length === 0 && <Text style={[h.empty, { padding: spacing.cardPad }]}>No vehicles on file.</Text>}
              {fleet.ambulances.map((amb, i) => {
                const busy = activeAmbulanceIds.has(amb.id);
                return (
                  <View key={amb.id} style={[h.fleetRow, i === fleet.ambulances.length - 1 && { borderBottomWidth: 0 }, busy && { opacity: 0.5 }]}>
                    <View style={[h.fleetIconTile, { backgroundColor: busy ? C.line : C.tealSoft }]}>
                      <Ionicons name="medical" size={16} color={busy ? C.faint : C.tealDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={h.fleetPlate}>{amb.plate} · {amb.type}</Text>
                    </View>
                    <Text style={[h.fleetStatus, { color: busy ? C.faint : C.green }]}>{busy ? "On trip" : "Available"}</Text>
                  </View>
                );
              })}
            </Card>

            <Text style={h.sect}>ACTIVE TRIPS</Text>
            {activeTrips.length === 0 && <Text style={h.empty}>No active trips right now.</Text>}
            {activeTrips.map((b) => (
              <TouchableOpacity key={b.id} style={h.tripRow} onPress={() => navigation.push("ActiveTrip", { bookingId: b.id })}>
                <View style={{ flex: 1 }}>
                  <Text style={h.tripRoute}>{b.pickupName} → {b.destinationName}</Text>
                  <Text style={h.tripStatus}>{b.status}</Text>
                </View>
                <Text style={h.tripFare}>RM {b.subtotal.toFixed(2)}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={h.historyBtn} onPress={() => navigation.navigate("TripHistory")}>
              <Text style={h.historyBtnT}>Trip History</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const h = StyleSheet.create({
  signOut: { ...type.body, color: C.faint, fontSize: 12.5 },
  onlineCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: radius.card, padding: 18, marginBottom: spacing.cardGap, ...shadows.cardLift },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#7fffdc" },
  onlineLabel: { ...type.cardTitle, fontSize: 15, color: "#fff" },
  onlineSub: { ...type.body, fontSize: 11.5, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  banner: { backgroundColor: C.tealSoft, borderRadius: radius.card, padding: 13, alignItems: "center", marginBottom: spacing.cardGap },
  bannerT: { ...type.bodySemibold, color: C.tealDeep, fontSize: 13 },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 10 },
  statGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: { flex: 1, alignItems: "flex-start" },
  statL: { ...type.body, fontSize: 11.5, color: C.faint, marginBottom: 4 },
  statN: { ...type.statNumber, fontSize: 24, color: C.ink },
  fleetHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  fleetSub: { ...type.bodySemibold, fontSize: 12, color: C.faint },
  fleetRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.cardPad, borderBottomWidth: 1, borderBottomColor: C.line },
  fleetIconTile: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  fleetPlate: { ...type.bodySemibold, fontSize: 13, color: C.ink },
  fleetStatus: { ...type.bodySemibold, fontSize: 11.5 },
  empty: { ...type.body, fontSize: 12.5, color: C.faint, marginBottom: 16 },
  tripRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1.5, borderColor: C.line, borderRadius: radius.card, padding: 14, marginBottom: 10 },
  tripRoute: { ...type.bodySemibold, fontSize: 13, color: C.ink },
  tripStatus: { ...type.body, fontSize: 11, color: C.faint, marginTop: 2, textTransform: "uppercase" },
  tripFare: { ...type.cardTitle, fontSize: 13.5, color: C.teal },
  historyBtn: { borderWidth: 1.5, borderColor: C.line, borderRadius: radius.button, padding: 14, alignItems: "center", marginTop: 8 },
  historyBtnT: { ...type.buttonLabel, color: C.ink, fontSize: 14 },
});
