import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { C } from "../../theme/theme";
import { type, radius } from "../../theme/tokens";
import { registerAlertPresenter } from "../../lib/alert";

// The web build's stand-in for the system alert — see src/lib/alert.js.
// Mounted once at the app root; shows one dialog at a time and queues the
// rest, so an error raised while a confirmation is open is never lost.
// Closes only through its buttons, like a native alert.
export default function AlertHost() {
  const [queue, setQueue] = React.useState([]);

  React.useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    return registerAlertPresenter((alert) => setQueue((q) => [...q, alert]));
  }, []);

  if (Platform.OS !== "web" || queue.length === 0) return null;
  const { title, message, buttons } = queue[0];

  function press(button) {
    setQueue((q) => q.slice(1));
    button.onPress?.();
  }

  const stacked = buttons.length > 2;
  return (
    <View style={a.overlay} accessibilityRole="alert">
      <View style={a.card}>
        {!!title && <Text style={a.title}>{title}</Text>}
        {!!message && <Text style={a.message}>{message}</Text>}
        <View style={[a.buttons, stacked && a.buttonsStacked]}>
          {buttons.map((b, i) => {
            const destructive = b.style === "destructive";
            const quiet = b.style === "cancel" || (!destructive && buttons.length > 1 && !b.onPress);
            return (
              <TouchableOpacity
                key={`${b.text}-${i}`}
                style={[a.button, !stacked && { flex: 1 }, destructive ? a.buttonRed : quiet ? a.buttonQuiet : a.buttonMain]}
                onPress={() => press(b)}
                accessibilityRole="button"
              >
                <Text style={[a.buttonT, quiet && { color: C.ink }]}>{b.text || "OK"}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const a = StyleSheet.create({
  overlay: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000,
    backgroundColor: "rgba(20,35,63,0.55)", alignItems: "center", justifyContent: "center", padding: 24,
  },
  card: { width: "100%", maxWidth: 360, backgroundColor: C.card, borderRadius: radius.card, padding: 22 },
  title: { ...type.cardTitle, fontSize: 17, color: C.ink, textAlign: "center" },
  message: { ...type.body, fontSize: 13.5, color: C.body, textAlign: "center", lineHeight: 20, marginTop: 8 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 20 },
  buttonsStacked: { flexDirection: "column" },
  button: { minHeight: 48, borderRadius: radius.input, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buttonMain: { backgroundColor: C.teal },
  buttonRed: { backgroundColor: C.red },
  buttonQuiet: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  buttonT: { ...type.buttonLabel, fontSize: 14, color: "#fff" },
});
