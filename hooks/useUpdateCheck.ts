import { useUpdates, checkForUpdateAsync, fetchUpdateAsync, reloadAsync } from "expo-updates";
import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

export function useUpdateCheck() {
  const {
    currentlyRunning,
    isUpdateAvailable,
    isUpdatePending,
    isChecking,
    isDownloading,
    checkError,
    downloadError,
  } = useUpdates();

  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (isUpdatePending) {
      void reloadAsync();
    }
  }, [isUpdatePending]);

  const check = useCallback(async () => {
    if (__DEV__) return;
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    try {
      await checkForUpdateAsync();
    } catch (error) {
      if (__DEV__) console.warn("[useUpdateCheck] check failed:", error);
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  const download = useCallback(async () => {
    try {
      await fetchUpdateAsync();
    } catch (error) {
      if (__DEV__) console.warn("[useUpdateCheck] download failed:", error);
      throw error;
    }
  }, []);

  // Auto-check on mount and when app comes to foreground.
  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void check();
    });
    return () => sub.remove();
  }, [check]);

  return {
    isUpdateAvailable,
    isChecking,
    isDownloading,
    checkError,
    downloadError,
    currentlyRunning,
    check,
    download,
  };
}
