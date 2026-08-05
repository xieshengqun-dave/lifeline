import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../theme/theme";
import { type } from "../../theme/tokens";

// Plain styled row (same pattern as the patient app) — spec W1's tab set:
// Home · Trips · Wallet · Profile.
const TABS = [
  { key: "Home", label: "Home", icon: "home", iconOutline: "home-outline" },
  { key: "TripHistory", label: "Trips", icon: "list", iconOutline: "list-outline" },
  { key: "Wallet", label: "Wallet", icon: "card", iconOutline: "card-outline" },
  { key: "Profile", label: "Profile", icon: "person", iconOutline: "person-outline" },
];

export default function BottomTabBar({ navigation, active }) {
  return (
    <View style={s.bar}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={s.item}
            onPress={() => !isActive && navigation.navigate(tab.key)}
          >
            <Ionicons name={isActive ? tab.icon : tab.iconOutline} size={22} color={isActive ? C.teal : C.faint} />
            <Text style={[s.label, isActive && s.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row", height: 76, backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: C.line, paddingBottom: 14, paddingTop: 8,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { ...type.body, fontSize: 10.5, color: C.faint },
  labelActive: { ...type.bodySemibold, fontSize: 10.5, color: C.teal },
});
