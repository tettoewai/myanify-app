import { LoadingView } from "@/components/LoadingSpinner";
import { SignInPrompt } from "@/components/auth/SignInPrompt";
import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { SongActionSheet } from "@/components/SongActionSheet";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { apiClient } from "@/lib/api";
import { formatSongFromApi } from "@/lib/song-format";
import { seeAllPath } from "@/lib/see-all-sections";
import { AppColors } from "@/lib/colors";
import { getSongCoverUrl } from "@/lib/song-cover";
import { Album, Artist, Genre, Playlist, Song } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { Card } from "heroui-native";
import { useCallback, useMemo, useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FEATURED_CARD_HEIGHT = 208;

interface HomeData {
  featuredSong: any | null;
  trendingSongs: any[];
  newReleases: any[];
  popularArtists: Artist[];
  featuredAlbums: Album[];
  featuredPlaylists: Playlist[];
  genres: Genre[];
  recentlyPlayed: any[];
}

// Skeleton loading components
const SectionSkeleton = () => (
  <View className="px-4 mb-6">
    <View className="flex-row justify-between mb-3">
      <View className="h-6 w-32 bg-muted-foreground/20 rounded-lg" />
      <View className="h-4 w-16 bg-muted-foreground/20 rounded-lg" />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-3">
        {[1, 2, 3, 4].map((i) => (
          <View key={i} className="w-[160px]">
            <View className="w-[160px] h-[160px] bg-muted-foreground/20 rounded-2xl" />
            <View className="h-4 w-32 bg-muted-foreground/20 rounded-lg mt-2" />
            <View className="h-3 w-24 bg-muted-foreground/20 rounded-lg mt-1" />
          </View>
        ))}
      </View>
    </ScrollView>
  </View>
);

const HomeSkeleton = () => (
  <View className="flex-1 bg-background">
    <View className="px-4 pt-12 pb-4">
      <View className="h-7 w-40 bg-muted-foreground/20 rounded-lg mb-2" />
      <View className="h-4 w-56 bg-muted-foreground/20 rounded-lg" />
    </View>
    <View className="flex-row gap-3 px-4 mb-6">
      <View className="flex-1 h-24 bg-muted-foreground/20 rounded-2xl" />
      <View className="flex-1 h-24 bg-muted-foreground/20 rounded-2xl" />
    </View>
    <SectionSkeleton />
    <SectionSkeleton />
    <SectionSkeleton />
  </View>
);

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong, playFromContext, currentSong } = usePlayer();
  const [actionSong, setActionSong] = useState<Song | null>(null);
  const { isLikedSong, toggleLike } = useLikeSong();
  const { token, isLoading: authLoading } = useAuth();

  const {
    data: homeData,
    isLoading: homeLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<HomeData>({
    queryKey: ["home"],
    queryFn: () => apiClient.get("/home"),
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const greeting = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const timeLabel = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    if (hour >= 5 && hour < 9)
      return {
        title: "Good morning",
        subtitle: `${timeLabel} · Ease into the day`,
      };
    if (hour >= 9 && hour < 12)
      return {
        title: "Good morning",
        subtitle: `${timeLabel} · Discover your next favorite`,
      };
    if (hour >= 12 && hour < 14)
      return {
        title: "Good afternoon",
        subtitle: `${timeLabel} · Take a break and press play`,
      };
    if (hour >= 14 && hour < 17)
      return {
        title: "Good afternoon",
        subtitle: `${timeLabel} · Keep the energy going`,
      };
    if (hour >= 17 && hour < 20)
      return {
        title: "Good evening",
        subtitle: `${timeLabel} · Unwind with your favorites`,
      };
    if (hour >= 20 && hour < 22)
      return {
        title: "Good evening",
        subtitle: `${timeLabel} · Settle in and enjoy`,
      };
    if (hour >= 22 || hour < 1)
      return {
        title: "Good night",
        subtitle: `${timeLabel} · Wind down with something mellow`,
      };
    return {
      title: "Hey, night owl",
      subtitle: `${timeLabel} · Late-night listening hits different`,
    };
  }, []);

  const handlePlaySong = useCallback(
    (song: Song, context?: Song[]) => {
      if (context && context.length > 1) {
        void playFromContext(song, context, "playlist");
      } else {
        void playSong(song);
      }
      router.push(`/song/${song.id}` as Href);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [playSong, playFromContext, router],
  );

  const handleToggleLike = useCallback(
    (song: Song, e?: any) => {
      e?.stopPropagation();
      toggleLike(song);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [toggleLike],
  );

  const handleLongPressSong = useCallback((song: Song) => {
    setActionSong(song);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  if (authLoading) {
    return <LoadingView />;
  }

  if (!token) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <SignInPrompt
          title="Sign in to listen"
          description="Browse Myanmar music, build playlists, and enjoy synchronized lyrics."
          compact
        />
      </SafeAreaView>
    );
  }

  if (homeLoading) {
    return <HomeSkeleton />;
  }

  if (error || !homeData) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="cloud-offline-outline" size={64} color="#ff0000" />
          <Text className="text-foreground text-xl font-bold mt-4 text-center">
            Oops! Something went wrong
          </Text>
          <Text className="text-muted-foreground text-center mt-2">
            {error?.message || "Failed to load home content"}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="mt-6 bg-primary px-6 py-3 rounded-full"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const featuredSong: Song | null = homeData.featuredSong
    ? formatSongFromApi(homeData.featuredSong)
    : null;
  const trendingSongs: Song[] = (homeData.trendingSongs || []).map(
    formatSongFromApi,
  );
  const newReleases: Song[] = (homeData.newReleases || []).map(
    formatSongFromApi,
  );
  const recentlyPlayed: Song[] = (homeData.recentlyPlayed || []).map(
    formatSongFromApi,
  );
  const popularArtists: Artist[] = homeData.popularArtists || [];
  const featuredAlbums: Album[] = homeData.featuredAlbums || [];
  const featuredPlaylists: Playlist[] = homeData.featuredPlaylists || [];
  const genres: Genre[] = homeData.genres || [];

  const refreshControl = (
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={refetch}
      tintColor="#ff0000"
      colors={["#ff0000"]}
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: currentSong ? 80 : 20 }}
      >
        {/* Header with gradient */}
        <LinearGradient
          colors={["rgba(255, 0, 0, 0.15)", "rgba(0, 0, 0, 0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            marginTop: -insets.top,
            paddingTop: insets.top + 10,
          }}
          className="px-4"
        >
          <View className="flex-row justify-between items-start mt-10 mb-5 px-3">
            <View className="flex-1 pr-4">
              <Text className="text-2xl font-bold text-foreground">
                {greeting.title}
              </Text>
              <Text className="text-sm text-muted-foreground mt-1">
                {greeting.subtitle}
              </Text>
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="bg-white/10 p-2.5 rounded-full"
                accessibilityLabel="Notifications"
              >
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color={AppColors.iconOnDark}
                />
              </TouchableOpacity>
              {/* <TouchableOpacity
                className="bg-white/10 p-2.5 rounded-full"
                onPress={() => router.push("/(tabs)/setting")}
                accessibilityLabel="Settings"
              >
                <Ionicons name="settings-outline" size={22} color="white" />
              </TouchableOpacity> */}
            </View>
          </View>

          {/* Quick Access Cards */}
          <View className="flex-row gap-3 mb-2">
            <TouchableOpacity
              className="flex-1 bg-red-600/20 border border-red-500/30 rounded-2xl p-4"
              onPress={() => router.push("/liked-songs")}
              activeOpacity={0.7}
            >
              <View className="flex-row justify-between items-start">
                <View>
                  <Ionicons name="heart" size={24} color="#ff0000" />
                  <Text className="text-foreground font-bold text-base mt-2">
                    Liked Songs
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={AppColors.iconMuted} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-purple-600/20 border border-purple-500/30 rounded-2xl p-4"
              onPress={() => router.push("/(tabs)/library")}
              activeOpacity={0.7}
            >
              <View className="flex-row justify-between items-start">
                <View>
                  <Ionicons name="library" size={24} color="#8b5cf6" />
                  <Text className="text-foreground font-bold text-base mt-2">
                    Library
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={AppColors.iconMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View className="pt-4 gap-y-7">
          {/* Featured Song Hero */}
          {featuredSong && (
            <View className="px-4">
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handlePlaySong(featuredSong, trendingSongs)}
                onLongPress={() => handleLongPressSong(featuredSong)}
                accessibilityLabel={`Play featured song: ${featuredSong.title}`}
              >
                <View
                  style={{
                    height: FEATURED_CARD_HEIGHT,
                    borderRadius: 24,
                    overflow: "hidden",
                    ...(Platform.OS === "ios"
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.25,
                          shadowRadius: 8,
                        }
                      : { elevation: 6 }),
                  }}
                >
                  <Image
                    uri={
                      getSongCoverUrl(featuredSong) ??
                      "https://placehold.co/400x400/333/ff0000?text=No+Cover"
                    }
                    variant="album"
                    style={{ width: "100%", height: FEATURED_CARD_HEIGHT }}
                    contentFit="cover"
                    transition={200}
                  />
                  <LinearGradient
                    colors={[
                      "transparent",
                      "rgba(0,0,0,0.5)",
                      "rgba(0,0,0,0.85)",
                    ]}
                    locations={[0, 0.45, 1]}
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
                  <View
                    style={{
                      position: "absolute",
                      top: 16,
                      left: 12,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <View className="bg-primary px-2.5 py-0.5 rounded-full flex-row items-center gap-1">
                      <View className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <Text className="text-white text-xs font-bold">
                        Featured Today
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                    }}
                  >
                    <TouchableOpacity
                      onPress={(e) => handleToggleLike(featuredSong, e)}
                      style={{
                        backgroundColor: "rgba(0,0,0,0.5)",
                        borderRadius: 999,
                        padding: 8,
                      }}
                      accessibilityLabel={
                        isLikedSong(featuredSong.id)
                          ? "Remove from liked"
                          : "Add to liked"
                      }
                    >
                      <Ionicons
                        name={
                          isLikedSong(featuredSong.id)
                            ? "heart"
                            : "heart-outline"
                        }
                        size={20}
                        color={
                          isLikedSong(featuredSong.id) ? "#ff0000" : "#fff"
                        }
                      />
                    </TouchableOpacity>
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      left: 16,
                      right: 16,
                      bottom: 16,
                      flexDirection: "row",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 18,
                          fontWeight: "700",
                          lineHeight: 28,
                        }}
                        numberOfLines={1}
                      >
                        {featuredSong.title}
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.7)",
                          fontSize: 14,
                          lineHeight: 22,
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {featuredSong.artist ||
                          featuredSong.artists
                            ?.map((a) => a.artist.name)
                            .join(", ") ||
                          "Unknown Artist"}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: "#ff0000",
                        borderRadius: 999,
                        padding: 12,
                        ...(Platform.OS === "ios"
                          ? {
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.3,
                              shadowRadius: 4,
                            }
                          : { elevation: 4 }),
                      }}
                    >
                      <Ionicons name="play" size={22} color="white" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Trending Now */}
          {trendingSongs.length > 0 && (
            <Section
              title="Trending Now"
              subtitle="Most played songs"
              icon="trending-up"
              iconColor="#ff0000"
              onSeeAll={() => router.push(seeAllPath("trending"))}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}
              >
                {trendingSongs.map((song, index) => (
                  <TouchableOpacity
                    key={song.id}
                    onPress={() => handlePlaySong(song, trendingSongs)}
                    onLongPress={() => handleLongPressSong(song)}
                    activeOpacity={0.8}
                    className="w-[160px]"
                  >
                    <View className="relative">
                      <Image
                        uri={
                          getSongCoverUrl(song) ??
                          "https://placehold.co/160x160/333/ff0000?text=No+Cover"
                        }
                        variant="album"
                        className="w-[160px] h-[160px] rounded-2xl"
                        contentFit="cover"
                        transition={200}
                      />
                      <View className="absolute top-2 left-2 bg-black/60 rounded-full w-7 h-7 items-center justify-center">
                        <Text className="text-white text-xs font-bold">
                          {index + 1}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => handleToggleLike(song, e)}
                        className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
                      >
                        <Ionicons
                          name={
                            isLikedSong(song.id) ? "heart" : "heart-outline"
                          }
                          size={16}
                          color={isLikedSong(song.id) ? "#ff0000" : "#fff"}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text
                      className="text-foreground font-bold text-sm mt-2 leading-loose"
                      numberOfLines={1}
                    >
                      {song.title}
                    </Text>
                    <Text
                      className="text-muted-foreground text-xs mt-0.5 leading-loose"
                      numberOfLines={1}
                    >
                      {song.artists.map((a: any) => a.artist.name).join(", ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Section>
          )}

          {/* Recently Played */}
          {recentlyPlayed.length > 0 && (
            <Section
              title="Recently Played"
              subtitle="Pick up where you left off"
              icon="time"
              iconColor="#ff0000"
              onSeeAll={() => router.push(seeAllPath("recently-played"))}
            >
              <View className="gap-2.5">
                {recentlyPlayed.slice(0, 4).map((song) => (
                  <TouchableOpacity
                    key={song.id}
                    onPress={() => handlePlaySong(song, recentlyPlayed)}
                    onLongPress={() => handleLongPressSong(song)}
                    activeOpacity={0.7}
                    className="flex-row items-center gap-3 bg-card/50 rounded-xl p-3"
                  >
                    <Image
                      uri={
                        getSongCoverUrl(song) ??
                        "https://placehold.co/48x48/333/ff0000?text=No+Cover"
                      }
                      variant="album"
                      className="w-12 h-12 rounded-xl"
                      contentFit="cover"
                      transition={200}
                    />
                    <View className="flex-1 min-w-0">
                      <Text
                        className="text-foreground font-semibold text-sm leading-loose"
                        numberOfLines={1}
                      >
                        {song.title}
                      </Text>
                      <Text
                        className="text-muted-foreground text-xs mt-0.5 leading-loose"
                        numberOfLines={1}
                      >
                        {song.artists.map((a: any) => a.artist.name).join(", ")}
                      </Text>
                    </View>
                    <View className="bg-white/10 rounded-full p-2">
                      <Ionicons name="play" size={16} color="white" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
          )}

          {/* New Releases */}
          {newReleases.length > 0 && (
            <Section
              title="New Releases"
              subtitle="Fresh music just dropped"
              icon="flame"
              iconColor="#ff0000"
              onSeeAll={() => router.push(seeAllPath("new-releases"))}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 4, gap: 16 }}
              >
                {newReleases.map((song) => (
                  <TouchableOpacity
                    key={song.id}
                    onPress={() => handlePlaySong(song, newReleases)}
                    onLongPress={() => handleLongPressSong(song)}
                    activeOpacity={0.8}
                    className="w-[148px]"
                  >
                    <Card variant="transparent" className="p-0">
                      <View className="relative shadow-lg">
                        <Image
                          uri={
                            getSongCoverUrl(song) ??
                            "https://placehold.co/148x148/333/ff0000?text=No+Cover"
                          }
                          variant="album"
                          className="w-[148px] h-[148px] rounded-2xl"
                          contentFit="cover"
                          transition={200}
                        />
                        <TouchableOpacity
                          onPress={(e) => handleToggleLike(song, e)}
                          className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
                        >
                          <Ionicons
                            name={
                              isLikedSong(song.id) ? "heart" : "heart-outline"
                            }
                            size={16}
                            color={isLikedSong(song.id) ? "#ff0000" : "#fff"}
                          />
                        </TouchableOpacity>
                      </View>
                      <Card.Body className="p-0 mt-2">
                        <Card.Title
                          className="text-foreground text-sm font-bold text-center leading-loose"
                          numberOfLines={1}
                        >
                          {song.title}
                        </Card.Title>
                        <Card.Description
                          className="text-muted-foreground text-xs text-center leading-loose"
                          numberOfLines={1}
                        >
                          {song.artists
                            .map((a: any) => a.artist.name)
                            .join(", ")}
                        </Card.Description>
                      </Card.Body>
                    </Card>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Section>
          )}

          {/* Browse Genres */}
          {genres.length > 0 && (
            <Section
              title="Browse Genres"
              subtitle="Find your sound"
              icon="musical-note"
              iconColor="#ff0000"
              onSeeAll={() => router.push(seeAllPath("genres"))}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}
              >
                {genres.map((genre) => (
                  <TouchableOpacity
                    key={genre.id}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/search",
                        params: { genreId: genre.id },
                      } as any)
                    }
                    activeOpacity={0.8}
                    className="w-[120px] h-[80px]"
                  >
                    <View className="w-full h-full rounded-2xl overflow-hidden">
                      <Image
                        uri={
                          genre.imageUrl ||
                          "https://placehold.co/120x80/333/ff0000?text=Genre"
                        }
                        variant="album"
                        className="w-full h-full"
                        contentFit="cover"
                        transition={200}
                      />
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.7)"]}
                        className="absolute inset-0 justify-end p-2"
                      >
                        <Text
                          className="text-white font-bold text-xs text-center leading-loose"
                          numberOfLines={1}
                        >
                          {genre.name}
                        </Text>
                      </LinearGradient>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Section>
          )}

          {/* Popular Artists */}
          {popularArtists.length > 0 && (
            <Section
              title="Popular Artists"
              subtitle="Most listened this month"
              icon="mic"
              iconColor="#ff0000"
              onSeeAll={() => router.push(seeAllPath("artists"))}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 4, gap: 20 }}
              >
                {popularArtists.map((artist) => (
                  <TouchableOpacity
                    key={artist.id}
                    onPress={() =>
                      router.push({
                        pathname: "/artist/[id]",
                        params: { id: artist.id },
                      })
                    }
                    activeOpacity={0.8}
                    className="items-center w-[110px]"
                  >
                    <View className="relative shadow-lg">
                      <Image
                        uri={
                          artist.imageUrl ||
                          "https://placehold.co/110x110/333/ff0000?text=Artist"
                        }
                        variant="artist"
                        className="w-[110px] h-[110px] rounded-full border-2 border-white/10"
                        contentFit="cover"
                        transition={200}
                      />
                      <View className="absolute bottom-0 right-0 bg-primary rounded-full p-1">
                        <Ionicons name="checkmark" size={14} color="white" />
                      </View>
                    </View>
                    <Text
                      className="text-foreground font-bold text-sm mt-2.5 text-center leading-loose"
                      numberOfLines={1}
                    >
                      {artist.name}
                    </Text>
                    {!!artist.monthlyListeners && (
                      <Text className="text-muted-foreground text-xs text-center leading-loose">
                        {artist.monthlyListeners >= 1000
                          ? `${(artist.monthlyListeners / 1000).toFixed(0)}K`
                          : artist.monthlyListeners}{" "}
                        listeners
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Section>
          )}

          {/* Featured Playlists */}
          {featuredPlaylists.length > 0 && (
            <Section
              title="Featured Playlists"
              subtitle="Curated for you"
              icon="list"
              iconColor="#ff0000"
              onSeeAll={() => router.push(seeAllPath("playlists"))}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 4, gap: 16 }}
              >
                {featuredPlaylists.map((playlist) => {
                  const songCovers: string[] = (playlist.songs || [])
                    .slice(0, 4)
                    .map((ps: any) => getSongCoverUrl(ps.song) ?? "")
                    .filter(Boolean);

                  return (
                    <TouchableOpacity
                      key={playlist.id}
                      onPress={() =>
                        router.push({
                          pathname: "/playlist/[id]",
                          params: { id: playlist.id },
                        })
                      }
                      activeOpacity={0.8}
                      className="w-[160px]"
                    >
                      <View className="w-[160px] h-[160px] rounded-2xl overflow-hidden bg-card">
                        {songCovers.length >= 4 ? (
                          <View className="flex-row flex-wrap w-full h-full">
                            {songCovers.slice(0, 4).map((url, i) => (
                              <Image
                                key={i}
                                uri={
                                  url ||
                                  "https://placehold.co/80x80/333/ff0000?text=No+Cover"
                                }
                                variant="album"
                                className="w-[80px] h-[80px]"
                                contentFit="cover"
                                transition={200}
                              />
                            ))}
                          </View>
                        ) : songCovers.length > 0 ? (
                          <Image
                            uri={songCovers[0]}
                            variant="album"
                            className="w-full h-full"
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <View className="w-full h-full bg-card items-center justify-center">
                            <Ionicons
                              name="musical-notes"
                              size={40}
                              color="#888"
                            />
                          </View>
                        )}
                        <View className="absolute bottom-2 right-2 bg-primary rounded-full p-2">
                          <Ionicons name="play" size={16} color="white" />
                        </View>
                      </View>
                      <Text
                        className="text-foreground font-bold text-sm mt-2 leading-loose"
                        numberOfLines={1}
                      >
                        {playlist.name}
                      </Text>
                      <Text
                        className="text-muted-foreground text-xs mt-0.5 leading-loose"
                        numberOfLines={1}
                      >
                        {(playlist.songs || []).length} songs
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Section>
          )}

          {/* Featured Albums */}
          {featuredAlbums.length > 0 && (
            <Section
              title="Albums & Releases"
              subtitle="Latest collections"
              icon="disc"
              iconColor="#ff0000"
              onSeeAll={() => router.push(seeAllPath("albums"))}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 4, gap: 16 }}
              >
                {featuredAlbums.map((album) => (
                  <TouchableOpacity
                    key={album.id}
                    onPress={() =>
                      router.push({
                        pathname: "/album/[id]",
                        params: { id: album.id },
                      })
                    }
                    activeOpacity={0.8}
                    className="w-[160px]"
                  >
                    <View className="relative shadow-xl">
                      <Image
                        uri={
                          album.coverUrl ||
                          album.artistImageUrl ||
                          "https://placehold.co/160x160/333/ff0000?text=No+Cover"
                        }
                        variant="album"
                        className="w-[160px] h-[160px] rounded-2xl"
                        contentFit="cover"
                        transition={200}
                      />
                      {album.type && (
                        <View className="absolute top-2 left-2 bg-black/60 rounded-full px-2 py-0.5">
                          <Text className="text-white text-xs font-bold uppercase">
                            {album.type === "SINGLE"
                              ? "Single"
                              : album.type === "EP"
                                ? "EP"
                                : "Album"}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      className="text-foreground font-bold text-sm mt-2 leading-loose"
                      numberOfLines={1}
                    >
                      {album.name}
                    </Text>
                    {album._count && (
                      <Text className="text-muted-foreground text-xs leading-loose">
                        {album._count.songs}{" "}
                        {album._count.songs === 1 ? "song" : "songs"}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Section>
          )}
        </View>
      </ScrollView>

      <SongActionSheet
        song={actionSong}
        visible={!!actionSong}
        onClose={() => setActionSong(null)}
      />
    </SafeAreaView>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  children: React.ReactNode;
  className?: string;
  onSeeAll?: () => void;
}

function Section({
  title,
  subtitle,
  icon,
  iconColor = "#ff0000",
  children,
  className,
  onSeeAll,
}: SectionProps) {
  return (
    <View className={className}>
      <View className="flex-row items-center justify-between mb-3 px-4">
        <View className="flex-row items-center gap-2.5 flex-1">
          {icon && (
            <View
              className="p-1.5 rounded-full"
              style={{ backgroundColor: `${iconColor}20` }}
            >
              <Ionicons name={icon as any} size={20} color={iconColor} />
            </View>
          )}
          <View className="flex-1">
            <Text className="text-xl font-bold text-foreground">{title}</Text>
            {subtitle && (
              <Text className="text-xs text-muted-foreground mt-0.5">
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {onSeeAll && (
          <TouchableOpacity
            onPress={onSeeAll}
            className="flex-row items-center gap-1"
            accessibilityLabel="See all"
          >
            <Text className="text-primary text-sm font-semibold">See All</Text>
            <Ionicons name="chevron-forward" size={16} color="#ff0000" />
          </TouchableOpacity>
        )}
      </View>
      <View>{children}</View>
    </View>
  );
}
