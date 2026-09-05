import Provider from "@/components/Providers";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import { useApkUpdate } from "@/hooks/useApkUpdate";
import { useDeepLink } from "@/hooks/useDeepLink";
import { UpdateModal } from "@/components/UpdateModal";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import { registerBackgroundUpdateCheck } from "@/lib/background-update-check";
import "../global.css";
import "@/lib/theme";

export default function RootLayout() {
  useEffect(() => {
    void registerBackgroundUpdateCheck();
  }, []);

  const {
    isUpdateAvailable,
    availableUpdate,
    isDownloading: otaDownloading,
    download: otaDownload,
    downloadError: otaDownloadError,
  } = useUpdateCheck();
  const {
    apkUpdate,
    downloadStatus,
    downloadProgress,
    downloadAndInstall,
    error: apkError,
    clearError: clearApkError,
  } = useApkUpdate();
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [dismissedVersionCode, setDismissedVersionCode] = useState<number | null>(null);
  const [dismissedOtaUpdateId, setDismissedOtaUpdateId] = useState<string | null>(null);
  const segments = useSegments();
  const isAtBottom = ["artist", "album", "liked-songs", "see-all", "playlist"].some((s) =>
    (segments as string[]).includes(s)
  );

  const apkAvailable = apkUpdate.available;
  const showUpdate = apkAvailable || isUpdateAvailable;
  const isMandatory = apkAvailable ? apkUpdate.mandatory : false;

  // OTA update identity for dismissal tracking (APK takes precedence when both exist)
  const otaUpdateId =
    availableUpdate && availableUpdate.type === "new"
      ? availableUpdate.updateId
      : isUpdateAvailable
        ? "ota-unknown"
        : null;

  // Keep modal visible while APK download is active, even if user dismissed
  const isDownloadingApk = downloadStatus === "downloading";
  const isDownloadComplete = downloadStatus === "complete";

  // Dismissal is scoped to a specific versionCode / OTA updateId — a new version re-shows the modal
  const isApkDismissed =
    !isMandatory &&
    !isDownloadingApk &&
    !isDownloadComplete &&
    dismissedVersionCode !== null &&
    dismissedVersionCode === apkUpdate.versionCode;
  const isOtaDismissed =
    !apkAvailable &&
    isUpdateAvailable &&
    otaUpdateId !== null &&
    dismissedOtaUpdateId !== null &&
    dismissedOtaUpdateId === otaUpdateId;
  const isDismissedForThisVersion = apkAvailable ? isApkDismissed : isOtaDismissed;

  // Reset dismissal when a newer versionCode arrives
  useEffect(() => {
    if (apkAvailable && dismissedVersionCode !== null && apkUpdate.versionCode > dismissedVersionCode) {
      setDismissedVersionCode(null);
    }
  }, [apkAvailable, apkUpdate.versionCode, dismissedVersionCode]);

  // Clear OTA dismissal once the update is gone (installed) so the next OTA re-shows
  useEffect(() => {
    if (!isUpdateAvailable && dismissedOtaUpdateId !== null) {
      setDismissedOtaUpdateId(null);
    }
  }, [isUpdateAvailable, dismissedOtaUpdateId]);

  useEffect(() => {
    if (showUpdate && !isDismissedForThisVersion) {
      setUpdateModalVisible(true);
    } else if (!showUpdate && !apkError) {
      setUpdateModalVisible(false);
    }
  }, [showUpdate, isDismissedForThisVersion, apkError]);

  // Surface APK download errors even if dismissed
  useEffect(() => {
    if (apkError) {
      setUpdateModalVisible(true);
    }
  }, [apkError]);

  // Re-show modal when background download completes
  useEffect(() => {
    if (isDownloadComplete) {
      setUpdateModalVisible(true);
    }
  }, [isDownloadComplete]);

  // Handle notification tap — trigger install if download is complete, or show update modal if available
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.type === "apk-update") {
        if (data?.status === "complete") {
          if (downloadStatus === "complete") {
            void downloadAndInstall();
          } else {
            setUpdateModalVisible(true);
          }
        } else if (data?.status === "available") {
          setUpdateModalVisible(true);
        }
      }
    });
    return () => subscription.remove();
  }, [downloadStatus, downloadAndInstall]);

  const handleInstall = () => {
    if (apkAvailable) {
      void downloadAndInstall();
    } else if (isUpdateAvailable) {
      void otaDownload().catch(() => {});
    }
  };

  const handleLater = () => {
    if (!isMandatory) {
      if (isDownloadingApk) {
        // Let download continue in background — just hide modal
        setUpdateModalVisible(false);
      } else if (apkAvailable) {
        setDismissedVersionCode(apkUpdate.versionCode);
        setUpdateModalVisible(false);
      } else if (isUpdateAvailable) {
        setDismissedOtaUpdateId(otaUpdateId ?? "ota-unknown");
        setUpdateModalVisible(false);
      } else {
        setUpdateModalVisible(false);
      }
    }
  };

  const combinedError = apkAvailable
    ? apkError
    : isUpdateAvailable
      ? (otaDownloadError?.message ?? null)
      : null;

  return (
    <Provider>
      <DeepLinkHandler />
      <StatusBar hidden />
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: "transparent",
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="player"
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
            contentStyle: { backgroundColor: "#000000" },
            statusBarStyle: "light",
            statusBarHidden: false,
          }}
        />
        <Stack.Screen
          name="song/[id]"
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
            contentStyle: { backgroundColor: "#000000" },
            statusBarStyle: "light",
            statusBarHidden: false,
          }}
        />
        <Stack.Screen name="artist/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="album/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="genre/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="see-all/[section]" options={{ headerShown: false }} />
        <Stack.Screen name="liked-songs" options={{ headerShown: false }} />
        <Stack.Screen name="playlist/[id]" options={{ headerShown: false }} />
      </Stack>

      <MiniPlayer bottomOffset={isAtBottom ? 0 : undefined} />

      {showUpdate || combinedError ? (
        <UpdateModal
          visible={updateModalVisible}
          kind={apkAvailable ? "apk" : "ota"}
          version={apkUpdate.version}
          notes={apkUpdate.notes}
          mandatory={isMandatory}
          isDownloading={apkAvailable ? isDownloadingApk : otaDownloading}
          downloadStatus={downloadStatus}
          downloadProgress={downloadProgress}
          error={combinedError}
          onInstall={handleInstall}
          onLater={isMandatory ? undefined : handleLater}
          onDismissError={apkAvailable ? clearApkError : undefined}
        />
      ) : null}
    </Provider>
  );
}

function DeepLinkHandler() {
  const { isAuthenticated } = useAuth();
  useDeepLink(isAuthenticated);
  return null;
}
