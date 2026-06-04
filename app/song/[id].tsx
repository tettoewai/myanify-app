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
import React, { useEffect, useMemo } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

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

  const shouldLoadSong = !!id && currentSong?.id !== id;

  const {
    data: fetchedSong,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["song", id],
    queryFn: async () => {
      const response = await apiClient.get(`/songs/${id}`);
      const song = response?.data ?? response;
      return formatSongFromApi(song) as Song;
    },
    enabled: shouldLoadSong && !!token,
  });

  useEffect(() => {
    if (fetchedSong && currentSong?.id !== fetchedSong.id) {
      void playSong(fetchedSong);
    }
  }, [currentSong?.id, fetchedSong, playSong]);

  const isReady = useMemo(
    () => !!currentSong && (!id || currentSong.id === id),
    [currentSong, id],
  );
  const isStartingFetchedSong =
    !!fetchedSong && currentSong?.id !== fetchedSong.id;

  if (!isReady && (isLoading || isStartingFetchedSong)) {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ff0000" />
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

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <FullPlayer />
    </SafeAreaView>
  );
}
