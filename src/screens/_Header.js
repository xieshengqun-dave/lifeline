import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type } from "../theme/tokens";

export default function Header({ title, onBack, onHome }) {
  return (
    <View style={h.bar}>
      <TouchableOpacity onPress={onBack} style={h.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={C.ink} />
      </TouchableOpacity>
      <Text style={h.title}>{title}</Text>
      <View style={{ width: 44, alignItems: "flex-end" }}>
        {onHome && (
          <TouchableOpacity onPress={onHome} hitSlop={8}>
            <Text style={h.home}>Home</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const h = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  backBtn: { padding: 4, width: 30 },
  title: { flex: 1, textAlign: "center", ...type.cardTitle, fontSize: 16, color: C.ink },
  home: { ...type.bodySemibold, fontSize: 12.5, color: C.teal },
});
