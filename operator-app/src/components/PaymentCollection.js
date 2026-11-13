import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Image, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { getPaymentDetails, recordCollection } from "../api/client";

// Collecting the fare (2026-11-13). The patient pays the operator directly —
// cash, or a DuitNow scan / transfer to the operator's own account — and the
// crew records it here. Nothing moves through Lifeline. The QR comes from the
// details Lifeline's back office has on file for this operator; the crew
// holds the phone up and the patient scans it with any bank or e-wallet app.

export const COLLECTION_LABEL = { cash: "Cash received", duitnow: "DuitNow received", unpaid: "Not paid yet" };

const CHOICES = [
  { via: "cash", label: "Cash", icon: "cash-outline" },
  { via: "duitnow", label: "DuitNow", icon: "qr-code-outline" },
  { via: "unpaid", label: "Not paid", icon: "alert-circle-outline" },
];

export const amountToCollect = (booking) => booking.total ?? booking.subtotal ?? 0;

export default function PaymentCollection({ booking, onRecorded }) {
  const [details, setDetails] = React.useState(null);
  const [showQr, setShowQr] = React.useState(false);
  const [saving, setSaving] = React.useState(null);

  React.useEffect(() => {
    let dead = false;
    // Missing details just hide the QR button — cash still works.
    getPaymentDetails().then((d) => !dead && setDetails(d)).catch(() => {});
    return () => { dead = true; };
  }, []);

  if (booking.paidAt) {
    return (
      <View style={s.card}>
        <Text style={s.sect}>PAYMENT</Text>
        <View style={s.statusRow}>
          <Ionicons name="checkmark-circle" size={18} color={C.green} />
          <Text style={s.paidT}>Paid in the app — nothing to collect.</Text>
        </View>
      </View>
    );
  }

  const amount = amountToCollect(booking);
  const via = booking.collectedVia;
  const received = via === "cash" || via === "duitnow";

  async function choose(next) {
    if (next === via || saving) return;
    setSaving(next);
    try {
      const res = await recordCollection(booking.id, next);
      onRecorded({ collectedVia: res.collectedVia, collectedAt: res.collectedAt });
    } catch (e) {
      Alert.alert("Couldn't save the payment", e.message || "Please try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.sect}>COLLECT FROM THE PATIENT</Text>
      <Text style={s.amount}>RM {amount.toFixed(2)}</Text>
      <View style={s.statusRow}>
        <Ionicons
          name={received ? "checkmark-circle" : via === "unpaid" ? "alert-circle" : "ellipse-outline"}
          size={16}
          color={received ? C.green : via === "unpaid" ? C.red : C.faint}
        />
        <Text style={[s.statusT, received && { color: C.green }, via === "unpaid" && { color: C.red }]}>
          {via ? COLLECTION_LABEL[via] : "Not recorded yet"}
        </Text>
      </View>

      {details?.qrImage ? (
        <TouchableOpacity style={s.qrBtn} onPress={() => setShowQr(true)}>
          <Ionicons name="qr-code" size={17} color={C.tealDeep} />
          <Text style={s.qrBtnT}>Show DuitNow QR to the patient</Text>
        </TouchableOpacity>
      ) : details ? (
        <Text style={s.hint}>
          No DuitNow QR on file — collect cash, or ask Lifeline to add your QR (Profile → Payment details).
        </Text>
      ) : null}

      <Text style={s.pickL}>How did the patient pay?</Text>
      <View style={s.choiceRow}>
        {CHOICES.map((c) => {
          const on = via === c.via;
          const danger = c.via === "unpaid";
          return (
            <TouchableOpacity
              key={c.via}
              style={[s.choice, on && (danger ? s.choiceOnRed : s.choiceOn)]}
              onPress={() => choose(c.via)}
              disabled={!!saving}
            >
              {saving === c.via ? (
                <ActivityIndicator size="small" color={on ? "#fff" : C.teal} />
              ) : (
                <Ionicons name={c.icon} size={17} color={on ? "#fff" : danger ? C.red : C.tealDeep} />
              )}
              <Text style={[s.choiceT, on && { color: "#fff" }]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={showQr} animationType="slide" onRequestClose={() => setShowQr(false)}>
        <View style={s.qrScreen}>
          <Text style={s.qrTitle}>Scan to pay</Text>
          <Text style={s.qrAmount}>RM {amount.toFixed(2)}</Text>
          {!!details?.qrImage && (
            <Image source={{ uri: details.qrImage }} style={s.qrImg} resizeMode="contain" accessibilityLabel="DuitNow QR" />
          )}
          {!!details?.accountName && <Text style={s.qrName}>{details.accountName}</Text>}
          <Text style={s.qrHint}>
            Any bank app or e-wallet (Touch 'n Go, GrabPay, Boost…). The patient enters RM {amount.toFixed(2)}.
          </Text>
          <TouchableOpacity style={s.qrClose} onPress={() => setShowQr(false)}>
            <Text style={s.qrCloseT}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: radius.card, padding: spacing.cardPad, marginBottom: spacing.cardGap, borderWidth: 1, borderColor: C.line },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 6 },
  amount: { ...type.screenTitle, fontSize: 30, color: C.navy },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  statusT: { ...type.bodySemibold, fontSize: 12.5, color: C.faint },
  paidT: { ...type.bodySemibold, fontSize: 13, color: C.ink, flex: 1 },
  qrBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.tealSoft, borderRadius: radius.input, paddingVertical: 13, marginTop: 14,
  },
  qrBtnT: { ...type.bodySemibold, fontSize: 13.5, color: C.tealDeep },
  hint: { ...type.body, fontSize: 11.5, color: C.faint, marginTop: 12, lineHeight: 16 },
  pickL: { ...type.caption, fontSize: 10.5, color: C.faint, marginTop: 16, marginBottom: 8 },
  choiceRow: { flexDirection: "row", gap: 8 },
  choice: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 4, minHeight: 58,
    borderWidth: 1.5, borderColor: C.line, borderRadius: radius.input, paddingVertical: 10,
  },
  choiceOn: { backgroundColor: C.teal, borderColor: C.teal },
  choiceOnRed: { backgroundColor: C.red, borderColor: C.red },
  choiceT: { ...type.bodySemibold, fontSize: 12, color: C.ink },
  qrScreen: { flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 24 },
  qrTitle: { ...type.caption, fontSize: 13, color: C.faint },
  qrAmount: { ...type.screenTitle, fontSize: 40, color: C.navy, marginTop: 4, marginBottom: 18 },
  qrImg: { width: 300, height: 300, maxWidth: "100%", backgroundColor: "#fff" },
  qrName: { ...type.cardTitle, fontSize: 15, color: C.ink, marginTop: 16, textAlign: "center" },
  qrHint: { ...type.body, fontSize: 12.5, color: C.body, marginTop: 8, textAlign: "center", lineHeight: 18 },
  qrClose: { marginTop: 26, backgroundColor: C.navy, borderRadius: radius.button, paddingVertical: 15, paddingHorizontal: 54 },
  qrCloseT: { ...type.buttonLabel, fontSize: 15, color: "#fff" },
});
