import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { BookingContext } from "../../App";
import { createBooking, getPaymentsStatus, getSavedCard, createCardSetup, ApiError } from "../api/client";
import { toApiLocation, toApiPatient } from "../api/mappers";
import Header from "./_Header";
import Card from "../components/ui/Card";
import GradientButton from "../components/ui/GradientButton";

// Pay-first (decided 2026-08-04): the booking is paid BEFORE any operator is
// contacted. Methods sent to the API: "cash" (emergencies only — pay the
// crew, dispatches immediately), "card" (linked card charged instantly),
// "online" (hosted payment page — card/FPX now, DuitNow/TNG with the
// upcoming Malaysian gateway). Cash disappears for transfers/scheduled.

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
  const [payments, setPayments] = React.useState({ enabled: false, card: null });
  const [linking, setLinking] = React.useState(false);
  const goHome = () => {
    resetDraft();
    navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
  };

  // Card availability — refetched on focus so returning from Stripe's hosted
  // link-card page picks the new card up without any manual refresh.
  React.useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const status = await getPaymentsStatus();
        const card = status.enabled ? (await getSavedCard()).card : null;
        if (!dead) setPayments({ enabled: status.enabled, card });
      } catch {}
    };
    load();
    const unsub = navigation.addListener("focus", load);
    return () => { dead = true; unsub(); };
  }, [navigation]);

  const cashAllowed = booking.bookingType !== "transfer" && !booking.scheduledAt;
  const method = booking.payMethod;

  // If the current selection became invalid (e.g. cash preselected but this
  // is a transfer, or card selected with no card linked), pick the best
  // available method automatically.
  React.useEffect(() => {
    if (!payments.enabled) {
      if (method !== "cash") update({ payMethod: "cash" });
      return;
    }
    const valid =
      (method === "cash" && cashAllowed) ||
      (method === "card" && payments.card) ||
      method === "online";
    if (!valid) {
      update({ payMethod: cashAllowed ? "cash" : payments.card ? "card" : "online" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, cashAllowed, method]);

  async function linkCard() {
    setLinking(true);
    try {
      const { url } = await createCardSetup();
      Linking.openURL(url);
    } catch (e) {
      setError(e.message || "Could not start card setup.");
    } finally {
      setLinking(false);
    }
  }

  const Row = ({ l, r }) => (
    <View style={rv.row}><Text style={rv.l}>{l}</Text><Text style={rv.r}>{r}</Text></View>
  );

  const MethodRow = ({ icon, label, selected, onPress }) => (
    <TouchableOpacity style={rv.methodRow} onPress={onPress}>
      <View style={[rv.methodIconTile, selected && { backgroundColor: C.tealSoft }]}>
        <Ionicons name={icon} size={17} color={selected ? C.tealDeep : C.faint} />
      </View>
      <Text style={rv.methodName}>{label}</Text>
      <View style={[rv.radio, selected && rv.radioOn]}>{selected && <View style={rv.dot} />}</View>
    </TouchableOpacity>
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
      // Hosted-payment path: open Stripe's page and let Waiting watch for
      // the payment to land (it polls + listens on the socket).
      if (res.checkoutUrl) {
        update({
          bookingId: res.id,
          bookingStatus: res.status,
          currentOfferExpiresAt: null,
          currentOfferOfferedAt: null,
        });
        Linking.openURL(res.checkoutUrl);
        navigation.replace("Waiting");
        return;
      }
      // Scheduled + already settled (paid instantly or cash-dev): nothing to
      // watch — the dispatch happens closer to pickup.
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
          {(cashAllowed || !payments.enabled) && (
            <MethodRow
              icon="cash-outline"
              label="Cash — pay the crew directly"
              selected={method === "cash"}
              onPress={() => update({ payMethod: "cash" })}
            />
          )}
          {payments.enabled && payments.card && (
            <MethodRow
              icon="card-outline"
              label={`${payments.card.brand.toUpperCase()} •••• ${payments.card.last4} — pay now`}
              selected={method === "card"}
              onPress={() => update({ payMethod: "card" })}
            />
          )}
          {payments.enabled && (
            <MethodRow
              icon="globe-outline"
              label="Pay online — card / FPX"
              selected={method === "online"}
              onPress={() => update({ payMethod: "online" })}
            />
          )}
          {payments.enabled && !payments.card && (
            <TouchableOpacity style={[rv.methodRow, { borderBottomWidth: 0 }]} onPress={linkCard} disabled={linking}>
              <View style={rv.methodIconTile}>
                <Ionicons name="add-circle-outline" size={17} color={C.tealDeep} />
              </View>
              <Text style={[rv.methodName, { color: C.tealDeep }]}>
                {linking ? "Opening card setup…" : "Link a card for one-tap payment"}
              </Text>
              <Ionicons name="open-outline" size={15} color={C.faint} />
            </TouchableOpacity>
          )}
        </Card>
        {payments.enabled && method !== "cash" && (
          <Text style={rv.payNote}>
            Payment is taken first — we only contact operators once it's confirmed. Full
            automatic refund if no operator can take your trip.
          </Text>
        )}

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
  payNote: { ...type.body, fontSize: 11.5, color: C.faint, lineHeight: 16, marginBottom: spacing.cardGap, marginHorizontal: 4 },
});
