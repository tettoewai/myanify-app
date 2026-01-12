import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { apiClient } from "@/lib/api";
import { Album, Artist, Song } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Card } from "heroui-native";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Home() {
  const router = useRouter();
  const { playSong, setQueue, currentSong } = usePlayer();
  const { isLikedSong, toggleLike } = useLikeSong();
  const { token } = useAuth();

  const {
    data: songsData,
    isLoading: songsLoading,
    refetch: refetchSongs,
    isRefetching: isRefetchingSongs,
  } = useQuery({
    queryKey: ["songs", "recent"],
    queryFn: () => apiClient.get("/songs?limit=10&isPublished=true"),
    enabled: !!token,
  });

  const {
    data: artistsData,
    isLoading: artistsLoading,
    refetch: refetchArtists,
    isRefetching: isRefetchingArtists,
  } = useQuery({
    queryKey: ["artists", "top"],
    queryFn: () => apiClient.get("/artists?limit=10"),
    enabled: !!token,
  });

  const {
    data: albumsData,
    isLoading: albumsLoading,
    refetch: refetchAlbums,
    isRefetching: isRefetchingAlbums,
  } = useQuery({
    queryKey: ["albums", "new"],
    queryFn: () => apiClient.get("/albums?limit=10"),
    enabled: !!token,
  });

  const isLoading = songsLoading || artistsLoading || albumsLoading;
  const isRefreshing =
    isRefetchingSongs || isRefetchingArtists || isRefetchingAlbums;

  const onRefresh = useCallback(() => {
    refetchSongs();
    refetchArtists();
    refetchAlbums();
  }, [refetchSongs, refetchArtists, refetchAlbums]);

  // Dynamic greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    if (hour < 22) return "Good Evening";
    return "Good Night";
  }, []);

  // Get greeting icon
  const greetingIcon = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "sunny-outline";
    if (hour < 17) return "sunny";
    if (hour < 22) return "cloudy-outline";
    return "moon-outline";
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#ff0000" />
      </View>
    );
  }

  const rawSongs: any[] = songsData?.data || [];
  const artists: Artist[] = artistsData?.data || [];
  const albums: Album[] = albumsData?.data || [];

  // Transform songs to match our Song type
  const songs: Song[] = rawSongs.map((song: any) => ({
    id: song.id,
    title: song.title,
    coverUrl: song.coverUrl || song.album?.coverUrl || "",
    albumCoverUrl: song.album?.coverUrl || song.coverUrl || null,
    artists: song.artists || [],
    artist:
      song.artists?.map((a: any) => a.artist?.name || a.name).join(", ") || "",
    album: song.album
      ? {
          id: song.album.id,
          name: song.album.name,
          coverUrl: song.album.coverUrl || "",
        }
      : undefined,
    duration: song.duration || 0,
    audioUrl: song.audioUrl || "",
    genre: song.genre?.name || "",
    lyrics:
      song.lyrics?.map((l: any) => ({ time: l.time, text: l.text })) || [],
    isPremium: song.isPremium || false,
  }));

  const handlePlaySong = (song: Song) => {
    // Set queue if not already set
    if (songs.length > 0) {
      setQueue(songs);
    }
    playSong(song);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#ff0000"
            colors={["#ff0000"]}
          />
        }
      >
        <View className={`flex-1 ${currentSong ? "pb-20" : ""}`}>
          {/* Enhanced Header with Gradient */}
          <LinearGradient
            colors={["rgba(255, 0, 0, 0.15)", "rgba(0, 0, 0, 0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            className="px-2 pt-6 pb-6"
          >
            <View className="flex-row justify-between items-center mb-6 px-3">
              <View className="flex-row items-center gap-1">
                {/* <View className="bg-red-600/20 p-3 rounded-full">
                  <Ionicons name={greetingIcon} size={28} color="#ff0000" />
                </View> */}
                <View>
                  <Text className="text-2xl font-bold text-foreground">
                    {greeting}
                  </Text>
                  <Text className="text-sm text-muted-foreground mt-1">
                    Ready to discover new music?
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="bg-white/10 p-2.5 rounded-full"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={22}
                    color="white"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-white/10 p-2.5 rounded-full"
                  onPress={() => {
                    router.push("/(tabs)/setting");
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons name="settings-outline" size={22} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Access Cards */}
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                className="flex-1 bg-linear-to-br from-red-600/20 to-red-800/20 border border-red-500/30 rounded-2xl p-4"
                onPress={() => {
                  router.push("/liked-songs");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Ionicons name="heart" size={24} color="#ff0000" />
                    <Text className="text-foreground font-bold text-base mt-2">
                      Liked Songs
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#888" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-linear-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-2xl p-4"
                onPress={() => {
                  router.push("/(tabs)/library");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Ionicons name="library" size={24} color="#8b5cf6" />
                    <Text className="text-foreground font-bold text-base mt-2">
                      Library
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#888" />
                </View>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View className="px-4">
            {/* New Releases with Enhanced Design */}
            <Section
              title="New Releases"
              subtitle="Fresh music for you"
              icon="flame"
              iconColor="#ff0000"
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-4">
                  {songs.map((song) => (
                    <TouchableOpacity
                      key={song.id}
                      onPress={() => handlePlaySong(song)}
                      activeOpacity={0.8}
                    >
                      <Card variant="transparent" className="w-[150px] p-0">
                        <View
                          className="relative"
                          style={{
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 5,
                          }}
                        >
                          <Image
                            source={{
                              uri: song.coverUrl || song.album?.coverUrl,
                            }}
                            className="w-[150px] h-[150px] rounded-2xl"
                            contentFit="cover"
                            transition={200}
                          />
                          {/* Play Button Overlay */}
                          <View className="absolute inset-0 items-center justify-center">
                            <View className="bg-red-600 rounded-full p-3 opacity-0 active:opacity-100">
                              <Ionicons name="play" size={24} color="white" />
                            </View>
                          </View>
                          {/* Like Button */}
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleLike(song.id);
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Medium
                              );
                            }}
                            className="absolute top-2 right-2 bg-black/60 backdrop-blur rounded-full p-2"
                            style={{
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.3,
                              shadowRadius: 4,
                              elevation: 3,
                            }}
                          >
                            <Ionicons
                              name={
                                isLikedSong(song.id) ? "heart" : "heart-outline"
                              }
                              size={18}
                              color={isLikedSong(song.id) ? "#ff0000" : "#fff"}
                            />
                          </TouchableOpacity>
                        </View>
                        <Card.Body className="p-0 mt-3">
                          <Card.Title
                            className="text-foreground text-sm font-bold text-center"
                            numberOfLines={1}
                          >
                            {song.title}
                          </Card.Title>
                          <Card.Description
                            className="text-muted-foreground text-xs mt-1 text-center"
                            numberOfLines={1}
                          >
                            {song.artists.map((a) => a.artist.name).join(", ")}
                          </Card.Description>
                        </Card.Body>
                      </Card>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Section>

            {/* Popular Artists with Enhanced Design */}
            <Section
              title="Popular Artists"
              subtitle="Most listened artists"
              icon="mic"
              iconColor="#ff0000"
              className="mt-10"
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-5">
                  {artists.map((artist) => (
                    <TouchableOpacity
                      key={artist.id}
                      onPress={() => {
                        router.push({
                          pathname: "/artist/[id]",
                          params: { id: artist.id },
                        });
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.7}
                    >
                      <View className="items-center w-[120px]">
                        <View
                          className="relative"
                          style={{
                            shadowColor: "#ff0000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 12,
                            elevation: 6,
                          }}
                        >
                          <Image
                            source={{
                              uri:
                                artist.imageUrl ||
                                "https://via.placeholder.com/120",
                            }}
                            className="w-[120px] h-[120px] rounded-full border-4 border-white/10"
                            contentFit="cover"
                            transition={200}
                          />
                          {/* Verified Badge */}
                          <View className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5">
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color="white"
                            />
                          </View>
                        </View>
                        <Text
                          className="text-foreground font-bold text-sm mt-3 text-center"
                          numberOfLines={1}
                        >
                          {artist.name}
                        </Text>
                        {!!artist.monthlyListeners && (
                          <Text className="text-muted-foreground text-xs mt-0.5">
                            {(artist.monthlyListeners / 1000).toFixed(0)}K
                            listeners
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Section>

            {/* Featured Albums with Enhanced Design */}
            <Section
              title="Featured Albums"
              subtitle="Curated just for you"
              icon="disc"
              iconColor="#ff0000"
              className="mt-10"
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-4">
                  {albums.map((album) => (
                    <TouchableOpacity
                      key={album.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Card variant="transparent" className="w-[170px] p-0">
                        <View
                          style={{
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.4,
                            shadowRadius: 10,
                            elevation: 8,
                          }}
                        >
                          <Image
                            source={{
                              uri:
                                album.coverUrl ||
                                "https://via.placeholder.com/170",
                            }}
                            className="w-[170px] h-[170px] rounded-2xl"
                            contentFit="cover"
                            transition={200}
                          />
                          {/* Play Button Overlay */}
                          <View className="absolute inset-0 items-center justify-center">
                            <View className="bg-red-600/90 backdrop-blur rounded-full p-4 opacity-0 active:opacity-100">
                              <Ionicons name="play" size={28} color="white" />
                            </View>
                          </View>
                        </View>
                        <Card.Body className="p-0 mt-3">
                          <Card.Title
                            className="text-foreground font-bold text-sm text-center"
                            numberOfLines={1}
                          >
                            {album.name}
                          </Card.Title>
                          <Card.Description
                            className="text-muted-foreground text-xs mt-1 text-center"
                            numberOfLines={1}
                          >
                            Album
                          </Card.Description>
                        </Card.Body>
                      </Card>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Section>

            {/* Bottom Spacer */}
            <View className="h-8" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  subtitle,
  icon,
  iconColor,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={className}>
      <View className="mb-4">
        <View className="flex-row items-center gap-3">
          {!!icon && (
            <View
              className="p-2 rounded-full"
              style={{ backgroundColor: `${iconColor}20` }}
            >
              <Ionicons name={icon} size={24} color={iconColor || "#fff"} />
            </View>
          )}
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">{title}</Text>
            {!!subtitle && (
              <Text className="text-sm text-muted-foreground mt-1">
                {subtitle}
              </Text>
            )}
          </View>
        </View>
      </View>
      {children}
    </View>
  );
}
