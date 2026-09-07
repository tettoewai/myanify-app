import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Notifications from "expo-notifications";
import { apiClient } from "@/lib/api";
import {
  EMPTY_APK_UPDATE,
  fetchAvailableApkUpdate,
  type ApkUpdateInfo,
} from "@/lib/mobile-update";
import {
  ensureNotificationChannel,
  requestUpdatePermission,
  showDownloadProgress,
  showDownloadComplete,
  showDownloadError,
  dismissUpdateNotification,
} from "@/lib/update-notification";

export type { ApkUpdateInfo };

export type DownloadStatus = "idle" | "downloading" | "complete" | "error";

export interface DownloadProgress {
  totalBytes: number;
  writtenBytes: number;
  percent: number;
}

function reportEvent(
  event: string,
  current: number | null,
  latest: number | null,
  error?: string,
) {
  try {
    void apiClient
      .post("/mobile-update/events", {
        event,
        currentVersionCode: current,
        latestVersionCode: latest,
        ...(error ? { error } : {}),
      })
      .catch(() => {});
  } catch {
    // telemetry must never break updates
  }
}

async function verifyDownloadedFile(
  uri: string,
  expected: Pick<ApkUpdateInfo, "fileSize" | "md5" | "sha256" | "version">,
  downloadedMd5?: string | null,
): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri, { md5: true });
  if (!info.exists) {
    throw new Error("Downloaded file is missing");
  }
  const actualSize = info.size ?? 0;
  if (expected.fileSize && expected.fileSize > 0) {
    if (actualSize !== expected.fileSize) {
      throw new Error(
        `Download corrupted: expected ${expected.fileSize} bytes, got ${actualSize}`,
      );
    }
  } else if (actualSize === 0) {
    throw new Error("Downloaded file is empty");
  }
  const manifestMd5 = expected.md5?.toLowerCase();
  const actualMd5 = (downloadedMd5 ?? ("md5" in info ? (info as { md5?: string }).md5 : undefined))?.toLowerCase();
  if (manifestMd5) {
    if (!actualMd5) {
      throw new Error("Could not verify download integrity (MD5 unavailable)");
    }
    if (actualMd5 !== manifestMd5) {
      throw new Error("Download corrupted: checksum mismatch");
    }
  } else if (expected.sha256) {
    // expo-file-system only supports MD5 natively; SHA-256 cannot be
    // streamed on-device without loading the whole 100MB+ APK into memory.
    // Strict fileSize + HTTPS + EAS signature is the on-device guarantee;
    // SHA-256 remains for server-side / manual verification.
    console.warn(
      `[useApkUpdate] v${expected.version}: manifest has sha256 but no md5; verified by exact fileSize only`,
    );
  }
}

const EMPTY_UPDATE: ApkUpdateInfo = EMPTY_APK_UPDATE;

const DOWNLOAD_STATE_KEY = "@myanify:apk-download-state";
const APK_LOCAL_PATH = "myanify-update.apk";

interface PersistedDownloadState {
  version: string;
  versionCode: number;
  apkUrl: string;
  localUri: string;
  totalBytes: number;
  writtenBytes: number;
  status: "downloading" | "complete";
  fileSize?: number;
  md5?: string;
  sha256?: string;
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
  const lastNotifyPercentRef = useRef(0);
  const lastNotifyTimeRef = useRef(0);
  // Whether progress notifications may be shown. Mirrors the permission
  // granted at download start; resume path refreshes it via getPermissionsAsync.
  const notifyEnabledRef = useRef(true);
  const progressRef = useRef<DownloadProgress>({
    totalBytes: 0,
    writtenBytes: 0,
    percent: 0,
  });

  const updateProgress = useCallback((p: DownloadProgress) => {
    progressRef.current = p;
    setDownloadProgress(p);
  }, []);

  // Ensure notification channel exists on mount + cache permission state
  useEffect(() => {
    void ensureNotificationChannel();
    void Notifications.getPermissionsAsync().then(({ status }) => {
      notifyEnabledRef.current = status === "granted";
    });
  }, []);

  const throttledNotify = useCallback(
    (version: string, pct: number, written: number, total: number) => {
      const now = Date.now();
      const percentDelta = Math.abs(pct - lastNotifyPercentRef.current);
      const timeDelta = now - lastNotifyTimeRef.current;
      if (percentDelta < 5 && timeDelta < 2000) return;
      lastNotifyPercentRef.current = pct;
      lastNotifyTimeRef.current = now;
      void showDownloadProgress(version, pct, written, total);
    },
    [],
  );

  const check = useCallback(async () => {
    if (Platform.OS !== "android") return;
    setIsChecking(true);
    setError(null);
    try {
      const result = await fetchAvailableApkUpdate();

      if (result.status === "none") {
        setApkUpdate(EMPTY_UPDATE);
        return;
      }

      if (result.status === "rejected") {
        console.warn(`[useApkUpdate] rejected manifest: ${result.reason}`);
        reportEvent(
          "download_error",
          result.currentVersionCode,
          result.latestVersionCode,
          result.reason,
        );
        setApkUpdate(EMPTY_UPDATE);
        if (result.reason === "bad manifest signature") {
          setError("Update manifest failed verification. Please update later.");
        }
        return;
      }

      setApkUpdate(result.update);
      reportEvent(
        result.update.available ? "available" : "check",
        result.currentVersionCode,
        result.latestVersionCode,
      );
    } catch (e) {
      console.warn("[useApkUpdate] check failed:", e);
    } finally {
      setIsChecking(false);
    }
  }, []);

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
      console.warn("[useApkUpdate] install failed:", e);
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

  const resumeOrDetectDownload = useCallback(async () => {
    if (Platform.OS !== "android") return;

    const saved = await loadDownloadState();
    if (!saved) return;

    if (saved.status === "complete") {
      try {
        await verifyDownloadedFile(saved.localUri, {
          version: saved.version,
          fileSize: saved.fileSize,
          md5: saved.md5,
          sha256: saved.sha256,
        });
      } catch (e) {
        console.warn("[useApkUpdate] saved file failed verification, clearing:", e);
        await clearDownloadState();
        return;
      }
      setDownloadStatus("complete");
      updateProgress({
        totalBytes: saved.totalBytes,
        writtenBytes: saved.writtenBytes,
        percent: 100,
      });
      downloadVersionCodeRef.current = saved.versionCode;
      return;
    }

    if (downloadRef.current) {
      return; // Already downloading
    }

    // Refresh permission — resume must not notify when denied.
    try {
      const { status } = await Notifications.getPermissionsAsync();
      notifyEnabledRef.current = status === "granted";
    } catch {
      // Keep last known value
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
        updateProgress({
          totalBytes: data.totalBytesExpectedToWrite,
          writtenBytes: data.totalBytesWritten,
          percent: pct,
        });
        if (notifyEnabledRef.current) {
          throttledNotify(
            saved.version || `v${saved.versionCode}`,
            pct,
            data.totalBytesWritten,
            data.totalBytesExpectedToWrite,
          );
        }
      },
    );

    downloadRef.current = resumable;
    downloadVersionCodeRef.current = saved.versionCode;
    setDownloadStatus("downloading");

    try {
      const result = await resumable.resumeAsync();
      if (result?.uri) {
        try {
          await verifyDownloadedFile(result.uri, {
            version: saved.version,
            fileSize: saved.fileSize,
            md5: saved.md5,
            sha256: saved.sha256,
          });
        } catch (verifyError) {
          const message =
            verifyError instanceof Error ? verifyError.message : "Download failed";
          setError(message);
          setDownloadStatus("error");
          if (notifyEnabledRef.current) void showDownloadError(message);
          await clearDownloadState();
          return;
        }
        setDownloadStatus("complete");
        updateProgress({
          totalBytes: progressRef.current.totalBytes,
          writtenBytes: progressRef.current.totalBytes,
          percent: 100,
        });
        await saveDownloadState({
          ...saved,
          status: "complete",
          writtenBytes: saved.totalBytes,
        });
        if (notifyEnabledRef.current) {
          void showDownloadComplete(saved.version || `v${saved.versionCode}`);
        }
        await installApk();
      }
    } catch (e) {
      console.warn("[useApkUpdate] resume failed:", e);
      setDownloadStatus("error");
      setError("Download interrupted. Tap Download to retry.");
      if (notifyEnabledRef.current) {
        void showDownloadError("Download interrupted. Tap Download to retry.");
      }
      await clearDownloadState();
    } finally {
      downloadRef.current = null;
    }
  }, [throttledNotify, updateProgress, installApk]);

  // Check + resume on mount; re-check + resume on foreground. Persist the
  // latest progress when backgrounded so a killed app can resume after relaunch.
  useEffect(() => {
    void check();
    void resumeOrDetectDownload();
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      const prev = appStateRef.current;
      if (state === "active" && prev.match(/inactive|background/)) {
        void check();
        void resumeOrDetectDownload();
      }
      if (state.match(/inactive|background/) && downloadRef.current) {
        // Best-effort snapshot so relaunch can continue from ~current offset.
        const p = progressRef.current;
        void loadDownloadState().then((saved) => {
          if (saved && saved.status === "downloading") {
            void saveDownloadState({
              ...saved,
              totalBytes: p.totalBytes || saved.totalBytes,
              writtenBytes: p.writtenBytes || saved.writtenBytes,
            });
          }
        });
      }
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, [check, resumeOrDetectDownload]);

  const downloadAndInstall = useCallback(async () => {
    if (Platform.OS !== "android" || !apkUpdate.apkUrl) return;

    if (downloadStatus === "complete") {
      const localUri = `${FileSystem.cacheDirectory}${APK_LOCAL_PATH}`;
      try {
        await verifyDownloadedFile(localUri, apkUpdate);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Download failed";
        setError(message);
        setDownloadStatus("error");
        void showDownloadError(message);
        await clearDownloadState();
        return;
      }
      await installApk();
      return;
    }

    // Request notification permission before starting download
    const hasPermission = await requestUpdatePermission();
    notifyEnabledRef.current = hasPermission;
    const current = parseInt(Application.nativeBuildVersion ?? "0", 10);
    reportEvent("download_start", current, apkUpdate.versionCode);

    setError(null);
    setDownloadStatus("downloading");
    updateProgress({ totalBytes: 0, writtenBytes: 0, percent: 0 });
    downloadVersionCodeRef.current = apkUpdate.versionCode;
    lastNotifyPercentRef.current = 0;
    lastNotifyTimeRef.current = 0;

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

    const localUriForState = localUri;
    await saveDownloadState({
      version: apkUpdate.version,
      versionCode: apkUpdate.versionCode,
      apkUrl: apkUpdate.apkUrl,
      localUri: localUriForState,
      totalBytes: apkUpdate.fileSize || 0,
      writtenBytes: startingByte,
      status: "downloading",
      fileSize: apkUpdate.fileSize,
      md5: apkUpdate.md5,
      sha256: apkUpdate.sha256,
    });

    const options: FileSystem.DownloadOptions = {
      // MD5 is only meaningful for full downloads; Range resumes change bytes on the wire
      ...(startingByte === 0 ? { md5: true } : {}),
    };
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
        updateProgress({
          totalBytes: adjustedExpected,
          writtenBytes: adjustedWritten,
          percent: pct,
        });
        if (notifyEnabledRef.current) {
          throttledNotify(apkUpdate.version, pct, adjustedWritten, adjustedExpected);
        }
      },
    );

    downloadRef.current = resumable;

    try {
      const result = await resumable.downloadAsync();

      if (result?.uri) {
        await verifyDownloadedFile(result.uri, apkUpdate, result.md5);
        const info = await FileSystem.getInfoAsync(result.uri);
        const finalSize = info.exists ? (info.size ?? 0) : 0;

        setDownloadStatus("complete");
        updateProgress({
          totalBytes: finalSize || progressRef.current.totalBytes,
          writtenBytes: finalSize || progressRef.current.totalBytes,
          percent: 100,
        });

        await saveDownloadState({
          version: apkUpdate.version,
          versionCode: apkUpdate.versionCode,
          apkUrl: apkUpdate.apkUrl,
          localUri: result.uri,
          totalBytes: finalSize || apkUpdate.fileSize || 0,
          writtenBytes: finalSize || apkUpdate.fileSize || 0,
          status: "complete",
          fileSize: apkUpdate.fileSize,
          md5: apkUpdate.md5,
          sha256: apkUpdate.sha256,
        });

        if (notifyEnabledRef.current) void showDownloadComplete(apkUpdate.version);
        reportEvent(
          "download_complete",
          parseInt(Application.nativeBuildVersion ?? "0", 10),
          apkUpdate.versionCode,
        );
        await installApk();
        reportEvent(
          "install_prompt",
          parseInt(Application.nativeBuildVersion ?? "0", 10),
          apkUpdate.versionCode,
        );
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Download failed";
      setError(message);
      setDownloadStatus("error");
      console.warn("[useApkUpdate] download failed:", e);
      if (notifyEnabledRef.current) void showDownloadError(message);
      reportEvent(
        "download_error",
        parseInt(Application.nativeBuildVersion ?? "0", 10),
        apkUpdate.versionCode,
        message,
      );

      await clearDownloadState();
      downloadRef.current = null;
    } finally {
      downloadRef.current = null;
    }
  }, [apkUpdate, downloadStatus, throttledNotify, updateProgress, installApk]);

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
    updateProgress({ totalBytes: 0, writtenBytes: 0, percent: 0 });
    setError(null);
    void dismissUpdateNotification();
  }, [updateProgress]);

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
