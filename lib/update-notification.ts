import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const UPDATE_CHANNEL_ID = "myanify-update";
const NOTIFICATION_ID = "myanify-apk-update";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

export async function ensureNotificationChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(UPDATE_CHANNEL_ID, {
    name: "App Updates",
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    vibrationPattern: [],
    enableLights: false,
    enableVibrate: false,
  });
}

function channelTrigger() {
  return Platform.OS === "android" ? { channelId: UPDATE_CHANNEL_ID } : null;
}

export async function requestUpdatePermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function showDownloadProgress(
  version: string,
  percent: number,
  writtenBytes: number,
  totalBytes: number,
) {
  const body =
    totalBytes > 0
      ? `${formatBytes(writtenBytes)} / ${formatBytes(totalBytes)} (${percent}%)`
      : "Preparing download...";

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: `Downloading Myanify ${version}`,
      body,
      data: { type: "apk-update", status: "downloading", percent },
    },
    trigger: channelTrigger(),
  });
}

export async function showDownloadComplete(version: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: `Myanify ${version} ready`,
      body: "Tap to install the update",
      data: { type: "apk-update", status: "complete" },
    },
    trigger: channelTrigger(),
  });
}

export async function showDownloadError(message: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: "Update download failed",
      body: message,
      data: { type: "apk-update", status: "error" },
    },
    trigger: channelTrigger(),
  });
}

export async function dismissUpdateNotification() {
  await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
}
