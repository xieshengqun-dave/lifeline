import React from "react";
import { View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W - spacing.screenPad * 2 - 28; // peek of the next card
const CARD_SNAP = CARD_W + 12;
const KL_FALLBACK = { latitude: 3.139, longitude: 101.6869 };

function initials(name) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const hasCoords = (op) => op.baseLat != null && op.baseLng != null;

export default function AmbulancesScreen({ navigation }) {
  const { booking, update, resetDraft } = React.useContext(BookingContext);
  const goHome = () => {
    resetDraft();
    navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
  };
  const [state, setState] = React.useState({ loading: true, error: null, operators: [] });
  const [sortKey, setSortKey] = React.useState("eta");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const mapRef = React.useRef(null);
  const listRef = React.useRef(null);

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

  const active = sorted[activeIndex] || null;

  // Fit the map around the pickup + every operator base once results land.
  // Older deployed backends may not return baseLat/baseLng yet — pins are
  // simply omitted for those operators, the carousel still works.
  const fitAll = React.useCallback(() => {
    const coords = [];
    if (booking.from) coords.push({ latitude: booking.from.latitude, longitude: booking.from.longitude });
    sorted.filter(hasCoords).forEach((op) => coords.push({ latitude: op.baseLat, longitude: op.baseLng }));
    if (coords.length === 0) return;
    if (coords.length === 1) {
      mapRef.current?.animateToRegion({ ...coords[0], latitudeDelta: 0.04, longitudeDelta: 0.04 }, 500);
      return;
    }
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 130, left: 70, right: 70, bottom: 320 },
      animated: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, booking.from]);

  React.useEffect(() => {
    if (!state.loading && sorted.length > 0) {
      // Let the MapView mount before fitting.
      const t = setTimeout(fitAll, 350);
      return () => clearTimeout(t);
    }
  }, [state.loading, sorted.length, fitAll]);

  function focusOperator(index, { scrollList } = {}) {
    setActiveIndex(index);
    const op = sorted[index];
    if (op && hasCoords(op)) {
      mapRef.current?.animateToRegion(
        { latitude: op.baseLat, longitude: op.baseLng, latitudeDelta: 0.03, longitudeDelta: 0.03 },
        400
      );
    }
    if (scrollList) listRef.current?.scrollToOffset({ offset: index * CARD_SNAP, animated: true });
  }

  function changeSort(key) {
    setSortKey(key);
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function selectOperator(op) {
    update({ selectedOperator: normalizeOperator(op) });
    navigation.navigate("Review");
  }

  function onCarouselSettle(e) {
    const i = Math.min(sorted.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / CARD_SNAP)));
    if (i !== activeIndex) focusOperator(i);
  }

  const initialRegion = {
    ...(booking.from
      ? { latitude: booking.from.latitude, longitude: booking.from.longitude }
      : KL_FALLBACK),
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };

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
        <View style={{ flex: 1 }}>
          <MapView ref={mapRef} style={StyleSheet.absoluteFill} provider={PROVIDER_GOOGLE} initialRegion={initialRegion}>
            {booking.from && (
              <Marker
                coordinate={{ latitude: booking.from.latitude, longitude: booking.from.longitude }}
                title="Pickup"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={a.pickupDotOuter}>
                  <View style={a.pickupDotInner} />
                </View>
              </Marker>
            )}
            {sorted.filter(hasCoords).map((op) => {
              const i = sorted.indexOf(op);
              const isActive = i === activeIndex;
              return (
                // key includes isActive so the marker remounts on selection —
                // required because tracksViewChanges={false} freezes the
                // rendered view and it wouldn't restyle otherwise.
                <Marker
                  key={`${op.operatorId}-${isActive}`}
                  coordinate={{ latitude: op.baseLat, longitude: op.baseLng }}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                  onPress={() => focusOperator(i, { scrollList: true })}
                >
                  <View style={a.pinWrap}>
                    <View style={[a.pin, isActive && a.pinOn]}>
                      <MaterialCommunityIcons name="ambulance" size={13} color={isActive ? "#fff" : C.tealDeep} />
                      <Text style={[a.pinT, isActive && a.pinTOn]}>RM{op.price.total.toFixed(0)}</Text>
                    </View>
                    <View style={[a.pinTip, isActive && a.pinTipOn]} />
                  </View>
                </Marker>
              );
            })}
          </MapView>

          <View style={a.mapTop}>
            <View style={a.countPill}>
              <Text style={a.countPillT}>{state.operators.length} units near you</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {SORTS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[a.sortChip, sortKey === s.key && a.sortChipOn]}
                  onPress={() => changeSort(s.key)}
                >
                  <Text style={[a.sortChipT, sortKey === s.key && a.sortChipTOn]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity style={a.fitBtn} onPress={fitAll}>
            <Ionicons name="scan-outline" size={19} color={C.ink} />
          </TouchableOpacity>

          <View style={a.bottom}>
            <View style={a.infoStrip}>
              <Ionicons name="information-circle-outline" size={14} color={C.faint} />
              <Text style={a.infoT}>
                Prices set by each operator. Life-threatening? <Text style={{ color: C.red, fontWeight: "700" }}>Call 999</Text>.
              </Text>
            </View>
            <FlatList
              ref={listRef}
              data={sorted}
              horizontal
              keyExtractor={(op) => op.operatorId}
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_SNAP}
              decelerationRate="fast"
              onMomentumScrollEnd={onCarouselSettle}
              getItemLayout={(_, i) => ({ length: CARD_SNAP, offset: CARD_SNAP * i, index: i })}
              contentContainerStyle={{ paddingHorizontal: spacing.screenPad, paddingBottom: 14 }}
              renderItem={({ item: op, index: i }) => {
                const isBest = i === 0;
                const isActive = i === activeIndex;
                const ratingLabel = op.ratingAvg != null ? `★ ${op.ratingAvg.toFixed(1)}` : "New";
                return (
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => (isActive ? null : focusOperator(i, { scrollList: true }))}
                    style={[a.card, isActive ? a.cardActive : a.cardStandard, isBest && { paddingTop: 8 }, { width: CARD_W, marginRight: 12 }]}
                  >
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
                        <Text style={a.nm} numberOfLines={1}>{op.name}</Text>
                        <Text style={a.tp} numberOfLines={1}>
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
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
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
  mapTop: { position: "absolute", top: 12, left: spacing.screenPad, right: spacing.screenPad },
  countPill: {
    alignSelf: "flex-start", backgroundColor: C.navy, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8, ...shadows.floatingControl,
  },
  countPillT: { ...type.bodySemibold, fontSize: 12, color: "#fff" },
  sortChip: {
    borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8,
    backgroundColor: "#fff", ...shadows.floatingControl,
  },
  sortChipOn: { backgroundColor: C.navy },
  sortChipT: { ...type.bodySemibold, fontSize: 12.5, color: C.body },
  sortChipTOn: { color: "#fff" },
  fitBtn: {
    position: "absolute", right: spacing.screenPad, top: 96, width: 42, height: 42,
    borderRadius: radius.icon + 1, backgroundColor: "#fff", alignItems: "center",
    justifyContent: "center", ...shadows.floatingControl,
  },
  pickupDotOuter: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(14,140,140,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  pickupDotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.teal, borderWidth: 2, borderColor: "#fff" },
  pinWrap: { alignItems: "center" },
  pin: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fff",
    borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1.5, borderColor: C.tealLine, ...shadows.floatingControl,
  },
  pinOn: { backgroundColor: C.tealDeep, borderColor: C.tealDeep },
  pinT: { ...type.bodySemibold, fontSize: 11.5, color: C.ink },
  pinTOn: { color: "#fff" },
  pinTip: {
    width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#fff", marginTop: -1,
  },
  pinTipOn: { borderTopColor: C.tealDeep },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  infoStrip: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.94)", borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10, ...shadows.floatingControl,
  },
  infoT: { ...type.body, fontSize: 11, color: C.faint },
  card: { borderRadius: radius.card, padding: spacing.cardPad, backgroundColor: "#fff" },
  cardActive: { borderWidth: 2, borderColor: C.teal, ...shadows.cardLift },
  cardStandard: { borderWidth: 1.5, borderColor: C.line, ...shadows.neutralCard },
  ribbon: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  ribbonT: { ...type.caption, fontSize: 10, color: "#fff" },
  head: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarT: { ...type.cardTitle, fontSize: 14, color: "#fff" },
  nm: { ...type.cardTitle, color: C.ink },
  tp: { ...type.body, fontSize: 11.5, color: C.faint, marginTop: 2 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginVertical: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line },
  metricV: { ...type.cardTitle, fontSize: 15, color: C.ink },
  metricK: { ...type.body, fontSize: 10, color: C.faint, marginTop: 2 },
  selGrad: { borderRadius: radius.input, padding: 12, alignItems: "center" },
  selGradT: { ...type.buttonLabel, fontSize: 14, color: "#fff" },
  selOutline: { borderWidth: 1.5, borderColor: C.teal, borderRadius: radius.input, padding: 10, alignItems: "center" },
  selOutlineT: { ...type.buttonLabel, fontSize: 13.5, color: C.teal },
});
