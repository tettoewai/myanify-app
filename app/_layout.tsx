import Provider from "@/components/Providers";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import { useApkUpdate } from "@/hooks/useApkUpdate";
import { UpdateModal } from "@/components/UpdateModal";
import { useEffect, useState } from "react";
import "../global.css";
import "@/lib/theme";

export default function RootLayout() {
  const {
    isUpdateAvailable,
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
  const segments = useSegments();
  const isAtBottom = ["artist", "album", "liked-songs", "see-all", "playlist"].some((s) =>
    (segments as string[]).includes(s)
  );

  const apkAvailable = apkUpdate.available;
  const showUpdate = apkAvailable || isUpdateAvailable;
  const isMandatory = apkAvailable ? apkUpdate.mandatory : false;

  // Keep modal visible while APK download is active, even if user dismissed
  const isDownloadingApk = downloadStatus === "downloading";
  const isDownloadComplete = downloadStatus === "complete";

  // Dismissal is scoped to a specific versionCode — a new version re-shows the modal
  const isDismissedForThisVersion =
    !isMandatory &&
    !isDownloadingApk &&
    !isDownloadComplete &&
    dismissedVersionCode !== null &&
    dismissedVersionCode === apkUpdate.versionCode;

  // Reset dismissal when a newer versionCode arrives
  useEffect(() => {
    if (apkAvailable && dismissedVersionCode !== null && apkUpdate.versionCode > dismissedVersionCode) {
      setDismissedVersionCode(null);
    }
  }, [apkAvailable, apkUpdate.versionCode, dismissedVersionCode]);

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
      } else {
        setDismissedVersionCode(apkUpdate.versionCode);
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
