import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// SecureStore has no web implementation — on web the auth token lives in
// localStorage (same trust level as the admin dashboard's token storage).
const isWeb = Platform.OS === "web";

export const storage = {
  async getItem(key) {
    if (isWeb) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    if (isWeb) {
      try { window.localStorage.setItem(key, value); } catch {}
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key) {
    if (isWeb) {
      try { window.localStorage.removeItem(key); } catch {}
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};
