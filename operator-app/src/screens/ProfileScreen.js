import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { gradients, type, spacing, radius } from "../theme/tokens";
import { AuthContext } from "../../App";
import Header from "./_Header";
import Card from "../components/ui/Card";
import BottomTabBar from "../components/ui/BottomTabBar";

// Minimal by design (mirrors the patient app's Profile): real session info +
// sign out. Rate-card / fleet editing stays an admin operation for now.
export default function ProfileScreen({ navigation }) {
  const { operator, signOut } = React.useContext(AuthContext);

  function confirmSignOut() {
    Alert.alert("Sign out?", "You'll stop receiving requests until you sign back in.", [
      { text: "Cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <Header title="Profile" onBack={() => navigation.goBack()} />
      <View style={{ flex: 1, padding: spacing.screenPad }}>
        <Card style={p.card}>
          <LinearGradient colors={gradients.primary} style={p.avatar}>
            <Text style={p.avatarT}>
              {(operator?.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </Text>
          </LinearGradient>
          <Text style={p.name}>{operator?.name || "Operator"}</Text>
          {!!operator?.email && <Text style={p.sub}>{operator.email}</Text>}
        </Card>

        <TouchableOpacity style={p.signOutBtn} onPress={confirmSignOut}>
          <Ionicons name="log-out-outline" size={18} color={C.red} />
          <Text style={p.signOutT}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <BottomTabBar navigation={navigation} active="Profile" />
    </SafeAreaView>
  );
}

const p = StyleSheet.create({
  card: { alignItems: "center", paddingVertical: 26, marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarT: { ...type.cardTitle, fontSize: 20, color: "#fff" },
  name: { ...type.cardTitle, fontSize: 17, color: C.ink },
  sub: { ...type.body, fontSize: 12.5, color: C.faint, marginTop: 3 },
  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: C.redSoft,
    borderRadius: radius.button, paddingVertical: 14,
  },
  signOutT: { ...type.buttonLabel, fontSize: 14, color: C.red },
});
