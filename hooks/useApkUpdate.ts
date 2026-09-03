import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
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
  sha256?: string;
  fileSize?: number;
}

interface MobileReleaseManifest {
  version?: string;
  versionCode?: number;
  apkUrl?: string;
  notes?: string;
  mandatory?: boolean;
  sha256?: string;
  fileSize?: number;
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
    setError(null);
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
        sha256: manifest.sha256,
        fileSize: manifest.fileSize,
      });
    } catch (e) {
      if (__DEV__) console.warn("[useApkUpdate] check failed:", e);
      // Keep previous apkUpdate state so UI doesn't flicker on transient network error
    } finally {
      setIsChecking(false);
    }
  }, []);

  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      // Re-check when returning to foreground if we haven't checked recently
      if (
        state === "active" &&
        appStateRef.current.match(/inactive|background/)
      ) {
        void check();
      }
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, [check]);

  const clearError = useCallback(() => setError(null), []);

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

      // Optional integrity checks if manifest provides them
      if (apkUpdate.fileSize) {
        const info = await FileSystem.getInfoAsync(download.uri);
        if (info.exists && info.size !== apkUpdate.fileSize) {
          throw new Error(
            `Download corrupted: expected ${apkUpdate.fileSize} bytes, got ${info.size}`,
          );
        }
      }

      if (apkUpdate.sha256) {
        const info = await FileSystem.getInfoAsync(download.uri);
        if (__DEV__ && info.exists) {
          console.warn(
            "[useApkUpdate] sha256 provided but runtime verification not yet implemented — relying on HTTPS + EAS signature. Consider adding native sha256 check.",
          );
        }
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
      setError(message);
      if (__DEV__) console.warn("[useApkUpdate] install failed:", e);
      // Help user enable "Install unknown apps" if that is the likely cause.
      // Do not swallow the original error — surface it and *also* offer the settings shortcut.
      const isPermissionError =
        /install|unknown|permission/i.test(message) || message === "Update failed";
      if (isPermissionError) {
        try {
          await IntentLauncher.startActivityAsync(
            "android.settings.MANAGE_UNKNOWN_APP_SOURCES",
            { data: `package:${Application.applicationId}` },
          );
        } catch {
          // Intent to settings failed — error already set
        }
      }
    } finally {
      setIsDownloading(false);
    }
  }, [apkUpdate.apkUrl, apkUpdate.fileSize, apkUpdate.sha256]);

  return {
    apkUpdate,
    isChecking,
    isDownloading,
    error,
    check,
    downloadAndInstall,
    clearError,
  };
}
