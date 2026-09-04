import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { apiClient } from "@/lib/api";
import {
  ensureNotificationChannel,
  requestUpdatePermission,
  showDownloadProgress,
  showDownloadComplete,
  showDownloadError,
  dismissUpdateNotification,
} from "@/lib/update-notification";

export interface ApkUpdateInfo {
  version: string;
  versionCode: number;
  apkUrl: string;
  notes: string;
  mandatory: boolean;
  available: boolean;
  sha256?: string;
  md5?: string;
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
  md5?: string;
  fileSize?: number;
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

  // Ensure notification channel exists on mount
  useEffect(() => {
    void ensureNotificationChannel();
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
        md5: manifest.md5,
        fileSize: manifest.fileSize,
      });
    } catch (e) {
      console.warn("[useApkUpdate] check failed:", e);
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
        void throttledNotify(
          saved.version || `v${saved.versionCode}`,
          pct,
          data.totalBytesWritten,
          data.totalBytesExpectedToWrite,
        );
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
          void showDownloadError(message);
          await clearDownloadState();
          return;
        }
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
        void showDownloadComplete(saved.version || `v${saved.versionCode}`);
        await installApk();
      }
    } catch (e) {
      console.warn("[useApkUpdate] resume failed:", e);
      setDownloadStatus("error");
      setError("Download interrupted. Tap Download to retry.");
      void showDownloadError("Download interrupted. Tap Download to retry.");
      await clearDownloadState();
    }
  }, [downloadStatus, throttledNotify]);

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

    setError(null);
    setDownloadStatus("downloading");
    setDownloadProgress({ totalBytes: 0, writtenBytes: 0, percent: 0 });
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
        setDownloadProgress({
          totalBytes: adjustedExpected,
          writtenBytes: adjustedWritten,
          percent: pct,
        });
        if (hasPermission) {
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
        setDownloadProgress((p) => ({
          ...p,
          percent: 100,
          writtenBytes: finalSize || p.totalBytes,
          totalBytes: finalSize || p.totalBytes,
        }));

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

        void showDownloadComplete(apkUpdate.version);
        await installApk();
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Download failed";
      setError(message);
      setDownloadStatus("error");
      console.warn("[useApkUpdate] download failed:", e);
      void showDownloadError(message);

      await clearDownloadState();
      downloadRef.current = null;
    } finally {
      downloadRef.current = null;
    }
  }, [apkUpdate, downloadStatus, downloadProgress.totalBytes, throttledNotify]);

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
    void dismissUpdateNotification();
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
