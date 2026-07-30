import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { storage } from "./src/lib/storage";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold } from "@expo-google-fonts/poppins";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { authGuest, setAuthToken, setUnauthorizedHandler, savePushToken } from "./src/api/client";
import { registerForPushAsync } from "./src/lib/notifications";
import { disconnectSocket } from "./src/api/socket";
import { C } from "./src/theme/theme";

import LoginScreen from "./src/screens/LoginScreen";
import WelcomeScreen from "./src/screens/WelcomeScreen";
import LocationScreen from "./src/screens/LocationScreen";
import AddressPickerScreen from "./src/screens/AddressPickerScreen";
import HospitalPickerScreen from "./src/screens/HospitalPickerScreen";
import AssessScreen from "./src/screens/AssessScreen";
import AmbulancesScreen from "./src/screens/AmbulancesScreen";
import ReviewScreen from "./src/screens/ReviewScreen";
import WaitingScreen from "./src/screens/WaitingScreen";
import PaymentScreen from "./src/screens/PaymentScreen";
import TrackingScreen from "./src/screens/TrackingScreen";
import RatingScreen from "./src/screens/RatingScreen";
import TripsScreen from "./src/screens/TripsScreen";
import ScheduleScreen from "./src/screens/ScheduleScreen";
import ActivityScreen from "./src/screens/ActivityScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();
const TOKEN_KEY = "lifeline_auth_token";
const USER_KEY = "lifeline_auth_user";

export const navigationRef = createNavigationContainerRef();

// Shared booking-draft state lives here and is passed down. For a bigger
// app, swap this for a store like Zustand.
export const BookingContext = React.createContext(null);
export const AuthContext = React.createContext(null);

const initialBooking = {
  bookingType: "emergency", // emergency | transfer — set by the Home entry point
  scheduledAt: null, // ISO string — set by ScheduleScreen; null = book now
  from: null, to: null, distanceKm: 0,
  age: "45", gender: "Male", cond: "Fully Conscious",
  oxy: "Yes", flow: "<5L", iv: "No", medication: "",
  diagnosisType: "RTA", diagnosisOther: "", specialRequest: "",
  payMethod: "Credit / Debit Card",
  selectedOperator: null, // normalizeOperator() shape — see src/api/mappers.js
  bookingId: null,
  bookingStatus: null,
  currentOfferExpiresAt: null,
  currentOfferOfferedAt: null,
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [booking, setBooking] = React.useState(initialBooking);
  const update = (patch) => setBooking((b) => ({ ...b, ...patch }));
  const resetDraft = () => setBooking(initialBooking);

  const [authLoading, setAuthLoading] = React.useState(true);
  const [token, setToken] = React.useState(null);
  const [user, setUser] = React.useState(null);

  const signOut = React.useCallback(async () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    disconnectSocket();
    resetDraft();
    await storage.deleteItem(TOKEN_KEY);
    await storage.deleteItem(USER_KEY);
  }, []);

  const signInGuest = React.useCallback(async () => {
    const res = await authGuest();
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
    await storage.setItem(TOKEN_KEY, res.token);
    await storage.setItem(USER_KEY, JSON.stringify(res.user));
  }, []);

  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: "Login" }] });
      }
    });
  }, [signOut]);

  React.useEffect(() => {
    (async () => {
      const storedToken = await storage.getItem(TOKEN_KEY);
      if (storedToken) {
        setAuthToken(storedToken);
        setToken(storedToken);
        const storedUser = await storage.getItem(USER_KEY);
        if (storedUser) setUser(JSON.parse(storedUser));
      }
      setAuthLoading(false);
    })();
  }, []);

  // Register for remote push once signed in (no-ops in Expo Go / on denial).
  // Failures never block the app — push is additive, not load-bearing.
  React.useEffect(() => {
    if (!token) return;
    (async () => {
      const pushToken = await registerForPushAsync();
      if (pushToken) await savePushToken(pushToken).catch(() => {});
    })();
  }, [token]);

  const ready = !authLoading && fontsLoaded;

  React.useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    return (
      <View style={boot.container}>
        <Text style={boot.wordmark}>
          <Text style={{ color: C.navy }}>Life</Text>
          <Text style={{ color: C.teal }}>line</Text>
        </Text>
        <ActivityIndicator color={C.teal} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ authLoading, token, user, signInGuest, signOut }}>
      <BookingContext.Provider value={{ booking, update, resetDraft }}>
        <StatusBar style="dark" />
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName={token ? "Welcome" : "Login"}
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Schedule" component={ScheduleScreen} />
            <Stack.Screen name="Location" component={LocationScreen} />
            <Stack.Screen name="AddressPicker" component={AddressPickerScreen} />
            <Stack.Screen name="HospitalPicker" component={HospitalPickerScreen} />
            <Stack.Screen name="Assess" component={AssessScreen} />
            <Stack.Screen name="Ambulances" component={AmbulancesScreen} />
            <Stack.Screen name="Review" component={ReviewScreen} />
            <Stack.Screen name="Waiting" component={WaitingScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="Payment" component={PaymentScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="Tracking" component={TrackingScreen} />
            <Stack.Screen name="Rating" component={RatingScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="Trips" component={TripsScreen} />
            <Stack.Screen name="Activity" component={ActivityScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </BookingContext.Provider>
    </AuthContext.Provider>
  );
}

const boot = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  wordmark: { fontSize: 26, fontWeight: "800" },
});
