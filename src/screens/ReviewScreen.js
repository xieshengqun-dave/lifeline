import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { BookingContext } from "../../App";
import { createBooking, ApiError } from "../api/client";
import { toApiLocation, toApiPatient } from "../api/mappers";
import Header from "./_Header";
import Card from "../components/ui/Card";
import GradientButton from "../components/ui/GradientButton";

// Grab agent model (decided 2026-07-31): the patient pays the OPERATOR
// directly — the platform is not in the money flow for cash trips. Card
// payment arrives with the Stripe integration; until then it's listed
// honestly as coming soon, not as a working option.
const METHOD_ICONS = {
  "Cash — pay the crew directly": "cash-outline",
  "Card (coming soon)": "card-outline",
};
const METHODS = Object.keys(METHOD_ICONS);
const isMethodEnabled = (m) => !m.includes("coming soon");

// Payment method is chosen here, before the booking is created — a real
// backend constraint (POST /bookings requires paymentMethod in the same
// call) and a deliberate Phase-2 decision, not something this redesign
// changes. CTA stays "Confirm & Book" (accurate — dispatch hasn't happened
// yet; the operator still has to accept).
export default function ReviewScreen({ navigation }) {
  const { booking, update, resetDraft } = React.useContext(BookingContext);
  const op = booking.selectedOperator;
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(null);
  const goHome = () => {
    resetDraft();
    navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
  };

  const Row = ({ l, r }) => (
    <View style={rv.row}><Text style={rv.l}>{l}</Text><Text style={rv.r}>{r}</Text></View>
  );

  async function confirmAndBook() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await createBooking({
        operatorId: op.operatorId,
        pickup: toApiLocation(booking.from),
        destination: toApiLocation(booking.to),
        patient: toApiPatient(booking),
        paymentMethod: booking.payMethod,
        bookingType: booking.bookingType || "emergency",
        scheduledAt: booking.scheduledAt || undefined,
      });
      // Scheduled bookings have no live offer race to watch — confirm and
      // send the user home; the trip lives in the Trips tab until dispatch.
      if (res.scheduledAt && !res.currentOffer) {
        const when = new Date(res.scheduledAt);
        Alert.alert(
          "Transport scheduled",
          `Pickup ${when.toLocaleDateString()} at ${when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.\n\nWe'll start finding your operator about 45 minutes before pickup. Track or cancel it from the Trips tab.`,
          [{ text: "OK", onPress: goHome }]
        );
        return;
      }
      update({
        bookingId: res.id,
        bookingStatus: res.status,
        currentOfferExpiresAt: res.currentOffer?.expiresAt ?? null,
        currentOfferOfferedAt: res.currentOffer?.offeredAt ?? null,
      });
      navigation.replace("Waiting");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create the booking. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <Header title="Confirm & Pay" onBack={() => navigation.goBack()} onHome={goHome} />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPad }}>
        <Card style={{ marginBottom: spacing.cardGap }}>
          <Text style={rv.sect}>TRIP DETAILS</Text>
          <Text style={rv.tv}>{booking.from?.name || "Pickup"}</Text>
          <Text style={rv.tv}>→ {booking.to?.name || "Destination"}</Text>
          {booking.bookingType === "transfer" && (
            <Text style={rv.body}>Non-emergency patient transfer</Text>
          )}
          {booking.scheduledAt && (
            <Text style={[rv.body, { color: C.tealDeep }]}>
              Scheduled pickup: {new Date(booking.scheduledAt).toLocaleDateString()}{" "}
              {new Date(booking.scheduledAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </Text>
          )}

          <Text style={[rv.sect, { marginTop: 14 }]}>AMBULANCE</Text>
          <Text style={rv.tv}>{op?.name} · {op?.fleetSummary}</Text>

          <Text style={[rv.sect, { marginTop: 14 }]}>PATIENT SUMMARY</Text>
          <Text style={rv.body}>
            {booking.gender}, {booking.age} years{"\n"}
            {booking.cond} · Oxygen: {booking.oxy === "Yes" ? booking.flow : "No"} · IV: {booking.iv}
            {booking.iv === "Yes" && booking.medication ? ` (${booking.medication})` : ""}
            {"\n"}Diagnosis: {booking.diagnosisType === "RTA" ? "RTA" : (booking.diagnosisOther || "—")}
            {booking.specialRequest ? `\nSpecial request: ${booking.specialRequest}` : ""}
          </Text>
        </Card>

        <Text style={rv.sectOutside}>PAYMENT METHOD</Text>
        <Card noPad style={{ marginBottom: spacing.cardGap }}>
          {METHODS.map((m, i) => (
            <TouchableOpacity
              key={m}
              style={[rv.methodRow, i === METHODS.length - 1 && { borderBottomWidth: 0 }, !isMethodEnabled(m) && { opacity: 0.45 }]}
              disabled={!isMethodEnabled(m)}
              onPress={() => update({ payMethod: m })}
            >
              <View style={[rv.methodIconTile, booking.payMethod === m && { backgroundColor: C.tealSoft }]}>
                <Ionicons name={METHOD_ICONS[m]} size={17} color={booking.payMethod === m ? C.tealDeep : C.faint} />
              </View>
              <Text style={rv.methodName}>{m}</Text>
              <View style={[rv.radio, booking.payMethod === m && rv.radioOn]}>
                {booking.payMethod === m && <View style={rv.dot} />}
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        <Card style={{ marginBottom: spacing.cardGap }}>
          <Text style={rv.sect}>FARE ESTIMATE</Text>
          <Row l="Subtotal" r={`RM ${op?.price.subtotal.toFixed(2)}`} />
          <Row l="Service Fee" r={`RM ${op?.price.serviceFee.toFixed(2)}`} />
          <View style={rv.totalRow}>
            <Text style={rv.totalK}>Total</Text>
            <Text style={rv.totalV}>RM {op?.price.total.toFixed(2)}</Text>
          </View>
        </Card>

        {error && <Text style={rv.errorT}>{error}</Text>}

        <GradientButton label="Confirm & Book" onPress={confirmAndBook} loading={submitting} icon="lock-closed" style={{ marginTop: 4 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
const rv = StyleSheet.create({
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8 },
  sectOutside: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8, marginLeft: 4 },
  tv: { ...type.bodySemibold, fontSize: 13, color: C.ink, marginBottom: 2 },
  body: { ...type.body, fontSize: 12.5, color: C.body },
  methodRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: spacing.cardPad, borderBottomWidth: 1, borderBottomColor: C.line },
  methodIconTile: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  methodName: { flex: 1, ...type.bodySemibold, fontSize: 13, color: C.ink },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: C.teal },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.teal },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  l: { ...type.body, fontSize: 12.5, color: C.faint }, r: { ...type.bodySemibold, fontSize: 12.5, color: C.ink },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.line, marginTop: 8, paddingTop: 10 },
  totalK: { ...type.cardTitle, fontSize: 14, color: C.ink }, totalV: { ...type.price, fontSize: 18, color: C.tealDeep },
  errorT: { fontSize: 12.5, color: C.red, marginTop: 4, marginBottom: 10, textAlign: "center" },
});
