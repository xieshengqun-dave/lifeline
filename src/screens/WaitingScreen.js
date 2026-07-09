import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { gradients, type, spacing, radius } from "../theme/tokens";
import { BookingContext } from "../../App";
import { getBooking, cancelBooking, skipBooking } from "../api/client";
import { normalizeOperator } from "../api/mappers";
import { subscribeToBooking } from "../api/socket";
import Header from "./_Header";
import EmergencyFallback from "./_EmergencyFallback";
import CountdownRing from "../components/ui/CountdownRing";

const NOTICE_COPY = {
  operator_declined: "That operator couldn't take it — searching for the next nearest ambulance…",
  timed_out: "That operator couldn't take it — searching for the next nearest ambulance…",
};

// Matches the backend's OFFER_TIMEOUT_SECONDS default — only used as a
// fallback denominator for the ring's progress arc if offeredAt is somehow
// unavailable (e.g. a resumed session that lost in-memory context state);
// the countdown *seconds* themselves always come from the real expiresAt.
const OFFER_WINDOW_FALLBACK = 60;

function fromBookingSnapshot(b) {
  if (!b.operator) return null;
  return normalizeOperator({
    id: b.operator.id,
    name: b.operator.name,
    fleetSummary: b.operator.fleetSummary,
    price: { subtotal: b.subtotal, serviceFee: b.serviceFee, total: b.total },
  });
}

export default function WaitingScreen({ navigation }) {
  const { booking, update, resetDraft } = React.useContext(BookingContext);
  const [initializing, setInitializing] = React.useState(true);
  const [status, setStatus] = React.useState(booking.bookingStatus);
  const [operator, setOperator] = React.useState(booking.selectedOperator);
  const [expiresAt, setExpiresAt] = React.useState(booking.currentOfferExpiresAt ? new Date(booking.currentOfferExpiresAt).getTime() : null);
  const [offeredAt, setOfferedAt] = React.useState(booking.currentOfferOfferedAt ? new Date(booking.currentOfferOfferedAt).getTime() : null);
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);
  const [transientNotice, setTransientNotice] = React.useState(null);
  const [actionInFlight, setActionInFlight] = React.useState(false);

  const bookingId = booking.bookingId;
  const noticeTimerRef = React.useRef(null);

  // Initial authoritative fetch — the very first offer_operator socket event
  // is definitionally missed (join_booking only happens after we already
  // have a bookingId, i.e. after POST /bookings's own emit already fired),
  // and the booking may already be accepted/expired by mount time (this
  // project's demo flow simulates accept/decline via manual API calls). The
  // current offer's expiresAt/offeredAt already arrived via context (set on
  // Review's confirmAndBook) — this fetch is just for authoritative status.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await getBooking(bookingId);
        if (cancelled) return;
        const op = fromBookingSnapshot(b);
        if (op) update({ selectedOperator: op });
        setOperator(op);
        setStatus(b.status);
        if (b.status === "accepted") {
          navigation.replace("Payment");
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  React.useEffect(() => {
    if (initializing) return;
    const unsubscribe = subscribeToBooking(bookingId, {
      onOffer: (payload) => {
        const op = normalizeOperator(payload.operator);
        update({ selectedOperator: op });
        setOperator(op);
        setExpiresAt(new Date(payload.expiresAt).getTime());
        setOfferedAt(payload.offeredAt ? new Date(payload.offeredAt).getTime() : Date.now());
        setTransientNotice(null);
      },
      onStatusChanged: (payload) => {
        setStatus(payload.status);
        if (payload.status === "accepted") {
          navigation.replace("Payment");
        } else if (payload.status === "declined") {
          const notice = NOTICE_COPY[payload.reason];
          setTransientNotice(notice || null);
          clearTimeout(noticeTimerRef.current);
          if (notice) noticeTimerRef.current = setTimeout(() => setTransientNotice(null), 3000);
        }
      },
    });
    return () => {
      unsubscribe();
      clearTimeout(noticeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing, bookingId]);

  // Recomputed from the fixed expiresAt each tick (not a decrementing
  // counter) — self-correcting if the app is backgrounded, where RN timers
  // throttle.
  React.useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const totalWindowSeconds = offeredAt && expiresAt ? Math.max(1, (expiresAt - offeredAt) / 1000) : OFFER_WINDOW_FALLBACK;
  const progress = remainingSeconds / totalWindowSeconds;

  function confirmCancel() {
    Alert.alert("Cancel request?", "Are you sure you want to cancel this ambulance request?", [
      { text: "No" },
      { text: "Yes, cancel", style: "destructive", onPress: doCancel },
    ]);
  }

  async function doCancel() {
    setActionInFlight(true);
    try {
      await cancelBooking(bookingId);
      resetDraft();
      navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
    } catch (e) {
      Alert.alert("Couldn't cancel", e.message || "Please check the current status.");
    } finally {
      setActionInFlight(false);
    }
  }

  async function doSkip() {
    setActionInFlight(true);
    try {
      await skipBooking(bookingId);
      // The updated operator/status arrive via the socket events above.
    } catch (e) {
      Alert.alert("Couldn't skip", e.message || "Please check the current status.");
    } finally {
      setActionInFlight(false);
    }
  }

  function goHome() {
    resetDraft();
    navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
  }

  // Android hardware back — same confirm-cancel as the header back button,
  // swallowed (returns true) so it never lands on a stale Review screen.
  React.useEffect(() => {
    const onBack = () => {
      if (status === "expired") return false;
      confirmCancel();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (initializing) {
    return (
      <SafeAreaView style={w.center}>
        <ActivityIndicator color={C.teal} size="large" />
      </SafeAreaView>
    );
  }

  if (status === "expired") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={["top"]}>
        <Header title="Ambulance Request" onBack={goHome} />
        <EmergencyFallback secondaryLabel="Return to Home" onSecondary={goHome} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={gradients.darkHeroWaiting} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={w.body}>
          <Text style={w.overline}>REQUESTING YOUR UNIT</Text>
          <Text style={w.title}>Waiting for the operator to confirm…</Text>

          <CountdownRing seconds={remainingSeconds} progress={progress} />

          {transientNotice && (
            <View style={w.notice}>
              <Text style={w.noticeT}>{transientNotice}</Text>
            </View>
          )}

          {operator && (
            <View style={w.card}>
              <Text style={w.opName}>{operator.name}</Text>
              {operator.fleetSummary && <Text style={w.opFleet}>{operator.fleetSummary}</Text>}
              <View style={w.opMeta}>
                {operator.etaMinutes != null && (
                  <View>
                    <Text style={w.opEta}>{operator.etaMinutes} mins</Text>
                    <Text style={w.opK}>ETA</Text>
                  </View>
                )}
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={w.opFare}>RM {operator.price.total.toFixed(2)}</Text>
                  <Text style={w.opK}>Total</Text>
                </View>
              </View>
              <View style={w.reviewingRow}>
                <ActivityIndicator size="small" color={C.teal} />
                <Text style={w.reviewingT}>Operator is reviewing your request…</Text>
              </View>
            </View>
          )}

          <View style={w.actions}>
            <TouchableOpacity style={w.skipBtn} onPress={doSkip} disabled={actionInFlight}>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
              <Text style={w.skipBtnT}>Skip to next operator</Text>
            </TouchableOpacity>
            <TouchableOpacity style={w.cancelBtn} onPress={confirmCancel} disabled={actionInFlight}>
              <Text style={w.cancelBtnT}>Cancel request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const w = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, padding: spacing.screenPad, alignItems: "center" },
  overline: { ...type.caption, fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 20 },
  title: { ...type.screenTitle, fontSize: 22, color: "#fff", textAlign: "center", marginTop: 8, marginBottom: 24 },
  notice: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.card, padding: 12, marginTop: 20, width: "100%" },
  noticeT: { ...type.body, color: "#fff", fontSize: 12.5, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: radius.card, padding: spacing.cardPad, width: "100%", marginTop: 24 },
  opName: { ...type.cardTitle, fontSize: 16, color: C.ink },
  opFleet: { ...type.body, fontSize: 11.5, color: C.faint, marginTop: 2 },
  opMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  opEta: { ...type.cardTitle, fontSize: 14, color: C.teal },
  opFare: { ...type.cardTitle, fontSize: 14, color: C.ink },
  opK: { ...type.body, fontSize: 10, color: C.faint, marginTop: 2 },
  reviewingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  reviewingT: { ...type.body, fontSize: 12, color: C.faint },
  actions: { width: "100%", marginTop: "auto", gap: 10 },
  skipBtn: {
    flexDirection: "row", gap: 8, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", borderRadius: radius.button, padding: 15, alignItems: "center",
  },
  skipBtnT: { ...type.buttonLabel, fontSize: 14.5, color: "#fff" },
  cancelBtn: {
    backgroundColor: "rgba(229,72,77,0.18)", borderWidth: 1.5, borderColor: "rgba(229,72,77,0.5)",
    borderRadius: radius.button, padding: 15, alignItems: "center",
  },
  cancelBtnT: { ...type.buttonLabel, fontSize: 14.5, color: "#ff9ea1" },
});
