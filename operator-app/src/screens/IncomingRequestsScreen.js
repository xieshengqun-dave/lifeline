import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { gradients, type, spacing, radius } from "../theme/tokens";
import { OperatorContext } from "../../App";
import { acceptOffer, declineOffer, ApiError } from "../api/client";
import Header from "./_Header";

// Matches the backend's OFFER_TIMEOUT_SECONDS default — fallback denominator
// only, if offeredAt is somehow missing from an offer payload.
const OFFER_WINDOW_FALLBACK = 60;

export default function IncomingRequestsScreen({ navigation }) {
  const { pendingOffers, removeOffer } = React.useContext(OperatorContext);
  const [tick, setTick] = React.useState(Date.now());
  const [busyIds, setBusyIds] = React.useState(new Set());
  const expiryTimersRef = React.useRef({});

  React.useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Grey out + hold an expired card ~3s (mirrors the patient app's transient-
  // notice pattern) before dropping it — both this client and the server
  // time against the same persisted expiresAt, so no server push is needed.
  React.useEffect(() => {
    pendingOffers.forEach((offer) => {
      const remaining = new Date(offer.expiresAt).getTime() - tick;
      if (remaining <= 0 && !expiryTimersRef.current[offer.offerId]) {
        expiryTimersRef.current[offer.offerId] = setTimeout(() => {
          removeOffer(offer.offerId);
          delete expiryTimersRef.current[offer.offerId];
        }, 3000);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, pendingOffers]);

  function setBusy(offerId, busy) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(offerId);
      else next.delete(offerId);
      return next;
    });
  }

  async function doAccept(offer) {
    setBusy(offer.offerId, true);
    try {
      const res = await acceptOffer(offer.offerId);
      removeOffer(offer.offerId);
      navigation.push("ActiveTrip", { bookingId: res.bookingId });
    } catch (e) {
      if (e instanceof ApiError && e.code === "offer_not_pending") {
        Alert.alert("No longer available", "This request was already resolved.");
        removeOffer(offer.offerId);
      } else {
        Alert.alert("Couldn't accept", e.message || "Please try again.");
      }
    } finally {
      setBusy(offer.offerId, false);
    }
  }

  async function doDecline(offer) {
    setBusy(offer.offerId, true);
    try {
      await declineOffer(offer.offerId);
      removeOffer(offer.offerId);
    } catch (e) {
      if (e instanceof ApiError && e.code === "offer_not_pending") {
        removeOffer(offer.offerId);
      } else {
        Alert.alert("Couldn't decline", e.message || "Please try again.");
      }
    } finally {
      setBusy(offer.offerId, false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={gradients.darkHeroIncoming} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <Header title="Incoming Requests" onBack={() => navigation.navigate("Home")} />

        {pendingOffers.length === 0 ? (
          <View style={r.empty}>
            <Text style={r.emptyT}>No pending requests</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.screenPad }}>
            {pendingOffers.map((offer) => {
              const totalWindow = offer.offeredAt
                ? Math.max(1, (new Date(offer.expiresAt).getTime() - new Date(offer.offeredAt).getTime()) / 1000)
                : OFFER_WINDOW_FALLBACK;
              const remaining = Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - tick) / 1000));
              const expired = remaining <= 0;
              const busy = busyIds.has(offer.offerId);
              const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
              const ss = String(remaining % 60).padStart(2, "0");
              const progressPct = Math.max(0, Math.min(1, remaining / totalWindow)) * 100;

              return (
                <View key={offer.offerId} style={[r.card, expired && r.cardExpired]}>
                  <View style={r.topRow}>
                    <View style={r.newPill}>
                      <View style={r.newDot} />
                      <Text style={r.newPillT}>NEW REQUEST</Text>
                    </View>
                    <Text style={r.countdown}>{expired ? "Expired" : `0:${ss}`}</Text>
                  </View>
                  <View style={r.progressTrack}>
                    <View style={[r.progressFill, { width: `${progressPct}%` }]} />
                  </View>

                  <View style={r.conditionCard}>
                    <Text style={r.route}>{offer.pickup.name} → {offer.destination.name}</Text>
                    <Text style={r.distance}>{offer.dispatchDistanceKm.toFixed(1)} km away</Text>
                    <View style={r.patientRow}>
                      <Text style={r.patientT}>
                        Age {offer.patientSummary.age ?? "—"} · {offer.patientSummary.consciousLevel ?? "—"}
                        {offer.patientSummary.oxygen ? " · On oxygen" : ""}
                      </Text>
                    </View>
                  </View>

                  <View style={r.payoutCard}>
                    <View style={r.payoutIconTile}>
                      <Ionicons name="cash-outline" size={18} color="#7fffdc" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={r.payoutN}>RM {offer.price.subtotal.toFixed(2)}</Text>
                      <Text style={r.payoutSub}>You earn this in full — platform fee (RM {offer.price.serviceFee.toFixed(2)}) is added on top for the patient.</Text>
                    </View>
                  </View>

                  <View style={r.actions}>
                    <TouchableOpacity
                      style={[r.acceptBtn, (busy || expired) && r.btnOff]}
                      onPress={() => doAccept(offer)}
                      disabled={busy || expired}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={r.acceptBtnT}>Accept request</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[r.declineBtn, (busy || expired) && r.btnOff]}
                      onPress={() => doDecline(offer)}
                      disabled={busy || expired}
                    >
                      <Text style={r.declineBtnT}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const r = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyT: { ...type.body, fontSize: 13.5, color: "rgba(255,255,255,0.6)" },
  card: { marginBottom: 16 },
  cardExpired: { opacity: 0.4 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  newPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(127,255,220,0.14)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  newDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#7fffdc" },
  newPillT: { ...type.caption, fontSize: 10, color: "#7fffdc" },
  countdown: { ...type.statNumber, fontSize: 22, color: "#fff" },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.14)", marginBottom: 16, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#2ba7a0", borderRadius: 3 },
  conditionCard: { backgroundColor: "#fff", borderRadius: radius.card, padding: spacing.cardPad, marginBottom: 12 },
  route: { ...type.cardTitle, fontSize: 14, color: C.ink, marginBottom: 2 },
  distance: { ...type.body, fontSize: 11.5, color: C.faint, marginBottom: 10 },
  patientRow: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 },
  patientT: { ...type.body, fontSize: 12.5, color: C.body },
  payoutCard: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.card, padding: spacing.cardPad, marginBottom: 16 },
  payoutIconTile: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(127,255,220,0.14)", alignItems: "center", justifyContent: "center" },
  payoutN: { ...type.bigNumeral, fontSize: 26, color: "#fff" },
  payoutSub: { ...type.body, fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 3, lineHeight: 15 },
  actions: { gap: 10 },
  acceptBtn: { flexDirection: "row", gap: 8, backgroundColor: C.teal, borderRadius: radius.button, padding: 16, alignItems: "center", justifyContent: "center" },
  acceptBtnT: { ...type.buttonLabel, fontSize: 15.5, color: "#fff" },
  declineBtn: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", borderRadius: radius.button, padding: 14, alignItems: "center" },
  declineBtnT: { ...type.buttonLabel, fontSize: 14, color: "#fff" },
  btnOff: { opacity: 0.4 },
});
