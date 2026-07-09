import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius, shadows } from "../theme/tokens";
import { BookingContext } from "../../App";
import { HOSPITALS } from "../lib/hospitals";
import BottomSheetShell from "../components/ui/BottomSheetShell";
import GradientButton from "../components/ui/GradientButton";

const HOSPITAL = { latitude: 3.1547, longitude: 101.5937 };

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Native GPS — this is the big win over the web version: real, precise,
// permission-prompted location with no https requirement.
export default function LocationScreen({ navigation }) {
  const { booking, update, resetDraft } = React.useContext(BookingContext);
  const [region, setRegion] = useState({ ...HOSPITAL, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  const [locating, setLocating] = useState(true);
  const mapRef = useRef(null);

  useEffect(() => { locateUser(); }, []);

  async function locateUser() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocating(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      let name = "Current location";
      try {
        const geo = await Location.reverseGeocodeAsync(here);
        if (geo[0]) name = "Current location · " + [geo[0].name, geo[0].district || geo[0].city].filter(Boolean).join(", ");
      } catch (e) {}
      update({ from: { ...here, name } });
      const r = { ...here, latitudeDelta: 0.02, longitudeDelta: 0.02 };
      setRegion(r);
      mapRef.current?.animateToRegion(r, 600);
    } catch (e) {}
    setLocating(false);
  }

  function selectQuickHospital(h) {
    const patch = { to: { latitude: h.latitude, longitude: h.longitude, name: h.name } };
    if (booking.from) patch.distanceKm = haversineKm(booking.from.latitude, booking.from.longitude, h.latitude, h.longitude);
    update(patch);
  }

  const quickHospitals = React.useMemo(() => {
    if (!booking.from) return HOSPITALS.slice(0, 4);
    return [...HOSPITALS]
      .map((h) => ({ ...h, d: haversineKm(booking.from.latitude, booking.from.longitude, h.latitude, h.longitude) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);
  }, [booking.from]);

  const ready = booking.from && booking.to;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation
      >
        {booking.from && <Marker coordinate={booking.from} pinColor={C.green} title="Pickup" />}
        {booking.to && <Marker coordinate={booking.to} pinColor={C.navy} title="Destination" />}
        {ready && <Polyline coordinates={[booking.from, booking.to]} strokeColor={C.teal} strokeWidth={4} />}
      </MapView>

      <View style={s.topRow}>
        <TouchableOpacity
          style={s.floatBtn}
          onPress={() => { resetDraft(); navigation.reset({ index: 0, routes: [{ name: "Welcome" }] }); }}
        >
          <Ionicons name="home-outline" size={20} color={C.ink} />
        </TouchableOpacity>
        <TouchableOpacity style={s.floatBtn} onPress={locateUser} disabled={locating}>
          {locating ? <ActivityIndicator size="small" color={C.teal} /> : <Ionicons name="locate" size={20} color={C.ink} />}
        </TouchableOpacity>
      </View>

      <BottomSheetShell style={s.sheet}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenPad, paddingBottom: 22 }}>
          <Text style={s.title}>Where to?</Text>

          <View style={s.locRows}>
            <TouchableOpacity style={s.row} onPress={() => navigation.navigate("AddressPicker")}>
              <View style={[s.dot, { backgroundColor: C.green }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.lbl}>PICKUP</Text>
                <Text style={s.val}>{booking.from?.name || "Set pickup"}</Text>
              </View>
            </TouchableOpacity>
            <View style={s.connector} />
            <TouchableOpacity style={s.row} onPress={() => navigation.navigate("HospitalPicker")}>
              <View style={[s.dotSq, { backgroundColor: C.teal, borderColor: C.teal }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.lbl}>DESTINATION</Text>
                <Text style={s.val}>{booking.to?.name || "Set destination"}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {quickHospitals.map((h) => (
              <TouchableOpacity key={h.name} style={s.chip} onPress={() => selectQuickHospital(h)}>
                <Text style={s.chipT} numberOfLines={1}>{h.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {ready && (
            <View style={s.metaRow}>
              <Ionicons name="time-outline" size={15} color={C.faint} />
              <Text style={s.metaT}>{(booking.distanceKm || 0).toFixed(1)} km · ~{Math.max(5, Math.round((booking.distanceKm || 0) * 1.6))} min</Text>
            </View>
          )}

          <GradientButton label="Confirm route" onPress={() => navigation.navigate("Assess")} disabled={!ready} />
        </ScrollView>
      </BottomSheetShell>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topRow: { position: "absolute", top: 14, left: 14, right: 14, flexDirection: "row", justifyContent: "space-between" },
  floatBtn: {
    width: 44, height: 44, borderRadius: radius.icon + 1, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center", ...shadows.floatingControl,
  },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "58%" },
  title: { ...type.screenTitle, fontSize: 20, color: C.ink, marginTop: 14, marginBottom: 14 },
  locRows: { backgroundColor: C.bg, borderRadius: radius.card, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  connector: { height: 1, backgroundColor: C.line, marginLeft: 34 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotSq: { width: 12, height: 12, borderRadius: 3, borderWidth: 2 },
  lbl: { ...type.caption, fontSize: 10, color: C.faint },
  val: { ...type.bodySemibold, fontSize: 14, color: C.ink, marginTop: 2 },
  chip: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: radius.pill, paddingHorizontal: 14,
    paddingVertical: 8, marginRight: 8, maxWidth: 160,
  },
  chipT: { ...type.bodySemibold, fontSize: 12.5, color: C.ink },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  metaT: { ...type.body, fontSize: 12.5, color: C.faint },
});
