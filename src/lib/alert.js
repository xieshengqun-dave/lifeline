import { Alert, Platform } from "react-native";

// Cross-platform Alert.alert (same signature). React Native's Alert does
// NOTHING on the web build — no dialog, no button callbacks — so every
// confirmation ("Cancel request?"), error message and "OK → go home" was
// silently dead in the web app (found 2026-11-13 on the iPad demo). Native
// keeps the system alert; web shows an in-app dialog via <AlertHost />
// (src/components/ui/AlertHost.js, mounted once in App.js).
//
// Always use showAlert in this app, never Alert.alert directly.

let present = null; // set by AlertHost while it is mounted

export function registerAlertPresenter(fn) {
  present = fn;
  return () => {
    if (present === fn) present = null;
  };
}

export function showAlert(title, message, buttons) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }
  const list = buttons?.length ? buttons : [{ text: "OK" }];
  if (present) {
    present({ title, message, buttons: list });
    return;
  }
  // No host mounted (should not happen) — still never fail silently.
  const text = [title, message].filter(Boolean).join("\n\n");
  if (list.length === 1) {
    window.alert(text);
    list[0].onPress?.();
    return;
  }
  const action = list.find((b) => b.style !== "cancel" && b.onPress) || list[list.length - 1];
  const dismiss = list.find((b) => b !== action);
  if (window.confirm(text)) action.onPress?.();
  else dismiss?.onPress?.();
}
