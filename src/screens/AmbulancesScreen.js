import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius, shadows } from "../theme/tokens";
import { BookingContext } from "../../App";
import { getBookingQuote, ApiError } from "../api/client";
import { toApiLocation, toApiPatient, normalizeOperator } from "../api/mappers";
import Header from "./_Header";
import EmergencyFallback from "./_EmergencyFallback";

const SORTS = [
  { key: "eta", label: "Fastest ETA", cmp: (a, b) => a.etaMinutes - b.etaMinutes },
  { key: "price", label: "Lowest price", cmp: (a, b) => a.price.total - b.price.total },
  { key: "distance", label: "Nearest", cmp: (a, b) => a.dispatchDistanceKm - b.dispatchDistanceKm },
];

function initials(name) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function AmbulancesScreen({ navigation }) {
  const { booking, update, resetDraft } = React.useContext(BookingContext);
  const goHome = () => {
    resetDraft();
    navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
  };
  const [state, setState] = React.useState({ loading: true, error: null, operators: [] });
  const [sortKey, setSortKey] = React.useState("eta");

  const fetchQuote = React.useCallback(async () => {
    setState({ loading: true, error: null, operators: [] });
    try {
      const res = await getBookingQuote({
        pickup: toApiLocation(booking.from),
        destination: toApiLocation(booking.to),
        patient: toApiPatient(booking),
      });
      update({ distanceKm: res.distanceKm });
      setState({ loading: false, error: null, operators: res.operators });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Could not reach the server. Check your connection.";
      setState({ loading: false, error: message, operators: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  const sorted = React.useMemo(() => {
    const cmp = SORTS.find((s) => s.key === sortKey)?.cmp;
    return cmp ? [...state.operators].sort(cmp) : state.operators;
  }, [state.operators, sortKey]);

  function selectOperator(op) {
    update({ selectedOperator: normalizeOperator(op) });
    navigation.navigate("Review");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <Header title="Available Ambulances" onBack={() => navigation.goBack()} onHome={goHome} />

      {state.loading && (
        <View style={a.center}>
          <ActivityIndicator color={C.teal} size="large" />
          <Text style={a.loadingT}>Finding nearby ambulances…</Text>
        </View>
      )}

      {!state.loading && state.error && (
        <View style={a.center}>
          <Text style={a.errorT}>{state.error}</Text>
          <TouchableOpacity style={a.retryBtn} onPress={fetchQuote}>
            <Text style={a.retryBtnT}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!state.loading && !state.error && state.operators.length === 0 && (
        <EmergencyFallback secondaryLabel="Try again" onSecondary={fetchQuote} />
      )}

      {!state.loading && !state.error && state.operators.length > 0 && (
        <>
          <View style={a.subHeader}>
            <Text style={a.count}>{state.operators.length} units near you</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {SORTS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[a.sortChip, sortKey === s.key && a.sortChipOn]}
                  onPress={() => setSortKey(s.key)}
                >
                  <Text style={[a.sortChipT, sortKey === s.key && a.sortChipTOn]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.screenPad }}>
            {sorted.map((op, i) => {
              const isBest = i === 0;
              const ratingLabel = op.ratingAvg != null ? `★ ${op.ratingAvg.toFixed(1)}` : "New";
              return (
                <View key={op.operatorId} style={[a.card, isBest ? a.cardBest : a.cardStandard]}>
                  {isBest && (
                    <LinearGradient colors={[C.teal, C.tealDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={a.ribbon}>
                      <Ionicons name="star" size={11} color="#fff" />
                      <Text style={a.ribbonT}>BEST MATCH</Text>
                    </LinearGradient>
                  )}
                  <View style={a.head}>
                    <LinearGradient
                      colors={isBest ? [C.teal, C.tealDeep] : [C.tealSoft, C.tealSoft]}
                      style={[a.avatar, isBest ? null : { borderWidth: 1, borderColor: C.tealLine }]}
                    >
                      <Text style={[a.avatarT, !isBest && { color: C.tealDeep }]}>{initials(op.name)}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={a.nm}>{op.name}</Text>
                      <Text style={a.tp}>
                        {ratingLabel}
                        {op.tripCount ? ` · ${op.tripCount} trips` : ""}
                        {op.fleetSummary ? ` · ${op.fleetSummary}` : ""}
                      </Text>
                    </View>
                  </View>
                  <View style={a.meta}>
                    <Metric k="ETA" v={`${op.etaMinutes} min`} />
                    <Metric k="Distance" v={`${op.dispatchDistanceKm} km`} />
                    <Metric k="Price" v={`RM${op.price.total.toFixed(0)}`} price />
                  </View>
                  {isBest ? (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => selectOperator(op)}>
                      <LinearGradient colors={[C.teal, C.tealDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={a.selGrad}>
                        <Text style={a.selGradT}>Request this unit</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={a.selOutline} onPress={() => selectOperator(op)}>
                      <Text style={a.selOutlineT}>Request</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <View style={a.infoStrip}>
              <Ionicons name="information-circle-outline" size={16} color={C.faint} />
              <Text style={a.infoT}>
                Prices set by each operator. In a life-threatening emergency, <Text style={{ color: C.red, fontWeight: "700" }}>call 999</Text> directly.
              </Text>
            </View>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const Metric = ({ k, v, price }) => (
  <View>
    <Text style={[a.metricV, price && { color: C.tealDeep }]}>{v}</Text>
    <Text style={a.metricK}>{k}</Text>
  </View>
);

const a = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingT: { ...type.body, fontSize: 12.5, color: C.faint, marginTop: 10 },
  errorT: { fontSize: 13, color: C.red, textAlign: "center", marginBottom: 14 },
  retryBtn: { backgroundColor: C.teal, borderRadius: radius.button, paddingVertical: 12, paddingHorizontal: 28 },
  retryBtnT: { ...type.buttonLabel, fontSize: 13.5, color: "#fff" },
  subHeader: { backgroundColor: "#fff", paddingHorizontal: spacing.screenPad, paddingVertical: 12, ...shadows.neutralCard, shadowOpacity: 0.06 },
  count: { ...type.screenTitle, fontSize: 17, color: C.ink, marginBottom: 10 },
  sortChip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, backgroundColor: C.bg },
  sortChipOn: { backgroundColor: C.navy },
  sortChipT: { ...type.bodySemibold, fontSize: 12.5, color: C.body },
  sortChipTOn: { color: "#fff" },
  card: { borderRadius: radius.card, padding: spacing.cardPad, marginBottom: spacing.cardGap, backgroundColor: "#fff" },
  cardBest: { borderWidth: 2, borderColor: C.teal, ...shadows.cardLift, paddingTop: 8 },
  cardStandard: { borderWidth: 1.5, borderColor: C.line, ...shadows.neutralCard },
  ribbon: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  ribbonT: { ...type.caption, fontSize: 10, color: "#fff" },
  head: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  avatarT: { ...type.cardTitle, fontSize: 15, color: "#fff" },
  nm: { ...type.cardTitle, color: C.ink },
  tp: { ...type.body, fontSize: 11.5, color: C.faint, marginTop: 2 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginVertical: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  metricV: { ...type.cardTitle, fontSize: 15, color: C.ink },
  metricK: { ...type.body, fontSize: 10, color: C.faint, marginTop: 2 },
  selGrad: { borderRadius: radius.input, padding: 13, alignItems: "center" },
  selGradT: { ...type.buttonLabel, fontSize: 14.5, color: "#fff" },
  selOutline: { borderWidth: 1.5, borderColor: C.teal, borderRadius: radius.input, padding: 11, alignItems: "center" },
  selOutlineT: { ...type.buttonLabel, fontSize: 13.5, color: C.teal },
  infoStrip: { flexDirection: "row", gap: 8, backgroundColor: C.bg, borderRadius: radius.card, padding: 14, marginTop: 4 },
  infoT: { flex: 1, ...type.body, fontSize: 11.5, color: C.faint, lineHeight: 16 },
});
