import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Application from "expo-application";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { apiClient } from "@/lib/api";

export interface ApkUpdateInfo {
  version: string;
  versionCode: number;
  apkUrl: string;
  notes: string;
  mandatory: boolean;
  available: boolean;
}

interface MobileReleaseManifest {
  version?: string;
  versionCode?: number;
  apkUrl?: string;
  notes?: string;
  mandatory?: boolean;
}

const EMPTY_UPDATE: ApkUpdateInfo = {
  version: "",
  versionCode: 0,
  apkUrl: "",
  notes: "",
  mandatory: false,
  available: false,
};

/**
 * Detects and installs newer side-loadable Android APKs from the backend
 * manifest (GET /api/mobile-update). JS-only updates are handled separately
 * by expo-updates (useUpdateCheck); this covers native/binary updates that
 * OTA cannot deliver. iOS is out of scope (no self-install without App Store).
 */
export function useApkUpdate() {
  const [apkUpdate, setApkUpdate] = useState<ApkUpdateInfo>(EMPTY_UPDATE);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (Platform.OS !== "android") return;
    setIsChecking(true);
    try {
      const manifest = (await apiClient.get(
        "/mobile-update",
      )) as MobileReleaseManifest;

      if (!manifest.versionCode || !manifest.apkUrl) {
        setApkUpdate(EMPTY_UPDATE);
        return;
      }

      const current = parseInt(Application.nativeBuildVersion ?? "0", 10);
      const latest = manifest.versionCode;

      setApkUpdate({
        version: manifest.version ?? "",
        versionCode: latest,
        apkUrl: manifest.apkUrl,
        notes: manifest.notes ?? "",
        mandatory: !!manifest.mandatory,
        available: latest > current,
      });
    } catch {
      // Network/endpoint unavailable — skip silently.
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const downloadAndInstall = useCallback(async () => {
    if (Platform.OS !== "android" || !apkUpdate.apkUrl) return;
    setIsDownloading(true);
    setError(null);
    try {
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error("No filesystem directory available");
      }
      const localUri = `${baseDir}myanify-update.apk`;
      const download = await FileSystem.downloadAsync(apkUpdate.apkUrl, localUri);
      if (download.status !== 200) {
        throw new Error(`Download failed (status ${download.status})`);
      }

      const contentUri = await FileSystem.getContentUriAsync(download.uri);
      await IntentLauncher.startActivityAsync(
        "android.intent.action.INSTALL_PACKAGE",
        {
          data: contentUri,
          type: "application/vnd.android.package-archive",
          flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
        },
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Update failed";
      try {
        // Android 8+ requires "Install unknown apps" to be enabled for this app.
        await IntentLauncher.startActivityAsync(
          "android.settings.MANAGE_UNKNOWN_APP_SOURCES",
          { data: `package:${Application.applicationId}` },
        );
      } catch {
        setError(message);
      }
    } finally {
      setIsDownloading(false);
    }
  }, [apkUpdate.apkUrl]);

  return {
    apkUpdate,
    isChecking,
    isDownloading,
    error,
    check,
    downloadAndInstall,
  };
}
