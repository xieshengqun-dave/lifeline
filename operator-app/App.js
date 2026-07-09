import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold } from "@expo-google-fonts/poppins";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { operatorLogin, getOperatorRequests, setAuthToken, setUnauthorizedHandler } from "./src/api/client";
import { subscribeToOperatorEvents, disconnectSocket } from "./src/api/socket";
import { C } from "./src/theme/theme";

import OperatorLoginScreen from "./src/screens/OperatorLoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import IncomingRequestsScreen from "./src/screens/IncomingRequestsScreen";
import ActiveTripScreen from "./src/screens/ActiveTripScreen";
import TripHistoryScreen from "./src/screens/TripHistoryScreen";

const Stack = createNativeStackNavigator();
const TOKEN_KEY = "lifeline_operator_token";
const USER_KEY = "lifeline_operator_user";

export const navigationRef = createNavigationContainerRef();

export const AuthContext = React.createContext(null);
export const OperatorContext = React.createContext(null);

SplashScreen.preventAutoHideAsync().catch(() => {});

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

  const [authLoading, setAuthLoading] = React.useState(true);
  const [token, setToken] = React.useState(null);
  const [operator, setOperator] = React.useState(null);

  const [pendingOffers, setPendingOffers] = React.useState([]);
  const [online, setOnline] = React.useState(false);

  const addOffer = React.useCallback((offer) => {
    setPendingOffers((prev) => (prev.some((o) => o.offerId === offer.offerId) ? prev : [...prev, offer]));
  }, []);
  const removeOffer = React.useCallback((offerId) => {
    setPendingOffers((prev) => prev.filter((o) => o.offerId !== offerId));
  }, []);

  const signOut = React.useCallback(async () => {
    setToken(null);
    setOperator(null);
    setAuthToken(null);
    setPendingOffers([]);
    disconnectSocket();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  }, []);

  const signIn = React.useCallback(async (email, password) => {
    const res = await operatorLogin(email, password);
    setAuthToken(res.token);
    setToken(res.token);
    setOperator(res.operator);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(res.operator));
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
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (storedToken) {
        setAuthToken(storedToken);
        setToken(storedToken);
        const storedUser = await SecureStore.getItemAsync(USER_KEY);
        if (storedUser) setOperator(JSON.parse(storedUser));
      }
      setAuthLoading(false);
    })();
  }, []);

  // Populate + keep pendingOffers in sync once authed. A missed offer:created
  // during a disconnect has no guaranteed follow-up event (unlike the patient
  // side), so resync on every (re)connect, not just once at boot.
  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const resync = async () => {
      try {
        const offers = await getOperatorRequests();
        if (!cancelled) setPendingOffers(offers);
      } catch {}
    };
    resync();

    const unsubscribe = subscribeToOperatorEvents({
      onOfferCreated: (payload) => {
        setPendingOffers((prev) => {
          const wasEmpty = prev.length === 0;
          const next = prev.some((o) => o.offerId === payload.offerId) ? prev : [...prev, payload];
          if (wasEmpty && next.length > 0 && navigationRef.isReady()) {
            navigationRef.navigate("IncomingRequests");
          }
          return next;
        });
      },
      onConnect: resync,
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
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
        <Text style={boot.sub}>Operator</Text>
        <ActivityIndicator color={C.teal} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ authLoading, token, operator, signIn, signOut }}>
      <OperatorContext.Provider value={{ pendingOffers, addOffer, removeOffer, online, setOnline }}>
        <StatusBar style="dark" />
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName={token ? "Home" : "Login"}
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Login" component={OperatorLoginScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="IncomingRequests" component={IncomingRequestsScreen} />
            <Stack.Screen name="ActiveTrip" component={ActiveTripScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="TripHistory" component={TripHistoryScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </OperatorContext.Provider>
    </AuthContext.Provider>
  );
}

const boot = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  wordmark: { fontSize: 26, fontWeight: "800" },
  sub: { fontSize: 12, color: "#8C94A6", marginTop: 2, letterSpacing: 1, textTransform: "uppercase" },
});
