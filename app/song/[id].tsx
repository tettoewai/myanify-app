import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { FullPlayer } from "@/components/player/FullPlayer";
import { StyledSafeAreaView as SafeAreaView } from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { apiClient } from "@/lib/api";
import { formatSongFromApi } from "@/lib/song-format";
import type { Song } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function SongPage() {
  return (
    <RequireAuth>
      <SongPlayerScreen />
    </RequireAuth>
  );
}

function SongPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const { currentSong, playSong } = usePlayer();

  // Compute once on mount: only fetch if the requested song isn't already
  // playing. Using useState (not a derived variable) so this never flips back
  // to true when the user skips to the next song inside the player — that
  // would re-enable the query, re-fetch the original song, and restart it.
  const [shouldLoadSong] = useState(() => !!id && currentSong?.id !== id);

  const {
    data: fetchedSong,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["song", id],
    queryFn: async () => {
      const response = await apiClient.get(`/songs/${id}?include=lyrics`);
      const song = response?.data ?? response;
      return formatSongFromApi(song) as Song;
    },
    enabled: shouldLoadSong && !!token,
    // Lyrics come bundled via ?include=lyrics so PlayerContext won't refetch.
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (fetchedSong && currentSong?.id !== fetchedSong.id) {
      void playSong(fetchedSong);
    }
    // Intentionally omit currentSong?.id: we only want to fire when
    // fetchedSong arrives, not every time the user skips to a different song.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedSong, playSong]);

  // Ready as soon as we have any current song. After next/prev, currentSong.id
  // will differ from the route id — that's fine, the player just keeps playing.
  const isReady = !!currentSong;
  const isStartingFetchedSong =
    shouldLoadSong && !!fetchedSong && currentSong?.id !== fetchedSong.id;

  if (!isReady && (isLoading || isStartingFetchedSong)) {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner size="lg" />
          <Text className="mt-4 text-neutral-400">Loading song...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isReady && isError) {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-white text-lg">Song not found</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 px-6 py-3 bg-white/10 rounded-lg"
          >
            <Text className="text-white">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <FullPlayer />;
}
