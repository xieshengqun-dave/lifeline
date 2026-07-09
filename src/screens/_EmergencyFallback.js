import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius, shadows } from "../theme/tokens";

// Shared "no operators available" panel — used both when a quote comes back
// empty (AmbulancesScreen) and when an in-progress booking runs out of
// operators to offer (WaitingScreen's expired state). Only one secondary
// action is offered (real retry/home) — the design mock's second "Notify me"
// button has no backing notification system, so it's omitted rather than
// added as a dead button.
export default function EmergencyFallback({
  title = "No units available right now",
  body = "Every nearby operator is busy. In a life-threatening emergency, don't wait — call the national emergency line now.",
  secondaryLabel,
  onSecondary,
}) {
  return (
    <View style={s.wrap}>
      <View style={s.iconTile}>
        <Ionicons name="warning" size={36} color={C.red} />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL("tel:999")}>
        <Ionicons name="call" size={20} color="#fff" />
        <Text style={s.callBtnT}>Call 999 now</Text>
      </TouchableOpacity>
      {secondaryLabel && (
        <TouchableOpacity style={s.secondaryBtn} onPress={onSecondary}>
          <Text style={s.secondaryBtnT}>{secondaryLabel}</Text>
        </TouchableOpacity>
      )}

      <View style={s.tipsCard}>
        <Text style={s.tipsTitle}>WHILE YOU WAIT</Text>
        <View style={s.tipRow}>
          <View style={s.tipDot} />
          <Text style={s.tipT}>Keep the patient still and stay on the line with 999.</Text>
        </View>
        <View style={s.tipRow}>
          <View style={s.tipDot} />
          <Text style={s.tipT}>We'll keep searching and alert you the moment a unit frees up.</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.screenPad, backgroundColor: "#fbf4f4" },
  iconTile: { width: 88, height: 88, borderRadius: 26, backgroundColor: C.redSoft, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { ...type.screenTitle, fontSize: 22, color: C.ink, textAlign: "center", marginBottom: 8 },
  body: { ...type.body, fontSize: 13, color: C.body, textAlign: "center", lineHeight: 20, marginBottom: 24, maxWidth: 300 },
  callBtn: {
    flexDirection: "row", gap: 10, backgroundColor: C.red, borderRadius: radius.button, paddingVertical: 18, paddingHorizontal: 40,
    alignItems: "center", justifyContent: "center", width: "100%",
    shadowColor: C.red, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 6,
  },
  callBtnT: { ...type.buttonLabel, fontSize: 17, color: "#fff" },
  secondaryBtn: { marginTop: 14, padding: 8 },
  secondaryBtnT: { ...type.bodySemibold, color: C.faint, fontSize: 13 },
  tipsCard: { marginTop: 30, width: "100%", backgroundColor: "#fff", borderRadius: radius.card, padding: spacing.cardPad, borderWidth: 1, borderColor: "#f2dede" },
  tipsTitle: { ...type.caption, fontSize: 10.5, color: C.faint, marginBottom: 10 },
  tipRow: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "flex-start" },
  tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.red, marginTop: 6 },
  tipT: { flex: 1, ...type.body, fontSize: 12, color: C.body, lineHeight: 17 },
});
