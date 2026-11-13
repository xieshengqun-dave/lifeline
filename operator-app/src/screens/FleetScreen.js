import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { getOperatorFleetAll, createAmbulance, updateAmbulance, createCrew, updateCrew } from "../api/client";
import Header from "./_Header";
import Card from "../components/ui/Card";

// Fleet & crew (2026-11-13): the operator's own ambulances and people — the
// lists the trip screen's assignment picker reads from. Nothing is deleted
// (past trips point at these rows); "Deactivate" hides a unit or person from
// new assignments. At least one active ambulance and one active crew member
// are needed to go online.

const AMBULANCE_TYPES = [
  { key: "BLS", label: "BLS" },
  { key: "ALS", label: "ALS" },
  { key: "NEONATAL", label: "Neonatal" },
];
const CREW_ROLES = [
  { key: "PARAMEDIC", label: "Paramedic" },
  { key: "DRIVER", label: "Driver" },
];
const ROLE_LABEL = { PARAMEDIC: "Paramedic", DRIVER: "Driver" };

function Segmented({ options, value, onChange, disabled }) {
  return (
    <View style={f.segRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          style={[f.seg, value === o.key && f.segOn]}
          onPress={() => onChange(o.key)}
          disabled={disabled}
        >
          <Text style={[f.segT, value === o.key && f.segTOn]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function FleetScreen({ navigation }) {
  const [fleet, setFleet] = React.useState(null);
  const [loadError, setLoadError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [plate, setPlate] = React.useState("");
  const [ambType, setAmbType] = React.useState("BLS");
  const [crewName, setCrewName] = React.useState("");
  const [crewRole, setCrewRole] = React.useState("PARAMEDIC");
  const [crewPhone, setCrewPhone] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setFleet(await getOperatorFleetAll());
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message || "Could not load your fleet.");
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function run(action) {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (e) {
      Alert.alert("Couldn't save", e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function addAmbulance() {
    if (plate.trim().length < 2) return Alert.alert("Plate number", "Enter the ambulance's plate number.");
    run(async () => {
      await createAmbulance({ plate, type: ambType });
      setPlate("");
    });
  }

  function addCrew() {
    if (crewName.trim().length < 2) return Alert.alert("Name", "Enter the crew member's name.");
    run(async () => {
      await createCrew({ name: crewName, role: crewRole, phone: crewPhone });
      setCrewName("");
      setCrewPhone("");
    });
  }

  if (!fleet) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        <Header title="Fleet & crew" onBack={() => navigation.goBack()} />
        <View style={f.center}>
          {loadError ? (
            <>
              <Text style={f.errorT}>{loadError}</Text>
              <TouchableOpacity style={f.retryBtn} onPress={load}><Text style={f.retryT}>Retry</Text></TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator color={C.teal} size="large" />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const activeAmbulances = fleet.ambulances.filter((a) => a.active).length;
  const activeCrew = fleet.crew.filter((c) => c.active).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <Header title="Fleet & crew" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPad, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {(activeAmbulances === 0 || activeCrew === 0) && (
          <View style={f.notice}>
            <Ionicons name="alert-circle-outline" size={17} color={C.red} />
            <Text style={f.noticeT}>
              You need at least one active ambulance and one active crew member before you can go online.
            </Text>
          </View>
        )}

        <Text style={f.sect}>AMBULANCES · {activeAmbulances} ACTIVE</Text>
        <Card style={f.card}>
          {fleet.ambulances.length === 0 && <Text style={f.empty}>No ambulances yet — add your first below.</Text>}
          {fleet.ambulances.map((a) => (
            <View key={a.id} style={f.row}>
              <View style={{ flex: 1 }}>
                <Text style={[f.rowT, !a.active && f.off]}>{a.plate}</Text>
                <Text style={f.rowS}>{a.type}{a.active ? "" : " · inactive"}</Text>
              </View>
              <TouchableOpacity onPress={() => run(() => updateAmbulance(a.id, { active: !a.active }))} disabled={busy} hitSlop={8}>
                <Text style={[f.link, a.active && { color: C.red }]}>{a.active ? "Deactivate" : "Activate"}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Text style={f.formL}>Add an ambulance</Text>
          <TextInput
            style={f.input}
            placeholder="Plate number, e.g. WXY 1234"
            placeholderTextColor={C.faint}
            value={plate}
            onChangeText={setPlate}
            autoCapitalize="characters"
            maxLength={15}
            editable={!busy}
          />
          <Segmented options={AMBULANCE_TYPES} value={ambType} onChange={setAmbType} disabled={busy} />
          <TouchableOpacity style={[f.addBtn, busy && f.btnOff]} onPress={addAmbulance} disabled={busy}>
            <Text style={f.addBtnT}>Add ambulance</Text>
          </TouchableOpacity>
        </Card>

        <Text style={f.sect}>CREW · {activeCrew} ACTIVE</Text>
        <Card style={f.card}>
          {fleet.crew.length === 0 && <Text style={f.empty}>No crew yet — add your first below.</Text>}
          {fleet.crew.map((c) => (
            <View key={c.id} style={f.row}>
              <View style={{ flex: 1 }}>
                <Text style={[f.rowT, !c.active && f.off]}>{c.name}</Text>
                <Text style={f.rowS}>
                  {ROLE_LABEL[c.role] || c.role}{c.phone ? ` · ${c.phone}` : ""}{c.active ? "" : " · inactive"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => run(() => updateCrew(c.id, { active: !c.active }))} disabled={busy} hitSlop={8}>
                <Text style={[f.link, c.active && { color: C.red }]}>{c.active ? "Deactivate" : "Activate"}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Text style={f.formL}>Add a crew member</Text>
          <TextInput
            style={f.input}
            placeholder="Full name"
            placeholderTextColor={C.faint}
            value={crewName}
            onChangeText={setCrewName}
            maxLength={80}
            editable={!busy}
          />
          <TextInput
            style={f.input}
            placeholder="Phone (optional)"
            placeholderTextColor={C.faint}
            value={crewPhone}
            onChangeText={setCrewPhone}
            keyboardType="phone-pad"
            maxLength={20}
            editable={!busy}
          />
          <Segmented options={CREW_ROLES} value={crewRole} onChange={setCrewRole} disabled={busy} />
          <TouchableOpacity style={[f.addBtn, busy && f.btnOff]} onPress={addCrew} disabled={busy}>
            <Text style={f.addBtnT}>Add crew member</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const f = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorT: { ...type.body, fontSize: 13, color: C.body, textAlign: "center", marginBottom: 12 },
  retryBtn: { backgroundColor: C.teal, borderRadius: radius.button, paddingVertical: 11, paddingHorizontal: 26 },
  retryT: { ...type.buttonLabel, fontSize: 13.5, color: "#fff" },
  notice: {
    flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: C.redSoft,
    borderRadius: radius.card, padding: 13, marginBottom: 16,
  },
  noticeT: { flex: 1, ...type.body, fontSize: 12, color: C.ink, lineHeight: 17 },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8, marginLeft: 4 },
  card: { marginBottom: 20 },
  empty: { ...type.body, fontSize: 12.5, color: C.faint, paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  rowT: { ...type.bodySemibold, fontSize: 13.5, color: C.ink },
  rowS: { ...type.body, fontSize: 11.5, color: C.faint, marginTop: 2 },
  off: { color: C.faint },
  link: { ...type.bodySemibold, fontSize: 12.5, color: C.tealDeep },
  formL: { ...type.caption, fontSize: 10.5, color: C.faint, marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 12,
    ...type.body, fontSize: 14, color: C.ink, marginBottom: 8, backgroundColor: "#fff",
  },
  segRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  seg: { flex: 1, alignItems: "center", paddingVertical: 10, borderWidth: 1.5, borderColor: C.line, borderRadius: radius.input },
  segOn: { backgroundColor: C.navy, borderColor: C.navy },
  segT: { ...type.bodySemibold, fontSize: 12.5, color: C.body },
  segTOn: { color: "#fff" },
  addBtn: { backgroundColor: C.teal, borderRadius: radius.button, paddingVertical: 14, alignItems: "center" },
  addBtnT: { ...type.buttonLabel, fontSize: 14, color: "#fff" },
  btnOff: { opacity: 0.5 },
});
