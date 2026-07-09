import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type } from "../theme/tokens";

export default function Header({ title, onBack, right }) {
  return (
    <View style={h.bar}>
      <TouchableOpacity onPress={onBack} style={{ padding: 4, width: 30 }} hitSlop={8}>
        {onBack && <Ionicons name="chevron-back" size={22} color={C.ink} />}
      </TouchableOpacity>
      <Text style={h.title}>{title}</Text>
      <View style={{ minWidth: 30, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
const h = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  title: { flex: 1, textAlign: "center", ...type.cardTitle, fontSize: 16, color: C.ink },
});
