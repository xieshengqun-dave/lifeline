import React from "react";
import { View, StyleSheet } from "react-native";
import { radius, shadows } from "../../theme/tokens";

// Static visual chrome only — rounded top corners + drag-handle bar + sheet
// shadow. Not a real draggable/collapsible sheet: every "bottom sheet" in
// the design is a fixed full-screen layout, never actually dragged, so
// @gorhom/bottom-sheet + reanimated + gesture-handler isn't justified here.
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
