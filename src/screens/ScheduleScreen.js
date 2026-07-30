import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { BookingContext } from "../../App";
import Header from "./_Header";
import Card from "../components/ui/Card";
import GradientButton from "../components/ui/GradientButton";

// Mirrors the backend's scheduling rules (bookings.routes.js): at least 15
// minutes ahead, at most 30 days. The operator search itself starts ~45
// minutes before the scheduled pickup (locked decision 2026-07-27).
const MIN_LEAD_MS = 15 * 60 * 1000;
const MAX_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;

function fmt(d) {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// Local-time "YYYY-MM-DDTHH:mm" for <input type="datetime-local"> (web only).
function toLocalInputValue(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ScheduleScreen({ navigation }) {
  const { update } = React.useContext(BookingContext);
  const [when, setWhen] = React.useState(() => new Date(Date.now() + 60 * 60 * 1000));
  // Android shows pickers as modal dialogs on demand; iOS renders inline.
  const [androidMode, setAndroidMode] = React.useState(null); // "date" | "time" | null

  const lead = when.getTime() - Date.now();
  const tooSoon = lead < MIN_LEAD_MS;
  const tooFar = lead > MAX_AHEAD_MS;

  function onPicked(event, selected) {
    if (Platform.OS === "android") setAndroidMode(null);
    if (selected) setWhen(selected);
  }

  function confirm() {
    update({ scheduledAt: when.toISOString(), bookingType: "transfer" });
    navigation.navigate("Location");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <Header title="Schedule Transport" onBack={() => navigation.goBack()} />
      <View style={{ flex: 1, padding: spacing.screenPad }}>
        <Card style={{ marginBottom: spacing.cardGap }}>
          <Text style={s.sect}>PICKUP TIME</Text>

          {Platform.OS === "web" ? (
            // Browser-native picker — DateTimePicker has no web support.
            <input
              type="datetime-local"
              value={toLocalInputValue(when)}
              min={toLocalInputValue(new Date(Date.now() + MIN_LEAD_MS))}
              max={toLocalInputValue(new Date(Date.now() + MAX_AHEAD_MS))}
              onChange={(e) => { if (e.target.value) setWhen(new Date(e.target.value)); }}
              style={{
                fontSize: 16, padding: 12, border: "1.5px solid #dde5e7", borderRadius: 10,
                width: "100%", boxSizing: "border-box", fontFamily: "inherit", color: "#12222b",
              }}
            />
          ) : Platform.OS === "ios" ? (
            <DateTimePicker
              value={when}
              mode="datetime"
              display="spinner"
              minimumDate={new Date(Date.now() + MIN_LEAD_MS)}
              maximumDate={new Date(Date.now() + MAX_AHEAD_MS)}
              onChange={onPicked}
            />
          ) : (
            <>
              <TouchableOpacity style={s.row} onPress={() => setAndroidMode("date")}>
                <Ionicons name="calendar-outline" size={18} color={C.tealDeep} />
                <Text style={s.rowT}>{when.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.faint} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.row, { borderBottomWidth: 0 }]} onPress={() => setAndroidMode("time")}>
                <Ionicons name="time-outline" size={18} color={C.tealDeep} />
                <Text style={s.rowT}>{when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.faint} />
              </TouchableOpacity>
              {androidMode && (
                <DateTimePicker
                  value={when}
                  mode={androidMode}
                  minimumDate={new Date(Date.now() + MIN_LEAD_MS)}
                  maximumDate={new Date(Date.now() + MAX_AHEAD_MS)}
                  onChange={onPicked}
                />
              )}
            </>
          )}
        </Card>

        <View style={s.note}>
          <Ionicons name="information-circle-outline" size={16} color={C.faint} />
          <Text style={s.noteT}>
            We start finding your operator about 45 minutes before pickup. You can cancel
            any time before then from the Trips tab.
          </Text>
        </View>

        {(tooSoon || tooFar) && (
          <Text style={s.warn}>
            {tooSoon
              ? "Pick a time at least 15 minutes from now — for anything sooner, use Request Ambulance instead."
              : "Scheduled pickups can be at most 30 days ahead."}
          </Text>
        )}

        <View style={{ marginTop: "auto" }}>
          <Text style={s.summary}>Pickup: {fmt(when)}</Text>
          <GradientButton label="Continue" onPress={confirm} disabled={tooSoon || tooFar} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  rowT: { flex: 1, ...type.bodySemibold, fontSize: 14.5, color: C.ink },
  note: { flexDirection: "row", gap: 8, backgroundColor: C.tealSoft, borderRadius: radius.card, padding: 14 },
  noteT: { flex: 1, ...type.body, fontSize: 12, color: C.body, lineHeight: 17 },
  warn: { ...type.body, fontSize: 12.5, color: C.red, marginTop: 12 },
  summary: { ...type.bodySemibold, fontSize: 14, color: C.ink, textAlign: "center", marginBottom: 12 },
});
