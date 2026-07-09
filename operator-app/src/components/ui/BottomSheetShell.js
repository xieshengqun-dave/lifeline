import React from "react";
import { View, StyleSheet } from "react-native";
import { radius, shadows } from "../../theme/tokens";

// Static visual chrome only — see the patient app's identical component for
// why this isn't a real draggable sheet.
export default function BottomSheetShell({ children, style }) {
  return (
    <View style={[s.sheet, style]}>
      <View style={s.handle} />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    ...shadows.bottomSheet,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: "#e2e8ee", alignSelf: "center", marginTop: 10, marginBottom: 4 },
});
