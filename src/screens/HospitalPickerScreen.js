import React from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

// Destination-only picker (ambulance destinations are always hospitals,
// unlike pickup — which can be any address, see AddressPickerScreen) over a
// curated hospital list. Real Google Places Autocomplete would need a paid
// Maps API key (a human decision, not built here); this fully covers
// "search / nearest list" without one.
export default function HospitalPickerScreen({ navigation }) {
  const { booking, update } = React.useContext(BookingContext);
  const [query, setQuery] = React.useState("");

  const results = React.useMemo(() => {
    const filtered = HOSPITALS.filter((h) => h.name.toLowerCase().includes(query.trim().toLowerCase()));
    if (booking.from) {
      return filtered
        .map((h) => ({ ...h, distanceKm: haversineKm(booking.from.latitude, booking.from.longitude, h.latitude, h.longitude) }))
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }
    return filtered;
  }, [query, booking.from]);

  function selectHospital(h) {
    const patch = { to: { latitude: h.latitude, longitude: h.longitude, name: h.name } };
    if (booking.from) {
      patch.distanceKm = haversineKm(booking.from.latitude, booking.from.longitude, h.latitude, h.longitude);
    }
    update(patch);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={["top"]}>
      <Header title="Set Destination" onBack={() => navigation.goBack()} />
      <View style={{ padding: spacing.screenPad, paddingBottom: 8 }}>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={C.faint} style={{ marginLeft: 14 }} />
          <TextInput
            style={s.input}
            placeholder="Search hospitals…"
            placeholderTextColor={C.faint}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
      </View>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: spacing.screenPad, paddingBottom: 18 }}
        data={results}
        keyExtractor={(h) => h.name}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={s.empty}>No matching hospitals.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => selectHospital(item)}>
            <Text style={s.name}>{item.name}</Text>
            {item.distanceKm != null && <Text style={s.dist}>{item.distanceKm.toFixed(1)} km</Text>}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  searchWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: C.line, borderRadius: radius.input, backgroundColor: C.bg },
  input: { flex: 1, padding: 14, fontSize: 14.5, color: C.ink },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  name: { flex: 1, ...type.bodySemibold, fontSize: 14, color: C.ink },
  dist: { ...type.bodySemibold, fontSize: 12.5, color: C.faint },
  empty: { textAlign: "center", color: C.faint, fontSize: 13, marginTop: 20 },
});
