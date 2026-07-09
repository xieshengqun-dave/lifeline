import React from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { BookingContext } from "../../App";
import { HOSPITALS } from "../lib/hospitals";
import Header from "./_Header";

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Pickup can be anywhere (home, accident scene, any address) — unlike the
// destination, which is always a hospital (see HospitalPickerScreen). Uses
// expo-location's forward geocoding (Location.geocodeAsync), which resolves
// free-text addresses via the OS's native geocoder — no paid Places API key
// needed, same package already used for GPS + reverse geocoding on this
// screen's parent (LocationScreen).
export default function AddressPickerScreen({ navigation }) {
  const { booking, update } = React.useContext(BookingContext);
  const [query, setQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [results, setResults] = React.useState([]);
  const [error, setError] = React.useState(null);

  function selectLocation(loc) {
    const patch = { from: loc };
    if (booking.to) {
      patch.distanceKm = haversineKm(loc.latitude, loc.longitude, booking.to.latitude, booking.to.longitude);
    }
    update(patch);
    navigation.goBack();
  }

  async function searchAddress() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const matches = await Location.geocodeAsync(q);
      if (!matches.length) {
        setError("No matches found for that address.");
        return;
      }
      // name is always what the user actually typed — never overwritten by
      // the reverse-geocode guess, which is only the nearest known place to
      // the resolved pin and can legitimately differ from the real address
      // (see the on-screen note about free/native geocoding precision).
      const named = await Promise.all(
        matches.slice(0, 5).map(async (m) => {
          let area = null;
          try {
            const rev = await Location.reverseGeocodeAsync({ latitude: m.latitude, longitude: m.longitude });
            if (rev[0]) area = [rev[0].street, rev[0].district || rev[0].city].filter(Boolean).join(", ");
          } catch {}
          return { latitude: m.latitude, longitude: m.longitude, name: q, area };
        })
      );
      setResults(named);
    } catch {
      setError("Could not search that address. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      let name = "Current location";
      try {
        const geo = await Location.reverseGeocodeAsync(here);
        if (geo[0]) name = "Current location · " + [geo[0].name, geo[0].district || geo[0].city].filter(Boolean).join(", ");
      } catch {}
      selectLocation({ ...here, name });
    } finally {
      setLocating(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={["top"]}>
      <Header title="Set Pickup" onBack={() => navigation.goBack()} />
      <View style={{ padding: spacing.screenPad, paddingBottom: 8 }}>
        <TouchableOpacity style={s.gpsBtn} onPress={useCurrentLocation} disabled={locating}>
          {locating ? (
            <ActivityIndicator color={C.teal} />
          ) : (
            <>
              <Ionicons name="navigate" size={16} color={C.tealDeep} />
              <Text style={s.gpsBtnT}>Use Current Location</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={s.orLbl}>OR SEARCH ANY ADDRESS</Text>
        <View style={s.searchRow}>
          <TextInput
            style={s.input}
            placeholder="Enter address, building, or area"
            placeholderTextColor={C.faint}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={searchAddress}
            returnKeyType="search"
          />
          <TouchableOpacity style={s.searchBtn} onPress={searchAddress} disabled={searching}>
            {searching ? <ActivityIndicator color="#fff" /> : <Ionicons name="search" size={17} color="#fff" />}
          </TouchableOpacity>
        </View>
        {error && <Text style={s.error}>{error}</Text>}
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: spacing.screenPad, paddingBottom: 18 }}
        keyboardShouldPersistTaps="handled"
        data={results}
        keyExtractor={(item, i) => `${item.latitude}-${item.longitude}-${i}`}
        ListHeaderComponent={
          results.length > 0 ? (
            <>
              <Text style={s.sect}>Search Results</Text>
              <Text style={s.precisionNote}>
                The pin may land near, not exactly on, the address typed — free device
                geocoding, not a paid precise lookup. Tap "Use Current Location" instead
                if you're already there.
              </Text>
            </>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => selectLocation(item)}>
            <Text style={s.name}>{item.name}</Text>
            {item.area && <Text style={s.area}>Near: {item.area}</Text>}
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <>
            <Text style={[s.sect, { marginTop: results.length ? 20 : 0 }]}>Or a Hospital</Text>
            {HOSPITALS.map((h) => (
              <TouchableOpacity key={h.name} style={s.row} onPress={() => selectLocation(h)}>
                <Text style={s.name}>{h.name}</Text>
              </TouchableOpacity>
            ))}
          </>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  gpsBtn: { flexDirection: "row", gap: 8, backgroundColor: C.tealSoft, borderRadius: radius.input, padding: 14, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  gpsBtnT: { ...type.bodySemibold, color: C.tealDeep, fontSize: 14 },
  orLbl: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8 },
  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1.5, borderColor: C.line, borderRadius: radius.input, padding: 13, fontSize: 14, color: C.ink },
  searchBtn: { backgroundColor: C.teal, borderRadius: radius.input, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  error: { color: C.red, fontSize: 12.5, marginTop: 10 },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 6 },
  precisionNote: { ...type.body, fontSize: 11, color: C.faint, lineHeight: 15, marginBottom: 10 },
  row: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  name: { ...type.bodySemibold, fontSize: 14, color: C.ink },
  area: { ...type.body, fontSize: 11.5, color: C.faint, marginTop: 2 },
});
