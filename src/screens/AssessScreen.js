import React from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { BookingContext } from "../../App";
import Header from "./_Header";
import GradientButton from "../components/ui/GradientButton";

const Pill = ({ on, label, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[p.pill, on && p.on]}>
    <Text style={[p.t, on && p.tOn]}>{label}</Text>
  </TouchableOpacity>
);

// Fields intentionally unchanged from the existing clinical model (age/sex/
// conscious level/oxygen tier/IV+medication/diagnosis/special request) — the
// design handoff's alternative Severity+Symptoms model was evaluated and
// rejected; only the visual styling below matches the new design language.
export default function AssessScreen({ navigation }) {
  const { booking, update, resetDraft } = React.useContext(BookingContext);
  const conds = ["Fully Conscious", "Semi-Conscious", "Sedated", "Unconscious"];

  function goHome() {
    resetDraft();
    navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={["top"]}>
      <Header title="Patient Assessment" onBack={() => navigation.goBack()} onHome={goHome} />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPad }}>
        <Text style={p.sect}>AGE</Text>
        <TextInput
          style={p.input}
          keyboardType="number-pad"
          placeholder="Patient age"
          placeholderTextColor={C.faint}
          value={booking.age}
          onChangeText={(v) => update({ age: v })}
        />

        <Text style={p.sect}>SEX</Text>
        <View style={p.rowGap}>
          <Pill on={booking.gender === "Male"} label="Male" onPress={() => update({ gender: "Male" })} />
          <Pill on={booking.gender === "Female"} label="Female" onPress={() => update({ gender: "Female" })} />
        </View>

        <Text style={p.sect}>CONSCIOUS LEVEL</Text>
        <View style={p.grid}>
          {conds.map((c) => <Pill key={c} on={booking.cond === c} label={c} onPress={() => update({ cond: c })} />)}
        </View>

        <Text style={p.sect}>OXYGEN SUPPORT</Text>
        <View style={p.rowGap}>
          <Pill on={booking.oxy === "Yes"} label="Yes" onPress={() => update({ oxy: "Yes" })} />
          <Pill on={booking.oxy === "No"} label="No" onPress={() => update({ oxy: "No" })} />
        </View>
        {booking.oxy === "Yes" && (
          <View style={p.subBlock}>
            <Text style={p.subLbl}>Flow rate</Text>
            <View style={p.rowGap}>
              <Pill on={booking.flow === "<5L"} label="<5L" onPress={() => update({ flow: "<5L" })} />
              <Pill on={booking.flow === ">5L"} label=">5L" onPress={() => update({ flow: ">5L" })} />
            </View>
          </View>
        )}

        <Text style={p.sect}>ON IV THERAPY</Text>
        <View style={p.rowGap}>
          <Pill on={booking.iv === "Yes"} label="Yes" onPress={() => update({ iv: "Yes" })} />
          <Pill on={booking.iv === "No"} label="No" onPress={() => update({ iv: "No" })} />
        </View>
        {booking.iv === "Yes" && (
          <View style={p.subBlock}>
            <Text style={p.subLbl}>Medication</Text>
            <TextInput
              style={p.input}
              placeholder="e.g. Normal Saline, Adrenaline"
              placeholderTextColor={C.faint}
              value={booking.medication}
              onChangeText={(v) => update({ medication: v })}
            />
          </View>
        )}

        <Text style={p.sect}>DIAGNOSIS</Text>
        <View style={p.rowGap}>
          <Pill on={booking.diagnosisType === "RTA"} label="RTA" onPress={() => update({ diagnosisType: "RTA" })} />
          <Pill on={booking.diagnosisType === "Other"} label="Other" onPress={() => update({ diagnosisType: "Other" })} />
        </View>
        {booking.diagnosisType === "Other" && (
          <View style={p.subBlock}>
            <TextInput
              style={p.input}
              placeholder="Describe diagnosis"
              placeholderTextColor={C.faint}
              value={booking.diagnosisOther}
              onChangeText={(v) => update({ diagnosisOther: v })}
            />
          </View>
        )}

        <Text style={p.sect}>SPECIAL REQUEST</Text>
        <TextInput
          style={p.input}
          placeholder="e.g. Family member to accompany (optional)"
          placeholderTextColor={C.faint}
          value={booking.specialRequest}
          onChangeText={(v) => update({ specialRequest: v })}
        />

        <GradientButton label="Continue" onPress={() => navigation.navigate("Ambulances")} style={{ marginTop: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
const p = StyleSheet.create({
  sect: { ...type.caption, fontSize: 12, color: C.ink, marginBottom: 12, marginTop: 8 },
  subLbl: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8 },
  subBlock: { marginTop: -4, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  rowGap: { flexDirection: "row", gap: 10, marginBottom: 12 },
  pill: { borderWidth: 1.5, borderColor: C.line, borderRadius: radius.input, paddingVertical: 12, paddingHorizontal: 16, flexGrow: 1, alignItems: "center" },
  on: { borderColor: C.teal, backgroundColor: C.tealSoft },
  t: { ...type.bodySemibold, fontSize: 13.5, color: C.ink },
  tOn: { color: C.tealDeep },
  input: { borderWidth: 1.5, borderColor: C.line, borderRadius: radius.input, padding: 13, fontSize: 14, color: C.ink, marginBottom: 12 },
});
