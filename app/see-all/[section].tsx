import { RequireAuth } from "@/components/auth/RequireAuth";
import { SongActionSheet } from "@/components/SongActionSheet";
import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { useSeeAllSection } from "@/hooks/useSeeAllSection";
import {
  formatAlbumType,
  SEE_ALL_SECTION_META,
  type SeeAllSection,
} from "@/lib/see-all-sections";
import type { Album, Artist, Genre, Playlist, Song } from "@/lib/types";
import { getSongCoverUrl } from "@/lib/song-cover";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);
const { width } = Dimensions.get("window");
const GRID_GAP = 12;
const GRID_PADDING = 16;
const GRID_COLUMNS = 2;
const GRID_ITEM_WIDTH =
  (width - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getArtistNames(song: Song): string {
  return (
    song.artist ||
    song.artists?.map((a) => a.artist?.name).filter(Boolean).join(", ") ||
    "Unknown Artist"
  );
}

function getSongCover(song: Song): string {
  return (
    getSongCoverUrl(song) ??
    "https://placehold.co/160x160/333/ff0000?text=No+Cover"
  );
}

function PlaylistGridCover({ playlist }: { playlist: Playlist }) {
  const songCovers = (playlist.songs || [])
    .slice(0, 4)
    .map((entry: any) => getSongCoverUrl(entry.song) ?? "")
    .filter(Boolean);

  if (songCovers.length >= 4) {
    return (
      <View className="flex-row flex-wrap w-full h-full">
        {songCovers.slice(0, 4).map((url, index) => (
          <Image
            key={index}
            uri={url}
            variant="album"
            className="w-1/2 h-1/2"
            contentFit="cover"
          />
        ))}
      </View>
    );
  }

  if (songCovers.length > 0) {
    return (
      <Image
        uri={songCovers[0]}
        variant="album"
        className="w-full h-full"
        contentFit="cover"
      />
    );
  }

  if (playlist.coverUrl) {
    return (
      <Image
        uri={playlist.coverUrl}
        variant="playlist"
        className="w-full h-full"
        contentFit="cover"
      />
    );
  }

  return (
    <View className="w-full h-full bg-card items-center justify-center">
      <StyledIonicons name="musical-notes" size={36} color="#888" />
    </View>
  );
}

export default function SeeAllPage() {
  return (
    <RequireAuth>
      <SeeAllScreen />
    </RequireAuth>
  );
}

function SeeAllScreen() {
  const { section: sectionParam } = useLocalSearchParams<{ section: string }>();
  const router = useRouter();
  const { playFromContext, currentSong } = usePlayer();
  const { isLikedSong, toggleLike } = useLikeSong();
  const insets = useSafeAreaInsets();
  const [actionSong, setActionSong] = useState<Song | null>(null);

  const { section, data, isLoading, error, itemCount } =
    useSeeAllSection(sectionParam);

  const songs = useMemo(() => data?.songs ?? [], [data?.songs]);

  const handlePlaySong = (song: Song, context: Song[]) => {
    void playFromContext(song, context, "playlist");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!section) {
    return (
      <View className="flex-1 justify-center items-center bg-background px-6">
        <Text className="text-foreground text-lg">Section not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 px-4 py-2 bg-primary rounded-lg"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }


  const renderSongRow = (song: Song, index: number) => {
    const isPlaying = currentSong?.id === song.id;

    return (
      <TouchableOpacity
        onPress={() => handlePlaySong(song, songs)}
        onLongPress={() => {
          setActionSong(song);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        activeOpacity={0.8}
        className={`flex-row items-center mb-2 px-3 py-3 rounded-xl ${
          isPlaying ? "bg-primary/10 border border-primary/30" : "bg-card/50"
        }`}
      >
        <Text className="text-muted-foreground text-sm w-7 text-center">
          {index + 1}
        </Text>
        <Image
          uri={getSongCover(song)}
          variant="album"
          className="w-12 h-12 rounded-lg ml-2"
          contentFit="cover"
        />
        <View className="flex-1 ml-3 min-w-0">
          <Text
            className={`font-semibold text-base leading-loose ${
              isPlaying ? "text-primary" : "text-foreground"
            }`}
            numberOfLines={1}
          >
            {song.title}
          </Text>
          <Text
            className="text-muted-foreground text-sm mt-0.5 leading-loose"
            numberOfLines={1}
          >
            {getArtistNames(song)}
          </Text>
        </View>
        <Text className="text-muted-foreground text-xs mr-2 leading-loose">
          {formatDuration(song.duration)}
        </Text>
        <TouchableOpacity
          onPress={() => {
            toggleLike(song);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          className="p-2"
        >
          <StyledIonicons
            name={isLikedSong(song.id) ? "heart" : "heart-outline"}
            size={20}
            color={isLikedSong(song.id) ? "#ff0000" : "#a3a3a3"}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const emptyCopy: Record<
      SeeAllSection,
      { title: string; subtitle: string; icon: string }
    > = {
      trending: {
        title: "No trending songs yet",
        subtitle: "Check back soon for what's hot",
        icon: "trending-up-outline",
      },
      "recently-played": {
        title: "No recently played songs yet",
        subtitle: "Start listening and your history will show up here",
        icon: "time-outline",
      },
      "new-releases": {
        title: "No new releases yet",
        subtitle: "Fresh music will appear here when it's published",
        icon: "flame-outline",
      },
      genres: {
        title: "No genres found",
        subtitle: "Genres will appear here once they're added",
        icon: "musical-note-outline",
      },
      artists: {
        title: "No artists found",
        subtitle: "Artists will appear here once they're added",
        icon: "mic-outline",
      },
      playlists: {
        title: "No playlists found",
        subtitle: "Public playlists will appear here when available",
        icon: "list-outline",
      },
      albums: {
        title: "No albums found",
        subtitle: "Albums and releases will appear here when available",
        icon: "disc-outline",
      },
    };

    const copy = emptyCopy[section];

    return (
      <View className="items-center py-16 px-8">
        <StyledIonicons name={copy.icon as any} size={56} color="#404040" />
        <Text className="text-foreground text-lg font-semibold mt-4 text-center">
          {copy.title}
        </Text>
        <Text className="text-muted-foreground text-sm mt-2 text-center">
          {copy.subtitle}
        </Text>
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View className="py-20 items-center">
          <ActivityIndicator size="large" color="#ff0000" />
          <Text className="text-muted-foreground mt-4">Loading...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="items-center py-16 px-8">
          <StyledIonicons name="cloud-offline-outline" size={56} color="#ff0000" />
          <Text className="text-foreground text-lg font-semibold mt-4 text-center">
            Failed to load content
          </Text>
          <Text className="text-muted-foreground text-sm mt-2 text-center">
            {error.message}
          </Text>
        </View>
      );
    }

    if (data?.type === "songs") {
      if (songs.length === 0) return renderEmptyState();
      return (
        <View className="px-4">
          {songs.map((song, index) => (
            <React.Fragment key={song.id}>{renderSongRow(song, index)}</React.Fragment>
          ))}
        </View>
      );
    }

    if (data?.type === "genres") {
      const genres = data.genres ?? [];
      if (genres.length === 0) return renderEmptyState();

      return (
        <View
          className="flex-row flex-wrap px-4"
          style={{ gap: GRID_GAP }}
        >
          {genres.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/search",
                  params: { genreId: item.id },
                } as any)
              }
              activeOpacity={0.85}
              style={{ width: GRID_ITEM_WIDTH, height: GRID_ITEM_WIDTH }}
              className="rounded-2xl overflow-hidden"
            >
              <Image
                uri={
                  item.imageUrl ||
                  "https://placehold.co/200x200/333/ff0000?text=Genre"
                }
                variant="album"
                className="w-full h-full"
                contentFit="cover"
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.75)"]}
                className="absolute inset-0 justify-end p-3"
              >
                <Text
                  className="text-white font-bold text-sm leading-loose"
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                {!!item.description && (
                  <Text
                    className="text-white/70 text-xs mt-1 leading-loose"
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (data?.type === "artists") {
      const artists = data.artists ?? [];
      if (artists.length === 0) return renderEmptyState();

      return (
        <View
          className="flex-row flex-wrap px-4"
          style={{ gap: GRID_GAP }}
        >
          {artists.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() =>
                router.push({
                  pathname: "/artist/[id]",
                  params: { id: item.id },
                })
              }
              activeOpacity={0.85}
              style={{ width: (width - GRID_PADDING * 2 - GRID_GAP * 2) / 3 }}
              className="items-center"
            >
              <Image
                uri={
                  item.imageUrl ||
                  "https://placehold.co/110x110/333/ff0000?text=Artist"
                }
                variant="artist"
                className="w-[96px] h-[96px] rounded-full border border-white/10"
                contentFit="cover"
              />
              <Text
                className="text-foreground font-semibold text-sm mt-2 text-center leading-loose"
                numberOfLines={2}
              >
                {item.name}
              </Text>
              {!!item.monthlyListeners && (
                <Text className="text-muted-foreground text-xs mt-0.5 text-center leading-loose">
                  {item.monthlyListeners >= 1000
                    ? `${(item.monthlyListeners / 1000).toFixed(0)}K`
                    : item.monthlyListeners}{" "}
                  listeners
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (data?.type === "albums") {
      const albums = data.albums ?? [];
      if (albums.length === 0) return renderEmptyState();

      return (
        <View
          className="flex-row flex-wrap px-4"
          style={{ gap: GRID_GAP }}
        >
          {albums.map((item) => {
            const typeLabel = formatAlbumType(item.type);
            const releaseYear = item.releaseDate
              ? new Date(item.releaseDate).getFullYear()
              : null;

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() =>
                  router.push({
                    pathname: "/album/[id]",
                    params: { id: item.id },
                  })
                }
                activeOpacity={0.85}
                style={{ width: GRID_ITEM_WIDTH }}
              >
                <View className="relative">
                  <Image
                    uri={
                      item.coverUrl ||
                      item.artistImageUrl ||
                      "https://placehold.co/160x160/333/ff0000?text=No+Cover"
                    }
                    variant="album"
                    className="w-full aspect-square rounded-2xl"
                    contentFit="cover"
                  />
                  {typeLabel && (
                    <View className="absolute top-2 left-2 bg-black/60 rounded-full px-2 py-0.5">
                      <Text className="text-white text-[10px] font-bold uppercase">
                        {typeLabel}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  className="text-foreground font-semibold text-sm mt-2 leading-loose"
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                {(releaseYear || item._count) && (
                  <Text className="text-muted-foreground text-xs mt-0.5 leading-loose">
                    {[
                      releaseYear,
                      item._count
                        ? `${item._count.songs} ${item._count.songs === 1 ? "song" : "songs"}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    if (data?.type === "playlists") {
      const playlists = data.playlists ?? [];
      if (playlists.length === 0) return renderEmptyState();

      return (
        <View
          className="flex-row flex-wrap px-4"
          style={{ gap: GRID_GAP }}
        >
          {playlists.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() =>
                router.push({
                  pathname: "/playlist/[id]",
                  params: { id: item.id },
                })
              }
              activeOpacity={0.85}
              style={{ width: GRID_ITEM_WIDTH }}
            >
              <View className="w-full aspect-square rounded-2xl overflow-hidden bg-card">
                <PlaylistGridCover playlist={item} />
                <View className="absolute bottom-2 right-2 bg-primary rounded-full p-2">
                  <StyledIonicons name="play" size={14} color="#fff" />
                </View>
              </View>
              <Text
                className="text-foreground font-semibold text-sm mt-2 leading-loose"
                numberOfLines={2}
              >
                {item.name}
              </Text>
              {!!item.description && (
                <Text
                  className="text-muted-foreground text-xs mt-0.5 leading-loose"
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    return null;
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingBottom: insets.bottom }}>
      <SafeAreaView edges={["top"]} className="bg-background">
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-card"
          >
            <StyledIonicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View className="ml-3 flex-1">
            <Text className="text-foreground text-lg font-bold">
              {section ? SEE_ALL_SECTION_META[section].title : "See All"}
            </Text>
            {section && (
              <Text className="text-muted-foreground text-xs mt-0.5">
                {SEE_ALL_SECTION_META[section].description}
                {!isLoading && ` • ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
              </Text>
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: currentSong ? 120 : 24 }}
      >
        {renderContent()}
      </ScrollView>

      <SongActionSheet
        song={actionSong}
        visible={!!actionSong}
        onClose={() => setActionSong(null)}
      />
    </View>
  );
}
