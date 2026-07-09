import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing } from "../theme/tokens";
import Header from "./_Header";
import BottomTabBar from "../components/ui/BottomTabBar";

// No trip-history endpoint exists yet (GET /api/bookings scoped to the
// patient would be needed) — an honest placeholder rather than fake data,
// matching the admin dashboard's "Analytics — coming in a later phase" tab.
export default function TripsScreen({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f8f8" }} edges={["top"]}>
      <Header title="Trips" onBack={() => navigation.goBack()} />
      <View style={s.body}>
        <Ionicons name="list-outline" size={40} color={C.faint} />
        <Text style={s.title}>Coming soon</Text>
        <Text style={s.sub}>Your trip history will show up here.</Text>
      </View>
      <BottomTabBar navigation={navigation} active="Trips" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.screenPad, gap: 8 },
  title: { ...type.cardTitle, fontSize: 16, color: C.ink },
  sub: { ...type.body, fontSize: 13, color: C.faint, textAlign: "center" },
});
