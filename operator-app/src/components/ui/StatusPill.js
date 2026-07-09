import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { C } from "../../theme/theme";
import { colors, radius } from "../../theme/tokens";

const VARIANTS = {
  success: { bg: colors.successBg, fg: C.green },
  warning: { bg: colors.warningBg, fg: colors.warningAmber },
  danger: { bg: C.redSoft, fg: C.red },
  active: { bg: C.tealSoft, fg: C.tealDeep },
  neutral: { bg: C.line, fg: C.body },
};

export default function StatusPill({ label, variant = "neutral", dot }) {
  const v = VARIANTS[variant] || VARIANTS.neutral;
  return (
    <View style={[s.pill, { backgroundColor: v.bg }]}>
      {dot && <View style={[s.dot, { backgroundColor: v.fg }]} />}
      <Text style={[s.text, { color: v.fg }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.pill, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  text: { fontSize: 11.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
});
