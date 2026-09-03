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
    checkError: otaCheckError,
  } = useUpdateCheck();
  const {
    apkUpdate,
    isDownloading: apkDownloading,
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

  // Dismissal is scoped to a specific versionCode — a new version re-shows the modal
  const isDismissedForThisVersion =
    !isMandatory && dismissedVersionCode !== null && dismissedVersionCode === apkUpdate.versionCode;

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

  // Surface APK download errors even if dismissed – user needs to see failure
  useEffect(() => {
    if (apkError) {
      setUpdateModalVisible(true);
    }
  }, [apkError]);

  // Auto-clear stale OTA check errors that appear without an actual update
  // (e.g. EAS channel header errors should not trigger modal)

  const handleInstall = () => {
    if (apkAvailable) {
      void downloadAndInstall();
    } else if (isUpdateAvailable) {
      void otaDownload().catch(() => {
        // Error surfaced via downloadError state
      });
    }
  };

  const handleLater = () => {
    if (!isMandatory) {
      setDismissedVersionCode(apkUpdate.versionCode);
      setUpdateModalVisible(false);
    }
  };

  // Only surface OTA download errors when an OTA is actually available; ignore checkError noise
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
          isDownloading={apkAvailable ? apkDownloading : otaDownloading}
          error={combinedError}
          onInstall={handleInstall}
          onLater={isMandatory ? undefined : handleLater}
          onDismissError={apkAvailable ? clearApkError : undefined}
        />
      ) : null}
    </Provider>
  );
}
