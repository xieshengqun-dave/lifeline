import React from "react";
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../theme/theme";
import { gradients, type, radius, shadows } from "../../theme/tokens";

export default function GradientButton({ label, onPress, loading, disabled, icon = "arrow-forward", showIcon = true, colors = gradients.primary, style }) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={isDisabled} style={[s.wrap, isDisabled && s.disabledShadow, style]}>
      <LinearGradient colors={isDisabled ? [C.line, C.line] : colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.grad}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={[s.label, isDisabled && { color: C.faint }]}>{label}</Text>
            {showIcon && <Ionicons name={icon} size={19} color={isDisabled ? C.faint : "#fff"} style={s.icon} />}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: radius.button, ...shadows.primaryButton },
  disabledShadow: { shadowOpacity: 0, elevation: 0 },
  grad: { height: 58, borderRadius: radius.button, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  label: { ...type.buttonLabel, color: "#fff" },
  icon: { marginLeft: 8 },
});
