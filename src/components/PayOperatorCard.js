import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { getBookingPayTo } from "../api/client";

// "Pay the operator" (2026-11-13). The fare is paid straight to the
// ambulance operator — cash to the crew, or DuitNow / bank transfer to the
// operator's own account — never through Lifeline. This card shows the
// amount, who to pay and (when the operator has them on file) their bank
// details and DuitNow QR, then flips to a receipt once the crew records the
// payment. `refreshKey` changes when a tracking event arrives, which is how
// "payment received" reaches this screen live.
export default function PayOperatorCard({ bookingId, refreshKey }) {
  const [info, setInfo] = React.useState(null);
  const [error, setError] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setInfo(await getBookingPayTo(bookingId));
      setError(false);
    } catch {
      setError(true);
    }
  }, [bookingId]);

  React.useEffect(() => { load(); }, [load, refreshKey]);

  if (error && !info) {
    // Never a dead end: the crew can always take the payment in person.
    return (
      <View style={p.card}>
        <Text style={p.sect}>PAYMENT</Text>
        <Text style={p.body}>Couldn't load the payment details. You can always pay the ambulance crew directly.</Text>
        <TouchableOpacity onPress={load} hitSlop={8}><Text style={p.link}>Try again</Text></TouchableOpacity>
      </View>
    );
  }
  if (!info) return <View style={[p.card, { alignItems: "center" }]}><ActivityIndicator color={C.teal} /></View>;
  if (!info.operator) return null; // no operator has accepted yet

  if (info.prepaid) {
    return (
      <View style={[p.card, p.cardDone]}>
        <Ionicons name="checkmark-circle" size={20} color={C.green} />
        <Text style={p.doneT}>Already paid in the app — nothing to pay the crew.</Text>
      </View>
    );
  }

  if (info.collectedVia === "cash" || info.collectedVia === "duitnow") {
    return (
      <View style={[p.card, p.cardDone]}>
        <Ionicons name="checkmark-circle" size={20} color={C.green} />
        <Text style={p.doneT}>
          {info.operator.name} received your payment of RM {Number(info.amount ?? 0).toFixed(2)}
          {info.collectedVia === "cash" ? " in cash" : " by DuitNow / transfer"}. Thank you.
        </Text>
      </View>
    );
  }

  const payTo = info.payTo;
  return (
    <View style={p.card}>
      <Text style={p.sect}>PAY THE OPERATOR</Text>
      <Text style={p.amount}>RM {Number(info.amount ?? 0).toFixed(2)}</Text>
      <Text style={p.body}>
        Pay {info.operator.name} directly when the trip completes — cash to the crew
        {payTo ? ", or DuitNow / bank transfer to the operator's account" : ""}. Nothing is charged
        through the app, and Lifeline adds no fees.
      </Text>

      {payTo && (
        <>
          <TouchableOpacity style={p.toggle} onPress={() => setOpen((v) => !v)}>
            <Ionicons name="qr-code-outline" size={17} color={C.tealDeep} />
            <Text style={p.toggleT}>{open ? "Hide" : "Show"} DuitNow QR & bank details</Text>
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={C.tealDeep} />
          </TouchableOpacity>
          {open && (
            <View style={p.details}>
              {!!payTo.accountName && <View style={p.row}><Text style={p.l}>Account name</Text><Text style={p.v} selectable>{payTo.accountName}</Text></View>}
              {!!payTo.bankName && <View style={p.row}><Text style={p.l}>Bank</Text><Text style={p.v} selectable>{payTo.bankName}</Text></View>}
              {!!payTo.accountNumber && <View style={p.row}><Text style={p.l}>Account number</Text><Text style={p.v} selectable>{payTo.accountNumber}</Text></View>}
              {!!payTo.qrImage && (
                <View style={p.qrWrap}>
                  <Image source={{ uri: payTo.qrImage }} style={p.qr} resizeMode="contain" accessibilityLabel={`${info.operator.name} DuitNow QR`} />
                  <Text style={p.hint}>
                    Works with any bank app or e-wallet (Touch 'n Go, GrabPay, Boost…). Enter RM{" "}
                    {Number(info.amount ?? 0).toFixed(2)}. To pay from this phone, take a screenshot and use
                    "scan from gallery" in your payment app — or scan the QR on the crew's phone.
                  </Text>
                </View>
              )}
              {!!payTo.instructions && <Text style={[p.body, { marginTop: 8 }]}>{payTo.instructions}</Text>}
              <Text style={p.warn}>Check the account name matches {info.operator.name} before you pay.</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const p = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: radius.card, padding: spacing.cardPad, borderWidth: 1, borderColor: C.line, marginBottom: 20 },
  cardDone: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.tealSoft, borderColor: C.tealLine },
  doneT: { flex: 1, ...type.bodySemibold, fontSize: 12.5, color: C.ink, lineHeight: 18 },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 6 },
  amount: { ...type.price, fontSize: 26, color: C.tealDeep, marginBottom: 6 },
  body: { ...type.body, fontSize: 12.5, color: C.body, lineHeight: 18 },
  link: { ...type.bodySemibold, fontSize: 12.5, color: C.tealDeep, marginTop: 8 },
  toggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.tealSoft, borderRadius: radius.input, paddingVertical: 12, marginTop: 12,
  },
  toggleT: { ...type.bodySemibold, fontSize: 13, color: C.tealDeep },
  details: { marginTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  l: { ...type.body, fontSize: 12.5, color: C.faint },
  v: { ...type.bodySemibold, fontSize: 13, color: C.ink, flexShrink: 1, textAlign: "right" },
  qrWrap: { alignItems: "center", marginTop: 10 },
  qr: { width: 220, height: 220, backgroundColor: "#fff" },
  hint: { ...type.body, fontSize: 11.5, color: C.faint, marginTop: 8, textAlign: "center", lineHeight: 16 },
  warn: { ...type.bodySemibold, fontSize: 11.5, color: C.body, marginTop: 10, textAlign: "center" },
});
