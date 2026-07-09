import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing, radius, colors } from "../theme/tokens";
import { AuthContext } from "../../App";
import Card from "../components/ui/Card";
import BottomTabBar from "../components/ui/BottomTabBar";

// Post-login landing — per design_handoff_lifeline/PATIENT-APP-SPEC.md's
// "0 · Home (post-login landing) — 2a" section, which explicitly replaces
// an earlier draft built before that spec existed.
export default function WelcomeScreen({ navigation }) {
  const { user, signOut } = React.useContext(AuthContext);
  const greeting = user?.name ? `Hello, ${user.name}` : "Hello there";
  const initial = (user?.name?.[0] || "G").toUpperCase();

  function handleNotifications() {
    Alert.alert("Notifications", "Notifications aren't available yet.");
  }

  function handleAvatarPress() {
    Alert.alert("Account", undefined, [
      { text: "Sign Out", style: "destructive", onPress: doSignOut },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function doSignOut() {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Image source={require("../../assets/brand/lifeline-lockup.png")} style={s.logo} resizeMode="contain" />
        <View style={{ flexDirection: "row", gap: 10, marginLeft: "auto" }}>
          <TouchableOpacity style={s.iconTile} onPress={handleNotifications} hitSlop={4}>
            <Ionicons name="notifications-outline" size={19} color={C.ink} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAvatarPress} hitSlop={4}>
            <LinearGradient colors={[C.teal, C.tealDeep]} style={s.avatarTile}>
              <Text style={s.avatarT}>{initial}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.screenPad, paddingBottom: 24 }}>
        <Text style={s.hello}>{greeting}</Text>
        <Text style={s.h1}>How can we{"\n"}help you today?</Text>

        <LinearGradient colors={[colors.tealBright, C.teal, C.tealDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <Text style={s.heroTitle}>Request Ambulance</Text>
          <Text style={s.heroSub}>Emergency or immediate medical transport</Text>
          <TouchableOpacity style={s.heroBtn} activeOpacity={0.85} onPress={() => navigation.navigate("Location")}>
            <Text style={s.heroBtnT}>Start request</Text>
            <Ionicons name="arrow-forward" size={15} color={C.tealDeep} />
          </TouchableOpacity>
          <View style={s.heroIconTile}>
            <MaterialCommunityIcons name="ambulance" size={26} color="#fff" />
          </View>
        </LinearGradient>

        <View style={s.twoCard}>
          <Card style={s.mini}>
            <View style={s.miniIconTile}>
              <Ionicons name="calendar-outline" size={18} color={C.tealDeep} />
            </View>
            <Text style={s.miniT}>Schedule Transport</Text>
            <Text style={s.miniS}>Book for a later time</Text>
          </Card>
          <Card style={s.mini}>
            <View style={s.miniIconTile}>
              <Ionicons name="person-add-outline" size={18} color={C.tealDeep} />
            </View>
            <Text style={s.miniT}>Patient Transfer</Text>
            <Text style={s.miniS}>Non-emergency medical transfer</Text>
          </Card>
        </View>

        <Text style={s.sect}>LIVE OVERVIEW</Text>
        <View style={s.stats}>
          {[["8 mins", "Avg. response time"], ["42", "Active ambulances"], ["120+", "Hospitals connected"]].map(([n, l]) => (
            <Card key={l} style={s.stat}>
              <Text style={s.statN}>{n}</Text>
              <Text style={s.statL}>{l}</Text>
            </Card>
          ))}
        </View>

        <View style={s.emerg}>
          <Ionicons name="call" size={16} color={C.red} />
          <Text style={s.emergT}>Emergency? Call 999</Text>
        </View>
      </ScrollView>

      <BottomTabBar navigation={navigation} active="Welcome" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f8f8" },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.screenPad, paddingBottom: 8 },
  logo: { width: 110, height: 28 },
  iconTile: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  avatarTile: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarT: { ...type.cardTitle, fontSize: 15, color: "#fff" },
  hello: { ...type.bodySemibold, color: C.body },
  h1: { ...type.screenTitle, fontSize: 26, color: C.ink, marginTop: 4, marginBottom: 18 },
  hero: { borderRadius: radius.card, padding: 20, marginBottom: spacing.cardGap, overflow: "hidden" },
  heroTitle: { ...type.cardTitle, fontSize: 18, color: "#fff", width: "62%" },
  heroSub: { ...type.body, fontSize: 12, color: "rgba(255,255,255,0.82)", marginTop: 6, marginBottom: 16, width: "62%" },
  heroBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  heroBtnT: { ...type.buttonLabel, fontSize: 13.5, color: C.tealDeep },
  heroIconTile: {
    position: "absolute", right: 18, top: 18, width: 44, height: 44, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center",
  },
  twoCard: { flexDirection: "row", gap: spacing.cardGap, marginBottom: 20 },
  mini: { flex: 1 },
  miniIconTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.tealSoft, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  miniT: { ...type.cardTitle, fontSize: 13.5, color: C.ink },
  miniS: { ...type.body, fontSize: 11, color: C.faint, marginTop: 3 },
  sect: { ...type.overline, fontSize: 12, color: C.tealDeep, marginBottom: 12 },
  stats: { flexDirection: "row", gap: 10, marginBottom: 18 },
  stat: { flex: 1, alignItems: "center" },
  statN: { ...type.statNumber, fontSize: 18, color: C.teal },
  statL: { ...type.body, fontSize: 10, color: C.faint, marginTop: 3, textAlign: "center" },
  emerg: { flexDirection: "row", gap: 8, backgroundColor: C.redSoft, borderRadius: radius.card, padding: 13, alignItems: "center", justifyContent: "center" },
  emergT: { ...type.bodySemibold, fontSize: 14, color: C.red },
});
