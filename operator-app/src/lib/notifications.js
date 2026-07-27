import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// Remote push registration via Expo's push service.
//
// Honest limitations (also in HANDOFF.md):
// - Expo Go (SDK 53+) cannot receive remote pushes — this whole flow quietly
//   no-ops there and logs why. A dev/preview EAS build is required.
// - Actual delivery additionally needs delivery credentials uploaded to EAS:
//   Android = FCM V1 service account (Firebase project — human step),
//   iOS = APNs (Apple Developer account — human step).

// Show notifications as banners even while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushAsync() {
  try {
    if (!Device.isDevice) return null; // simulators can't receive push

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Incoming requests",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return data;
  } catch (e) {
    // Expected inside Expo Go (remote push unsupported since SDK 53).
    console.log("Push registration unavailable:", e.message);
    return null;
  }
}
