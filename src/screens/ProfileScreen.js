import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme/theme";
import { type, spacing, radius } from "../theme/tokens";
import { AuthContext } from "../../App";
import Header from "./_Header";
import Card from "../components/ui/Card";
import BottomTabBar from "../components/ui/BottomTabBar";

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = React.useContext(AuthContext);
  const initial = (user?.name?.[0] || "G").toUpperCase();

  async function doSignOut() {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f8f8" }} edges={["top"]}>
      <Header title="Profile" onBack={() => navigation.goBack()} />
      <View style={{ padding: spacing.screenPad, flex: 1 }}>
        <View style={s.identityRow}>
          <LinearGradient colors={[C.teal, C.tealDeep]} style={s.avatar}>
            <Text style={s.avatarT}>{initial}</Text>
          </LinearGradient>
          <View>
            <Text style={s.name}>{user?.name || "Guest"}</Text>
            <Text style={s.sub}>{user?.isGuest === false ? user?.authProvider : "Guest session"}</Text>
          </View>
        </View>

        <Card noPad style={{ marginTop: 24 }}>
          <TouchableOpacity style={s.row} onPress={doSignOut}>
            <Text style={s.rowT}>Sign Out</Text>
          </TouchableOpacity>
        </Card>
      </View>
      <BottomTabBar navigation={navigation} active="Profile" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarT: { ...type.cardTitle, fontSize: 20, color: "#fff" },
  name: { ...type.cardTitle, fontSize: 17, color: C.ink },
  sub: { ...type.body, fontSize: 12.5, color: C.faint, marginTop: 2, textTransform: "capitalize" },
  row: { padding: spacing.cardPad, alignItems: "center" },
  rowT: { ...type.bodySemibold, fontSize: 14, color: C.red },
});
