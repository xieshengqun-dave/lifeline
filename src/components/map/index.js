// Native entry for the platform-split map module. Screens import from
// "components/map" and Metro picks index.js (native) or index.web.js (web).
// Web can't even *bundle* react-native-maps, hence the split.
import React from "react";
import { Platform, View, Text, StyleSheet } from "react-native";
import Constants from "expo-constants";
import RNMapView, { PROVIDER_GOOGLE } from "react-native-maps";

export { Marker, Polyline } from "react-native-maps";

// Google provider is Android-only inside Expo Go; iOS falls back to Apple
// Maps there. (Web ignores this entirely — its module exports undefined.)
export const MAP_PROVIDER = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

// A standalone Android build (APK) hard-crashes natively if the MapView
// mounts without android.config.googleMaps.apiKey in app.json — Expo Go is
// immune because it ships Google's SDK with Expo's own key. Until the key
// exists (human step — see CREDENTIALS.md), standalone Android renders the
// same graceful placeholder the keyless web build uses.
const isExpoGo = Constants.executionEnvironment === "storeClient";
const hasAndroidKey =
  !!Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
  !!Constants.expoConfig?.extra?.androidMapsKeyPresent; // build-time flag from app.config.js
const MAP_SUPPORTED = Platform.OS !== "android" || isExpoGo || hasAndroidKey;

const MapPlaceholder = React.forwardRef(function MapPlaceholder({ style }, ref) {
  React.useImperativeHandle(ref, () => ({
    animateToRegion() {},
    fitToCoordinates() {},
  }));
  return (
    <View style={[style, p.box]}>
      <Text style={p.text}>Map unavailable in this build — everything below works normally</Text>
    </View>
  );
});

const MapView = React.forwardRef(function MapView(props, ref) {
  if (!MAP_SUPPORTED) {
    return <MapPlaceholder style={props.style} ref={ref} />;
  }
  return <RNMapView {...props} ref={ref} />;
});

export default MapView;

const p = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", backgroundColor: "#e8eef0" },
  text: { fontSize: 13, color: "#5b6b73", textAlign: "center", padding: 24 },
});
