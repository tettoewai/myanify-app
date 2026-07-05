import { useUpdates, checkForUpdateAsync, fetchUpdateAsync, reloadAsync } from "expo-updates";
import { useCallback, useEffect } from "react";

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

  useEffect(() => {
    if (isUpdatePending) {
      reloadAsync();
    }
  }, [isUpdatePending]);

  const check = useCallback(async () => {
    try {
      await checkForUpdateAsync();
    } catch {
      // Silently fail — updates not available in dev
    }
  }, []);

  const download = useCallback(async () => {
    try {
      await fetchUpdateAsync();
    } catch {
      // Silently fail
    }
  }, []);

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
