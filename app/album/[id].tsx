import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SongActionSheet } from "@/components/SongActionSheet";
import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { apiClient } from "@/lib/api";
import { formatSongFromApi } from "@/lib/song-format";
import { getSongCoverUrl } from "@/lib/song-cover";
import { shareEntity } from "@/lib/share";
import { Song } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useMemo, useRef, useState } from "react";
import { useToast } from "heroui-native";
import {
  Animated,
  Dimensions,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { withUniwind } from "uniwind";
import { downloadManager } from "@/lib/vip-offline";
import { showDownloadCompleteToast } from "@/lib/download-toast";
import { isOfflinePlaybackAllowed, getDownloadSettings } from "@/lib/download-settings";

const StyledIonicons = withUniwind(Ionicons);
const { height } = Dimensions.get("window");
const HEADER_HEIGHT = height * 0.45;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatAlbumType(type?: string | null): string | null {
  if (!type) return null;
  if (type === "SINGLE") return "Single";
  if (type === "EP") return "EP";
  if (type === "ALBUM") return "Album";
  return type;
}

const StatCard = ({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}) => (
  <View className="items-center flex-1 bg-neutral-900/50 rounded-2xl p-4 border border-neutral-800">
    <StyledIonicons name={icon as any} size={24} color="#ff0000" />
    <Text className="text-white text-lg font-bold mt-2">{value}</Text>
    <Text className="text-neutral-400 text-xs mt-1">{label}</Text>
  </View>
);

export default function AlbumDetails() {
  return (
    <RequireAuth>
      <AlbumDetailsScreen />
    </RequireAuth>
  );
}

function AlbumDetailsScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const {
    playFromContext,
    currentSong: playingSong,
    isPlaying,
    setIsShuffled,
  } = usePlayer();
  const [actionSong, setActionSong] = useState<Song | null>(null);
  const { isLikedSong, toggleLike } = useLikeSong();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [dlAllState, setDlAllState] = useState<{
    status: "idle" | "downloading" | "completed" | "failed";
    progress: number;
    completed: number;
    total: number;
    error?: string;
  }>({ status: "idle", progress: 0, completed: 0, total: 0 });

  const { data: album, isLoading: albumLoading } = useQuery({
    queryKey: ["album", id],
    queryFn: () => apiClient.get(`/albums/${id}`),
    enabled: !!id && !!token,
    staleTime: 5 * 60 * 1000,
  });

  const songs: Song[] = useMemo(() => {
    if (!album?.songs) return [];
    return album.songs.map((item: any) => formatSongFromApi(item));
  }, [album]);

  const albumArtistImageUrl = useMemo(
    () => songs[0]?.artistImageUrl ?? null,
    [songs],
  );

  const handlePlayAll = () => {
    if (songs.length > 0) {
      void playFromContext(songs[0], songs, "playlist");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handlePlaySong = (song: Song) => {
    void playFromContext(song, songs, "playlist");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleShuffle = () => {
    if (songs.length > 0) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      setIsShuffled(true);
      void playFromContext(shuffled[0], shuffled, "playlist");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleShare = () => {
    void shareEntity("album", album, { title: album.name });
  };

  const handleDownloadAll = async () => {
    if (!token || songs.length === 0) return;
    const allowed = await isOfflinePlaybackAllowed().catch(() => false);
    if (!allowed) {
      const settings = await getDownloadSettings().catch(() => null);
      toast.show({
        label: settings?.requireVip ? "VIP required for downloads" : "Downloads not allowed",
        variant: "danger",
      });
      return;
    }
    setDlAllState({ status: "downloading", progress: 0, completed: 0, total: songs.length });
    try {
      for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        const fileInfo = await downloadManager.getDownloadedFile(song.id);
        if (fileInfo) {
          setDlAllState((s) => ({ ...s, completed: s.completed + 1, progress: Math.round(((s.completed + 1) / s.total) * 100) }));
          continue;
        }
        await downloadManager.initiateDownload(song.id, song.audioUrl || song.playbackUrl || "");
        setDlAllState((s) => ({ ...s, completed: s.completed + 1, progress: Math.round(((s.completed + 1) / s.total) * 100) }));
      }
      setDlAllState((s) => ({ ...s, status: "completed" }));
      showDownloadCompleteToast(toast, router, {
        label: "Album downloaded",
        description: `${songs.length} songs available offline`,
      });
    } catch (e: any) {
      setDlAllState((s) => ({ ...s, status: "failed", error: e.message }));
      toast.show({ label: "Download failed: " + e.message, variant: "danger" });
    }
  };

  const renderDlAllButton = () => {
    if (songs.length === 0) return null;
    if (dlAllState.status === "downloading") {
      return (
        <TouchableOpacity
          className="bg-primary rounded-full p-4"
          activeOpacity={0.8}
        >
          <View className="flex-row items-center justify-center">
            <Text className="text-white text-base font-bold mr-2">{dlAllState.progress}%</Text>
            <StyledIonicons name="cloud-download" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
      );
    }
    if (dlAllState.status === "completed") {
      return (
        <TouchableOpacity
          className="bg-green-500 rounded-full p-4"
          activeOpacity={0.8}
        >
          <StyledIonicons name="checkmark-circle" size={24} color="#fff" />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        onPress={handleDownloadAll}
        className="bg-neutral-800 rounded-full p-4"
        activeOpacity={0.8}
      >
        <StyledIonicons name="cloud-download-outline" size={24} color="#fff" />
      </TouchableOpacity>
    );
  };

  if (albumLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <LoadingSpinner size="lg" />
        <Text className="text-neutral-400 mt-4">Loading album...</Text>
      </View>
    );
  }

  if (!album) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Text className="text-foreground text-lg">Album not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 p-2 bg-primary rounded-lg"
        >
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const releaseYear = album.releaseDate
    ? new Date(album.releaseDate).getFullYear().toString()
    : null;
  const typeLabel = formatAlbumType(album.type);
  const totalDuration = songs.reduce((acc, song) => acc + song.duration, 0);
  const hours = Math.floor(totalDuration / 3600);
  const minutes = Math.floor((totalDuration % 3600) / 60);

  const renderSongItem = ({ item, index }: { item: Song; index: number }) => {
    const isCurrentSong = playingSong?.id === item.id;

    return (
      <TouchableOpacity
        onPress={() => handlePlaySong(item)}
        onLongPress={() => {
          setActionSong(item);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        className={`flex-row items-center px-4 py-3 mx-2 mb-2 rounded-xl ${
          isCurrentSong ? "bg-neutral-900" : "bg-transparent"
        }`}
        activeOpacity={0.7}
      >
        <Text
          className={`w-8 text-base font-semibold ${
            isCurrentSong ? "text-primary" : "text-neutral-500"
          }`}
        >
          {index + 1}
        </Text>
        <View className="relative">
          <Image
            uri={getSongCoverUrl(item) ?? album.coverUrl}
            variant="album"
            className="w-14 h-14 rounded-lg"
            contentFit="cover"
          />
          {isCurrentSong && isPlaying && (
            <View className="absolute inset-0 bg-black/40 rounded-lg items-center justify-center">
              <StyledIonicons name="pulse" size={20} color="#ff0000" />
            </View>
          )}
        </View>
        <View className="ml-3 flex-1">
          <Text
            className={`text-base font-semibold leading-loose ${
              isCurrentSong ? "text-primary" : "text-white"
            }`}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <View className="flex-row items-center mt-1">
            {item.isPremium && (
              <View className="bg-amber-500/20 px-2 py-0.5 rounded mr-2">
                <Text className="text-amber-500 text-xs font-bold">
                  PREMIUM
                </Text>
              </View>
            )}
            <Text
              className="text-neutral-400 text-sm flex-1 leading-loose"
              numberOfLines={1}
            >
              {item.artist}
            </Text>
          </View>
        </View>
        <Text className="text-neutral-500 text-sm mr-2 leading-loose">
          {formatDuration(item.duration)}
        </Text>
        <TouchableOpacity
          onPress={() => {
            toggleLike(item);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          className="p-2"
        >
          <StyledIonicons
            name={isLikedSong(item.id) ? "heart" : "heart-outline"}
            size={24}
            color={isLikedSong(item.id) ? "#ff0000" : "#737373"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setActionSong(item);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          className="p-2"
        >
          <StyledIonicons
            name="ellipsis-horizontal"
            size={24}
            color="#737373"
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT / 2],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.3, 1],
    extrapolate: "clamp",
  });

  const imageTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT / 2],
    extrapolate: "clamp",
  });

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingBottom: insets.bottom }}
    >
      <StatusBar barStyle="light-content" />

      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: HEADER_HEIGHT,
          transform: [{ translateY: imageTranslateY }, { scale: imageScale }],
        }}
      >
        {album.coverUrl ? (
          <Image
            uri={album.coverUrl}
            variant="album"
            className="w-full h-full"
            contentFit="cover"
          />
        ) : albumArtistImageUrl ? (
          <Image
            uri={albumArtistImageUrl}
            variant="artist"
            className="w-full h-full"
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={["#ff6666", "#ff0000", "#cc0000"]}
            className="w-full h-full items-center justify-center"
          >
            <StyledIonicons name="disc" size={100} color="white" />
          </LinearGradient>
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.7)", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          backgroundColor: `rgba(0, 0, 0, ${headerOpacity})`,
        }}
      >
        <SafeAreaView edges={["top"]}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center rounded-full bg-black/50"
            >
              <StyledIonicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Animated.Text
              style={{ opacity: headerOpacity }}
              className="text-white text-lg font-bold flex-1 text-center mx-2 leading-loose"
              numberOfLines={1}
            >
              {album.name}
            </Animated.Text>
            <TouchableOpacity
              onPress={handleShare}
              className="w-10 h-10 items-center justify-center rounded-full bg-black/50"
            >
              <StyledIonicons
                name="share-social-outline"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={{ height: HEADER_HEIGHT - 80 }} />

        <View className="px-6 py-4">
          {typeLabel && (
            <View className="self-start bg-black/60 rounded-full px-3 py-1 mb-3">
              <Text className="text-white text-xs font-bold uppercase">
                {typeLabel}
              </Text>
            </View>
          )}

          <Text
            className="text-white text-5xl font-black flex-1 mb-2 leading-loose"
            numberOfLines={2}
          >
            {album.name}
          </Text>

          {releaseYear && (
            <View className="flex-row items-center mb-4">
              <StyledIonicons
                name="calendar-outline"
                size={16}
                color="#a3a3a3"
              />
              <Text className="text-neutral-400 text-sm ml-2 font-medium leading-loose">
                Released {releaseYear}
              </Text>
            </View>
          )}

          <View className="flex-row gap-3 mb-6">
            <StatCard
              icon="musical-notes"
              value={songs.length.toString()}
              label="Songs"
            />
            <StatCard
              icon="time"
              value={
                songs.length > 0
                  ? hours > 0
                    ? `${hours}h ${minutes}m`
                    : `${minutes}m`
                  : "—"
              }
              label="Duration"
            />
            <StatCard icon="disc" value={typeLabel || "Release"} label="Type" />
          </View>

          <View className="flex-row items-center gap-3 mb-6">
            <TouchableOpacity
              onPress={handlePlayAll}
              disabled={songs.length === 0}
              className={`flex-1 rounded-full py-4 flex-row items-center justify-center ${
                songs.length === 0 ? "bg-neutral-800" : "bg-primary"
              }`}
              activeOpacity={0.8}
            >
              <StyledIonicons name="play" size={24} color="#fff" />
              <Text className="text-white text-base font-bold ml-2">Play</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShuffle}
              disabled={songs.length === 0}
              className="bg-neutral-800 rounded-full p-4"
              activeOpacity={0.8}
            >
              <StyledIonicons name="shuffle" size={24} color="#fff" />
            </TouchableOpacity>

            {renderDlAllButton()}

            <TouchableOpacity
              onPress={handleShare}
              className="bg-neutral-800 rounded-full p-4"
              activeOpacity={0.8}
            >
              <StyledIonicons
                name="share-social-outline"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {!!album.description && (
            <View className="mb-6 bg-neutral-900/50 rounded-2xl p-4 border border-neutral-800">
              <View className="flex-row items-center mb-2">
                <StyledIonicons
                  name="information-circle"
                  size={20}
                  color="#ff0000"
                />
                <Text className="text-white text-base font-bold ml-2">
                  About
                </Text>
              </View>
              <Text
                className="text-neutral-300 text-sm leading-loose"
                numberOfLines={isDescExpanded ? undefined : 3}
              >
                {album.description}
              </Text>
              {album.description.length > 100 && (
                <TouchableOpacity
                  onPress={() => setIsDescExpanded(!isDescExpanded)}
                  className="mt-3"
                >
                  <Text className="text-primary text-sm font-bold">
                    {isDescExpanded ? "Show less" : "Read more"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-2xl font-bold">Tracks</Text>
            <Text className="text-neutral-400 text-sm">
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </Text>
          </View>
        </View>

        {songs.length > 0 ? (
          songs.map((song, index) => (
            <React.Fragment key={song.id}>
              {renderSongItem({ item: song, index })}
            </React.Fragment>
          ))
        ) : (
          <View className="items-center py-10">
            <StyledIonicons name="disc-outline" size={48} color="#404040" />
            <Text className="text-neutral-500 mt-4 text-base">
              No songs in this release yet.
            </Text>
          </View>
        )}
      </Animated.ScrollView>

      <SongActionSheet
        song={actionSong}
        visible={!!actionSong}
        onClose={() => setActionSong(null)}
      />
    </View>
  );
}
