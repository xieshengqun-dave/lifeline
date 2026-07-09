import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing } from "../theme/tokens";
import Header from "./_Header";
import BottomTabBar from "../components/ui/BottomTabBar";

// Honest placeholder — no real activity feed exists to back this yet.
export default function ActivityScreen({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f8f8" }} edges={["top"]}>
      <Header title="Activity" onBack={() => navigation.goBack()} />
      <View style={s.body}>
        <Ionicons name="time-outline" size={40} color={C.faint} />
        <Text style={s.title}>Coming soon</Text>
        <Text style={s.sub}>Live activity and updates will show up here.</Text>
      </View>
      <BottomTabBar navigation={navigation} active="Activity" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.screenPad, gap: 8 },
  title: { ...type.cardTitle, fontSize: 16, color: C.ink },
  sub: { ...type.body, fontSize: 13, color: C.faint, textAlign: "center" },
});
