import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing } from "../theme/tokens";
import { BookingContext } from "../../App";
import Header from "./_Header";
import Card from "../components/ui/Card";
import GradientButton from "../components/ui/GradientButton";

// Repurposed as a post-acceptance receipt/confirmation screen — payment
// integration is not implemented (see backend/README.md's "Known
// limitations": no provider is wired, chargeBooking() throws). The booking
// itself, including the chosen payment method, was already created back on
// the Review screen (POST /bookings requires paymentMethod up front). This
// screen makes no backend call — it's cosmetic, and says so, per CLAUDE.md's
// "flag, don't stub silently" rule.
export default function PaymentScreen({ navigation }) {
  const { booking } = React.useContext(BookingContext);
  const op = booking.selectedOperator;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <Header title="Confirm & Pay" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPad }}>
        <View style={pm.confirmedBadge}>
          <Ionicons name="checkmark-circle" size={20} color={C.green} />
          <Text style={pm.confirmedBadgeT}>Unit accepted — confirm to dispatch</Text>
        </View>

        <Card style={{ marginBottom: spacing.cardGap }}>
          <Text style={pm.sect}>AMBULANCE</Text>
          <Text style={pm.tv}>{op?.name}</Text>

          <Text style={[pm.sect, { marginTop: 14 }]}>PAYMENT METHOD</Text>
          <Text style={pm.tv}>{booking.payMethod}</Text>
        </Card>

        <Card>
          <Text style={pm.sect}>AMOUNT</Text>
          <View style={pm.row}><Text style={pm.l}>Subtotal</Text><Text style={pm.r}>RM {op?.price.subtotal.toFixed(2)}</Text></View>
          <View style={pm.row}><Text style={pm.l}>Service Fee</Text><Text style={pm.r}>RM {op?.price.serviceFee.toFixed(2)}</Text></View>
          <View style={pm.totalRow}>
            <Text style={pm.totalK}>Total</Text>
            <Text style={pm.totalV}>RM {op?.price.total.toFixed(2)}</Text>
          </View>
        </Card>

        <Text style={pm.disclaimer}>
          Payment integration is not yet live — this is a demo confirmation. No charge has been made.
        </Text>
      </ScrollView>
      <View style={pm.bar}>
        <GradientButton label="Continue to Tracking" onPress={() => navigation.replace("Tracking")} />
      </View>
    </SafeAreaView>
  );
}
const pm = StyleSheet.create({
  confirmedBadge: { flexDirection: "row", gap: 8, backgroundColor: C.tealSoft, borderRadius: 12, padding: 14, alignItems: "center", justifyContent: "center", marginBottom: spacing.cardGap },
  confirmedBadgeT: { ...type.bodySemibold, color: C.tealDeep, fontSize: 13.5 },
  sect: { ...type.caption, fontSize: 11, color: C.faint, marginBottom: 8 },
  tv: { ...type.bodySemibold, fontSize: 13.5, color: C.ink },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  l: { ...type.body, fontSize: 12.5, color: C.faint }, r: { ...type.bodySemibold, fontSize: 12.5, color: C.ink },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.line, marginTop: 8, paddingTop: 10 },
  totalK: { ...type.cardTitle, fontSize: 14, color: C.ink }, totalV: { ...type.price, fontSize: 18, color: C.tealDeep },
  disclaimer: { ...type.body, fontSize: 11, color: C.faint, textAlign: "center", marginTop: 24, lineHeight: 16 },
  bar: { padding: spacing.screenPad, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: "#fff" },
});
