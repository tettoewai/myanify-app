import { apiClient } from "@/lib/api";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

const CONTENT_CHANNEL_ID = "myanify-content";
const RETRY_INTERVAL = 30_000;
const MAX_ATTEMPTS = 10;

async function ensureContentChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CONTENT_CHANNEL_ID, {
    name: "Content Updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
    vibrationPattern: [0, 250],
    enableLights: true,
  });
}

async function registerToken(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  await apiClient.post("/push-tokens", {
    token,
    platform: Platform.OS.toUpperCase(),
    deviceName: Platform.OS === "android" ? "Android" : "iOS",
  });

  return token;
}

/**
 * Deactivate the user's push tokens on the server.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    await apiClient.delete("/push-tokens");
  } catch {
    // Best-effort.
  }
}

/**
 * Registers the Expo push token with the server and sets up
 * foreground notification handling. Retries on transient FCM errors.
 */
export function usePushNotifications(isAuthenticated: boolean) {
  const attempts = useRef(0);

  useEffect(() => {
    void ensureContentChannel();
    attempts.current = 0;

    if (!isAuthenticated) return;

    const tryRegister = async () => {
      try {
        await registerToken();
        attempts.current = MAX_ATTEMPTS;
      } catch (err) {
        attempts.current++;
        console.warn(
          "[usePushNotifications] Attempt",
          attempts.current,
          "failed:",
          err instanceof Error ? err.message : err,
        );
      }
    };

    void tryRegister();

    const interval = setInterval(() => {
      if (attempts.current >= MAX_ATTEMPTS) {
        clearInterval(interval);
        return;
      }
      void tryRegister();
    }, RETRY_INTERVAL);

    const sub = Notifications.addNotificationReceivedListener(() => {});

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isAuthenticated]);
}
