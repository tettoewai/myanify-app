import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiClient } from "@/lib/api";
import { ensureNotificationChannel } from "@/lib/update-notification";
import * as Application from "expo-application";
import { isAllowedApkUrl, verifyManifest } from "@/lib/update-verify";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKGROUND_UPDATE_TASK = "background-update-check";

interface MobileReleaseManifest {
  version?: string;
  versionCode?: number;
  apkUrl?: string;
  notes?: string;
  mandatory?: boolean;
  sha256?: string;
  md5?: string;
  fileSize?: number;
  minVersionCode?: number;
  rollout?: number;
  certSha256?: string;
  previousVersion?: string;
  previousVersionCode?: number;
  previousApkUrl?: string;
  signature?: string;
}

const LAST_NOTIFIED_VERSION_KEY = "@myanify:last-notified-version";

async function getLastNotifiedVersion(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(LAST_NOTIFIED_VERSION_KEY);
    return value ? parseInt(value, 10) : 0;
  } catch {
    return 0;
  }
}

async function setLastNotifiedVersion(versionCode: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_NOTIFIED_VERSION_KEY, versionCode.toString());
  } catch {
    // Non-critical
  }
}

async function checkForUpdateInBackground(): Promise<BackgroundFetch.BackgroundFetchResult> {
  if (Platform.OS !== "android") {
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }

  try {
    const manifest = (await apiClient.get("/mobile-update")) as MobileReleaseManifest;

    if (!manifest.versionCode || !manifest.apkUrl) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    if (!isAllowedApkUrl(manifest.apkUrl)) {
      console.warn("[background-update] rejected manifest: apkUrl not allowlisted");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    if (!verifyManifest(manifest)) {
      console.warn("[background-update] rejected manifest: bad/missing signature");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const currentVersionCode = parseInt(Application.nativeBuildVersion ?? "0", 10);
    const latestVersionCode = manifest.versionCode;

    if (latestVersionCode <= currentVersionCode) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const mandatory =
      !!manifest.mandatory ||
      (typeof manifest.minVersionCode === "number" &&
        manifest.minVersionCode > currentVersionCode &&
        latestVersionCode > currentVersionCode);

    const lastNotified = await getLastNotifiedVersion();
    if (lastNotified >= latestVersionCode && !mandatory) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    await ensureNotificationChannel();

    const hasPermission = await Notifications.getPermissionsAsync();
    if (hasPermission.status !== "granted") {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const updateTitle = mandatory ? "Required update available" : "Update available";
    const updateBody = mandatory
      ? `Myanify ${manifest.version} is required to continue using the app.`
      : `Myanify ${manifest.version} is now available. Tap to update.`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: updateTitle,
        body: updateBody,
        data: {
          type: "apk-update",
          status: "available",
          version: manifest.version,
          versionCode: manifest.versionCode,
          mandatory,
          apkUrl: manifest.apkUrl,
        },
        ...(Platform.OS === "android" ? { channelId: "myanify-update" } : {}),
      },
      trigger: null,
    });

    await setLastNotifiedVersion(latestVersionCode);

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.warn("[background-update] check failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
}

TaskManager.defineTask(BACKGROUND_UPDATE_TASK, async () => {
  return await checkForUpdateInBackground();
});

export async function registerBackgroundUpdateCheck(): Promise<void> {
  if (Platform.OS !== "android") return;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_UPDATE_TASK);
    if (isRegistered) return;

    await BackgroundFetch.registerTaskAsync(BACKGROUND_UPDATE_TASK, {
      minimumInterval: 60 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log("[background-update] Background fetch task registered");
  } catch (error) {
    console.warn("[background-update] Failed to register task:", error);
  }
}

export async function unregisterBackgroundUpdateCheck(): Promise<void> {
  if (Platform.OS !== "android") return;

  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_UPDATE_TASK);
    console.log("[background-update] Background fetch task unregistered");
  } catch (error) {
    console.warn("[background-update] Failed to unregister task:", error);
  }
}

export async function checkUpdateNow(): Promise<void> {
  await checkForUpdateInBackground();
}

export { BACKGROUND_UPDATE_TASK };