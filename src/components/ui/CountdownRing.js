import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { type } from "../../theme/tokens";

// progress: 0..1 remaining fraction. size/stroke match the design's 210px
// ring; rounded cap on the progress arc.
export default function CountdownRing({ seconds, progress, size = 210, stroke = 14 }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#2ba7a0"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={s.num}>{seconds}</Text>
      <Text style={s.lbl}>seconds to accept</Text>
    </View>
  );
}

const s = StyleSheet.create({
  num: { ...type.bigNumeral, fontSize: 52, color: "#fff" },
  lbl: { ...type.body, fontSize: 12.5, color: "rgba(255,255,255,0.7)", marginTop: 2 },
});
