import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { getOperatorBooking, getOperatorFleet, assignBookingResources, advanceBookingStatus } from "../api/client";
import { subscribeToBooking } from "../api/socket";
import Header from "./_Header";
import StatusPill from "../components/ui/StatusPill";
import GradientButton from "../components/ui/GradientButton";

// Mirrors the backend's BOOKING_STATUS_PROGRESSION (lib/constants.js) — a
// target is allowed if it's strictly later than the current status, so a
// forgotten "En Route" tap doesn't block "Arrived".
const PROGRESSION = ["accepted", "enroute", "arrived", "onboard", "completed"];
const STEP_LABELS = { accepted: "Accepted", enroute: "En route", arrived: "Arrived", onboard: "Onboard", completed: "Done" };
const NEXT_ACTION_LABEL = { accepted: "Mark en route", enroute: "Mark arrived", arrived: "Patient onboard", onboard: "Complete trip" };

export default function ActiveTripScreen({ route, navigation }) {
  const { bookingId } = route.params;
  const [loading, setLoading] = React.useState(true);
  const [booking, setBooking] = React.useState(null);
  const [fleet, setFleet] = React.useState({ ambulances: [], crew: [] });
  const [editingAssignment, setEditingAssignment] = React.useState(false);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = React.useState(null);
  const [selectedCrewId, setSelectedCrewId] = React.useState(null);
  const [assigning, setAssigning] = React.useState(false);
  const [advancing, setAdvancing] = React.useState(false);

  const loadBooking = React.useCallback(async () => {
    const b = await getOperatorBooking(bookingId);
    setBooking(b);
    setSelectedAmbulanceId(b.ambulanceId);
    setSelectedCrewId(b.crewId);
    setEditingAssignment(!b.ambulanceId || !b.crewId);
    return b;
  }, [bookingId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [, fleetRes] = await Promise.all([loadBooking(), getOperatorFleet()]);
      if (cancelled) return;
      setFleet(fleetRes);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadBooking]);

  React.useEffect(() => {
    const unsubscribe = subscribeToBooking(bookingId, {
      onStatusChanged: (payload) => setBooking((b) => (b ? { ...b, status: payload.status } : b)),
    });
    return unsubscribe;
  }, [bookingId]);

  async function confirmAssignment() {
    setAssigning(true);
    try {
      await assignBookingResources(bookingId, { ambulanceId: selectedAmbulanceId, crewId: selectedCrewId });
      await loadBooking();
    } catch (e) {
      Alert.alert("Couldn't assign", e.message || "Please try again.");
    } finally {
      setAssigning(false);
    }
  }

  async function advanceNext() {
    const currentIndex = PROGRESSION.indexOf(booking.status);
    const nextStatus = PROGRESSION[currentIndex + 1];
    if (!nextStatus) return;
    setAdvancing(true);
    try {
      const updated = await advanceBookingStatus(bookingId, nextStatus);
      setBooking(updated);
      if (nextStatus === "completed") {
        navigation.popToTop();
      }
    } catch (e) {
      Alert.alert("Couldn't update status", e.message || "Please try again.");
      await loadBooking(); // resync — a 409 usually means another device already moved this forward
    } finally {
      setAdvancing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={t.center}>
        <ActivityIndicator color={C.teal} size="large" />
      </SafeAreaView>
    );
  }

  const currentIndex = PROGRESSION.indexOf(booking.status);
  const nextStatus = PROGRESSION[currentIndex + 1];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <Header
        title="Active Trip"
        onBack={() => navigation.goBack()}
        right={<StatusPill label={booking.status} variant="active" />}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPad, paddingBottom: 100 }}>
        <View style={t.card}>
          <Text style={t.sect}>TRIP</Text>
          <Text style={t.tv}>{booking.pickupName} → {booking.destinationName}</Text>
          <Text style={t.sub}>RM {booking.subtotal.toFixed(2)} · {booking.distanceKm.toFixed(1)} km</Text>
        </View>

        <Text style={t.sectOutside}>AMBULANCE & CREW</Text>
        {!editingAssignment ? (
          <View style={t.assignedCard}>
            <Text style={t.tv}>{booking.ambulance?.plate} · {booking.ambulance?.type}</Text>
            <Text style={t.sub}>{booking.crew?.name} · {booking.crew?.role}</Text>
            <TouchableOpacity onPress={() => setEditingAssignment(true)}>
              <Text style={t.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={t.card}>
            <Text style={t.subSect}>Ambulance</Text>
            {fleet.ambulances.map((a) => (
              <TouchableOpacity key={a.id} style={t.pickRow} onPress={() => setSelectedAmbulanceId(a.id)}>
                <Text style={t.pickT}>{a.plate} · {a.type}</Text>
                <View style={[t.radio, selectedAmbulanceId === a.id && t.radioOn]}>
                  {selectedAmbulanceId === a.id && <View style={t.dot} />}
                </View>
              </TouchableOpacity>
            ))}
            <Text style={t.subSect}>Crew</Text>
            {fleet.crew.map((c) => (
              <TouchableOpacity key={c.id} style={t.pickRow} onPress={() => setSelectedCrewId(c.id)}>
                <Text style={t.pickT}>{c.name} · {c.role}</Text>
                <View style={[t.radio, selectedCrewId === c.id && t.radioOn]}>
                  {selectedCrewId === c.id && <View style={t.dot} />}
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[t.confirmBtn, (!selectedAmbulanceId || !selectedCrewId || assigning) && t.btnOff]}
              onPress={confirmAssignment}
              disabled={!selectedAmbulanceId || !selectedCrewId || assigning}
            >
              {assigning ? <ActivityIndicator color="#fff" /> : <Text style={t.confirmBtnT}>Confirm Assignment</Text>}
            </TouchableOpacity>
          </View>
        )}

        <Text style={t.sectOutside}>TRIP STATUS</Text>
        <View style={t.stepper}>
          {PROGRESSION.map((s, i) => (
            <View key={s} style={t.stepItem}>
              <View style={[t.stepDot, i <= currentIndex && t.stepDotDone]} />
              <Text style={[t.stepLabel, i <= currentIndex && t.stepLabelDone]}>{STEP_LABELS[s]}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={t.footer}>
        {booking.crew?.phone && (
          <TouchableOpacity style={t.callBtn} onPress={() => Linking.openURL(`tel:${booking.crew.phone}`)}>
            <Ionicons name="call" size={20} color={C.teal} />
          </TouchableOpacity>
        )}
        {nextStatus && (
          <GradientButton
            label={NEXT_ACTION_LABEL[booking.status]}
            onPress={advanceNext}
            loading={advancing}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const t = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#fff", borderRadius: radius.card, padding: spacing.cardPad, marginBottom: spacing.cardGap, borderWidth: 1, borderColor: C.line },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8 },
  sectOutside: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8, marginLeft: 4 },
  subSect: { ...type.caption, fontSize: 10.5, color: C.faint, marginTop: 10, marginBottom: 4 },
  tv: { ...type.cardTitle, fontSize: 13.5, color: C.ink },
  sub: { ...type.body, fontSize: 11.5, color: C.faint, marginTop: 2 },
  assignedCard: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: C.teal, borderRadius: radius.card, padding: spacing.cardPad, marginBottom: spacing.cardGap },
  changeLink: { ...type.bodySemibold, color: C.teal, fontSize: 12.5, marginTop: 8 },
  pickRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  pickT: { ...type.bodySemibold, fontSize: 13, color: C.ink },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: C.teal },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.teal },
  confirmBtn: { backgroundColor: C.teal, borderRadius: radius.button, padding: 14, alignItems: "center", marginTop: 14 },
  confirmBtnT: { ...type.buttonLabel, fontSize: 14, color: "#fff" },
  btnOff: { opacity: 0.35 },
  stepper: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: radius.card, padding: spacing.cardPad, borderWidth: 1, borderColor: C.line },
  stepItem: { alignItems: "center", flex: 1 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.line, marginBottom: 6 },
  stepDotDone: { backgroundColor: C.teal },
  stepLabel: { ...type.body, fontSize: 10, color: C.faint, textAlign: "center" },
  stepLabelDone: { color: C.ink, fontWeight: "700" },
  footer: { flexDirection: "row", gap: 12, padding: spacing.screenPad, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: "#fff" },
  callBtn: { width: 56, height: 58, borderRadius: radius.input, backgroundColor: C.tealSoft, alignItems: "center", justifyContent: "center" },
});
