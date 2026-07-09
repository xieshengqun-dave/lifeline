import React from "react";
import { View, StyleSheet } from "react-native";
import { C } from "../../theme/theme";
import { radius, shadows, spacing } from "../../theme/tokens";

// White card wrapper. `lift` = the teal card-lift shadow + teal border used
// for a "best match" / selected state; otherwise a neutral shadow + hairline
// border.
export default function Card({ children, lift, style, noPad }) {
  return (
    <View style={[s.base, noPad ? null : s.pad, lift ? s.lift : s.neutral, style]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  base: { backgroundColor: "#fff", borderRadius: radius.card },
  pad: { padding: spacing.cardPad },
  neutral: { borderWidth: 1, borderColor: C.line, ...shadows.neutralCard },
  lift: { borderWidth: 2, borderColor: C.teal, ...shadows.cardLift },
});
