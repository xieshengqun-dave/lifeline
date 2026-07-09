import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme/theme";
import { type, spacing } from "../theme/tokens";
import { BookingContext } from "../../App";
import { submitRating, ApiError } from "../api/client";
import GradientButton from "../components/ui/GradientButton";

// Never blocks the user — this is emergency software, and a rating is the
// least important thing happening on this screen. Skip, submit, or an
// already_rated 409 (e.g. a retry after a flaky connection) all land in the
// same place: home, draft reset.
export default function RatingScreen({ navigation }) {
  const { booking, resetDraft } = React.useContext(BookingContext);
  const operatorName = booking.selectedOperator?.name || "your operator";
  const [stars, setStars] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  function done() {
    resetDraft();
    navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
  }

  async function submit() {
    setSubmitting(true);
    try {
      await submitRating(booking.bookingId, { stars, comment: comment.trim() || undefined });
      done();
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_rated") {
        done();
        return;
      }
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={s.body}>
          <Text style={s.title}>How was your trip?</Text>
          <Text style={s.sub}>Rate {operatorName} — this helps other patients choose.</Text>

          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setStars(n)} hitSlop={8}>
                <Ionicons name={n <= stars ? "star" : "star-outline"} size={40} color={n <= stars ? colors_amber : C.line} style={{ marginHorizontal: 4 }} />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={s.input}
            placeholder="Add a comment (optional)"
            placeholderTextColor={C.faint}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={500}
          />

          <GradientButton
            label="Submit rating"
            onPress={submit}
            loading={submitting}
            disabled={stars === 0}
            showIcon={false}
            style={{ marginTop: 20 }}
          />
          <TouchableOpacity onPress={done} disabled={submitting} style={s.skipBtn}>
            <Text style={s.skipT}>Skip</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const colors_amber = "#e8a13a";

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  body: { flex: 1, padding: spacing.screenPad, justifyContent: "center" },
  title: { ...type.screenTitle, color: C.ink, fontSize: 24, textAlign: "center", marginBottom: 8 },
  sub: { ...type.body, color: C.faint, textAlign: "center", marginBottom: 32 },
  starsRow: { flexDirection: "row", justifyContent: "center", marginBottom: 28 },
  input: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: 15, padding: 14, fontSize: 14.5, color: C.ink,
    minHeight: 90, textAlignVertical: "top", backgroundColor: C.bg,
  },
  skipBtn: { alignItems: "center", marginTop: 16, padding: 8 },
  skipT: { ...type.bodySemibold, color: C.faint },
});
