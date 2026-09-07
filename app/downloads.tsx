import { LoadingView } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/auth/RequireAuth";
import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { usePlayer } from "@/context/PlayerContext";
import { apiClient } from "@/lib/api";
import { getSongCoverUrl } from "@/lib/song-cover";
import { formatSongFromApi } from "@/lib/song-format";
import type { Song } from "@/lib/types";
import { downloadManager } from "@/lib/vip-offline";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useToast } from "heroui-native";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

interface DownloadedSong {
  songId: string;
  song: Song;
  sizeBytes?: number;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Downloads() {
  return (
    <RequireAuth>
      <DownloadsScreen />
    </RequireAuth>
  );
}

function DownloadsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { playFromContext, currentSong } = usePlayer();
  const [items, setItems] = useState<DownloadedSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const files = await downloadManager.getAllDownloads();
      const songIds = files.map((f) => f.replace(/\.mp3$/, ""));
      const loaded: DownloadedSong[] = await Promise.all(
        songIds.map(async (songId) => {
          let song: Song | null = null;
          try {
            const response = await apiClient.get(`/songs/${songId}`);
            song = formatSongFromApi(response?.data ?? response) as Song;
          } catch {
            // Offline or song removed server-side — fall back to id.
          }
          let sizeBytes: number | undefined;
          try {
            const info = await FileSystem.getInfoAsync(
              `${FileSystem.documentDirectory}offline_downloads/${songId}.mp3`,
            );
            if (info.exists && "size" in info) {
              sizeBytes = (info as { size?: number }).size;
            }
          } catch {
            // Best effort.
          }
          return {
            songId,
            song:
              song ??
              ({
                id: songId,
                title: songId,
                artist: "Downloaded song",
              } as Song),
            sizeBytes,
          };
        }),
      );
      setItems(loaded);
    } catch (e) {
      console.error("Failed to load downloads:", e);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handlePlay = (entry: DownloadedSong, queue: DownloadedSong[]) => {
    void playFromContext(
      entry.song,
      queue.map((q) => q.song),
      "playlist",
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemove = async (songId: string) => {
    setRemovingId(songId);
    try {
      await downloadManager.deleteDownload(songId);
      setItems((prev) => prev.filter((i) => i.songId !== songId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      toast.show({
        label: e?.message || "Failed to remove download",
        variant: "danger",
      });
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <View className="px-4 pt-7 mt-10 mb-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-card items-center justify-center border border-border mr-3"
        >
          <StyledIonicons name="chevron-back" size={22} className="text-foreground" />
        </TouchableOpacity>
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full items-center justify-center mr-3 shadow">
            <StyledIonicons name="cloud-download" size={22} className="text-primary" />
          </View>
          <Text className="text-3xl font-bold text-foreground">Downloads</Text>
        </View>
        <Text className="text-muted-foreground text-sm">
          {items.length} song{items.length === 1 ? "" : "s"}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.songId}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              setIsRefetching(true);
              void load();
            }}
            tintColor="#ff0000"
            colors={["#ff0000"]}
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center pt-20 px-6">
            <StyledIonicons
              name="cloud-download-outline"
              size={80}
              className="text-muted-foreground mb-4"
            />
            <Text className="text-muted-foreground text-lg text-center">
              No downloads yet. Download songs for offline listening.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => {
          const isPlaying = currentSong?.id === item.songId;
          const removing = removingId === item.songId;
          return (
            <View
              className={`flex-row items-center mb-2 px-4 py-3 mx-4 rounded-xl ${
                isPlaying
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-card/50"
              }`}
            >
              <TouchableOpacity
                className="flex-row items-center flex-1"
                onPress={() => handlePlay(item, items)}
              >
                <Image
                  uri={getSongCoverUrl(item.song)}
                  variant="album"
                  className="w-14 h-14 rounded-xl mr-3"
                  contentFit="cover"
                />
                <View className="flex-1">
                  <Text
                    className="text-foreground font-semibold text-base"
                    numberOfLines={1}
                  >
                    {item.song.title}
                  </Text>
                  <Text
                    className="text-muted-foreground text-sm"
                    numberOfLines={1}
                  >
                    {(item.song.artist ||
                      item.song.artists?.map((a) => a.artist.name).join(", ") ||
                      "Downloaded") +
                      (item.sizeBytes
                        ? ` • ${formatBytes(item.sizeBytes)}`
                        : "")}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleRemove(item.songId)}
                disabled={removing}
                className="w-10 h-10 items-center justify-center"
              >
                <StyledIonicons
                  name={removing ? "hourglass-outline" : "trash-outline"}
                  size={20}
                  className="text-muted-foreground"
                />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
