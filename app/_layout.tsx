import Provider from "@/components/Providers";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import { Text, TouchableOpacity, View } from "react-native";
import "../global.css";
import "@/lib/theme";

export default function RootLayout() {
  const { isUpdateAvailable, isDownloading, download } = useUpdateCheck();
  const segments = useSegments();
  const isAtBottom = ["artist", "album", "liked-songs", "see-all", "playlist"].some((s) =>
    (segments as string[]).includes(s)
  );
  return (
    <Provider>
      <StatusBar hidden />
      {isUpdateAvailable ? (
        <View className="px-4 pt-12 pb-2 bg-background">
          <TouchableOpacity
            disabled={isDownloading}
            onPress={download}
            className="bg-primary rounded-lg py-3 px-4 flex-row items-center justify-center"
          >
            <Text className="text-primary-foreground font-semibold text-sm">
              {isDownloading ? "Downloading update..." : "Download & install update"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
    </Provider>
  );
}
