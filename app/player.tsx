import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { FullPlayer } from "@/components/player/FullPlayer";
import { usePlayer } from "@/context/PlayerContext";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Now Playing screen — expands the current queue item without re-fetching.
 * Use `/song/[id]` when opening a specific track (deep links, song cards).
 */
export default function PlayerPage() {
  return (
    <RequireAuth>
      <NowPlayingScreen />
    </RequireAuth>
  );
}

function NowPlayingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentSong, isLoading } = usePlayer();

  if (!currentSong) {
    return (
      <View
        className="flex-1 bg-black"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <LoadingSpinner size="lg" />
            <Text className="mt-4 text-neutral-400">Loading...</Text>
          </View>
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-white text-lg text-center">
              Nothing is playing right now
            </Text>
            <Text className="text-neutral-400 text-sm text-center mt-2">
              Pick a song from Home or Search to start listening.
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              className="mt-6 px-6 py-3 bg-white/10 rounded-lg"
            >
              <Text className="text-white font-medium">Go Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return <FullPlayer />;
}
