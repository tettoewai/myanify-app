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
  const { isUpdateAvailable, isDownloading: otaDownloading, download: otaDownload } =
    useUpdateCheck();
  const {
    apkUpdate,
    isDownloading: apkDownloading,
    downloadAndInstall,
  } = useApkUpdate();
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const segments = useSegments();
  const isAtBottom = ["artist", "album", "liked-songs", "see-all", "playlist"].some((s) =>
    (segments as string[]).includes(s)
  );

  const apkAvailable = apkUpdate.available;
  const showUpdate = apkAvailable || isUpdateAvailable;

  useEffect(() => {
    if (showUpdate && !dismissed) {
      setUpdateModalVisible(true);
    }
  }, [showUpdate, dismissed]);

  const handleInstall = () => {
    if (apkAvailable) {
      void downloadAndInstall();
    } else if (isUpdateAvailable) {
      void otaDownload();
    }
  };

  const handleLater = () => {
    setDismissed(true);
    setUpdateModalVisible(false);
  };

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

      {showUpdate ? (
        <UpdateModal
          visible={updateModalVisible}
          kind={apkAvailable ? "apk" : "ota"}
          version={apkUpdate.version}
          notes={apkUpdate.notes}
          mandatory={apkAvailable ? apkUpdate.mandatory : false}
          isDownloading={apkAvailable ? apkDownloading : otaDownloading}
          onInstall={handleInstall}
          onLater={apkAvailable && apkUpdate.mandatory ? undefined : handleLater}
        />
      ) : null}
    </Provider>
  );
}
