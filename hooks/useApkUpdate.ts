import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

export type DownloadStatus = "idle" | "downloading" | "complete" | "error";

export interface DownloadProgress {
  totalBytes: number;
  writtenBytes: number;
  percent: number;
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

const DOWNLOAD_STATE_KEY = "@myanify:apk-download-state";
const APK_LOCAL_PATH = "myanify-update.apk";

interface PersistedDownloadState {
  versionCode: number;
  apkUrl: string;
  localUri: string;
  totalBytes: number;
  writtenBytes: number;
  status: "downloading" | "complete";
}

async function saveDownloadState(state: PersistedDownloadState) {
  try {
    await AsyncStorage.setItem(DOWNLOAD_STATE_KEY, JSON.stringify(state));
  } catch {
    // Non-critical
  }
}

async function loadDownloadState(): Promise<PersistedDownloadState | null> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOAD_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function clearDownloadState() {
  try {
    await AsyncStorage.removeItem(DOWNLOAD_STATE_KEY);
  } catch {
    // Non-critical
  }
}

/**
 * Detects and installs newer side-loadable Android APKs from the backend
 * manifest (GET /api/mobile-update). Supports progress tracking and
 * background-capable download — the modal can be dismissed while download
 * continues, and progress is surfaced via a banner.
 */
export function useApkUpdate() {
  const [apkUpdate, setApkUpdate] = useState<ApkUpdateInfo>(EMPTY_UPDATE);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Download state
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    totalBytes: 0,
    writtenBytes: 0,
    percent: 0,
  });
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");

  const downloadRef = useRef<FileSystem.DownloadResumable | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const downloadVersionCodeRef = useRef<number | null>(null);

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
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Resume or detect completed download on mount / foreground
  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (
        state === "active" &&
        appStateRef.current.match(/inactive|background/)
      ) {
        void check();
        void resumeOrDetectDownload();
      }
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, [check]);

  const resumeOrDetectDownload = useCallback(async () => {
    if (Platform.OS !== "android") return;

    const saved = await loadDownloadState();
    if (!saved) return;

    if (saved.status === "complete") {
      setDownloadStatus("complete");
      setDownloadProgress({
        totalBytes: saved.totalBytes,
        writtenBytes: saved.writtenBytes,
        percent: 100,
      });
      downloadVersionCodeRef.current = saved.versionCode;
      return;
    }

    if (downloadStatus === "downloading" && downloadRef.current) {
      return; // Already downloading
    }

    const localUri = `${FileSystem.cacheDirectory}${APK_LOCAL_PATH}`;
    const resumable = FileSystem.createDownloadResumable(
      saved.apkUrl,
      localUri,
      {},
      (data) => {
        const pct =
          data.totalBytesExpectedToWrite > 0
            ? Math.round(
                (data.totalBytesWritten / data.totalBytesExpectedToWrite) * 100,
              )
            : 0;
        setDownloadProgress({
          totalBytes: data.totalBytesExpectedToWrite,
          writtenBytes: data.totalBytesWritten,
          percent: pct,
        });
      },
    );

    downloadRef.current = resumable;
    downloadVersionCodeRef.current = saved.versionCode;
    setDownloadStatus("downloading");

    try {
      const result = await resumable.resumeAsync();
      if (result?.uri) {
        setDownloadStatus("complete");
        setDownloadProgress((p) => ({
          ...p,
          percent: 100,
          writtenBytes: p.totalBytes,
        }));
        await saveDownloadState({
          ...saved,
          status: "complete",
          writtenBytes: saved.totalBytes,
        });
      }
    } catch (e) {
      if (__DEV__) console.warn("[useApkUpdate] resume failed:", e);
      setDownloadStatus("error");
      setError("Download interrupted. Tap Download to retry.");
      await clearDownloadState();
    }
  }, [downloadStatus]);

  const downloadAndInstall = useCallback(async () => {
    if (Platform.OS !== "android" || !apkUpdate.apkUrl) return;

    if (downloadStatus === "complete") {
      await installApk();
      return;
    }

    setError(null);
    setDownloadStatus("downloading");
    setDownloadProgress({ totalBytes: 0, writtenBytes: 0, percent: 0 });
    downloadVersionCodeRef.current = apkUpdate.versionCode;

    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) {
      setError("No filesystem directory available");
      setDownloadStatus("error");
      return;
    }

    const localUri = `${baseDir}${APK_LOCAL_PATH}`;

    // Check for a partially downloaded file to resume
    let startingByte = 0;
    const saved = await loadDownloadState();
    if (
      saved &&
      saved.versionCode === apkUpdate.versionCode &&
      saved.status === "downloading"
    ) {
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists) {
        startingByte = info.size;
      }
    }

    const options: FileSystem.DownloadOptions = {};
    if (startingByte > 0) {
      options.headers = { Range: `bytes=${startingByte}-` };
    }

    const resumable = FileSystem.createDownloadResumable(
      apkUpdate.apkUrl,
      localUri,
      options,
      (data) => {
        const adjustedExpected = startingByte + data.totalBytesExpectedToWrite;
        const adjustedWritten = startingByte + data.totalBytesWritten;
        const pct =
          adjustedExpected > 0
            ? Math.round((adjustedWritten / adjustedExpected) * 100)
            : 0;
        setDownloadProgress({
          totalBytes: adjustedExpected,
          writtenBytes: adjustedWritten,
          percent: pct,
        });
      },
    );

    downloadRef.current = resumable;

    try {
      const result = await resumable.downloadAsync();

      if (result?.uri) {
        // File size validation
        if (apkUpdate.fileSize) {
          const info = await FileSystem.getInfoAsync(result.uri);
          if (info.exists && info.size !== apkUpdate.fileSize) {
            throw new Error(
              `Download corrupted: expected ${apkUpdate.fileSize} bytes, got ${info.size}`,
            );
          }
        }

        setDownloadStatus("complete");
        setDownloadProgress((p) => ({
          ...p,
          percent: 100,
          writtenBytes: p.totalBytes,
        }));

        await saveDownloadState({
          versionCode: apkUpdate.versionCode,
          apkUrl: apkUpdate.apkUrl,
          localUri: result.uri,
          totalBytes: downloadProgress.totalBytes || apkUpdate.fileSize || 0,
          writtenBytes: downloadProgress.totalBytes || apkUpdate.fileSize || 0,
          status: "complete",
        });

        await installApk();
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Download failed";
      setError(message);
      setDownloadStatus("error");
      if (__DEV__) console.warn("[useApkUpdate] download failed:", e);

      await clearDownloadState();
      downloadRef.current = null;
    } finally {
      downloadRef.current = null;
    }
  }, [apkUpdate, downloadStatus, downloadProgress.totalBytes]);

  const installApk = useCallback(async () => {
    if (Platform.OS !== "android") return;

    const localUri = `${FileSystem.cacheDirectory}${APK_LOCAL_PATH}`;
    try {
      const contentUri = await FileSystem.getContentUriAsync(localUri);
      await IntentLauncher.startActivityAsync(
        "android.intent.action.INSTALL_PACKAGE",
        {
          data: contentUri,
          type: "application/vnd.android.package-archive",
          flags: 1,
        },
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Install failed";
      setError(message);
      if (__DEV__) console.warn("[useApkUpdate] install failed:", e);
      const isPermissionError =
        /install|unknown|permission/i.test(message) || message === "Install failed";
      if (isPermissionError) {
        try {
          await IntentLauncher.startActivityAsync(
            "android.settings.MANAGE_UNKNOWN_APP_SOURCES",
            { data: `package:${Application.applicationId}` },
          );
        } catch {
          // Intent to settings failed
        }
      }
    }
  }, []);

  const resetDownload = useCallback(async () => {
    if (downloadRef.current) {
      try {
        await downloadRef.current.pauseAsync();
      } catch {
        // Ignore
      }
      downloadRef.current = null;
    }
    await clearDownloadState();
    setDownloadStatus("idle");
    setDownloadProgress({ totalBytes: 0, writtenBytes: 0, percent: 0 });
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    apkUpdate,
    isChecking,
    error,
    downloadProgress,
    downloadStatus,
    downloadAndInstall,
    resetDownload,
    check,
    clearError,
  };
}
