import { SignInPrompt } from "@/components/auth/SignInPrompt";
import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { apiClient } from "@/lib/api";
import { formatSongFromApi } from "@/lib/song-format";
import { Album, Artist, Song } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { Card, Spinner } from "heroui-native";
import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SongActionSheet } from "@/components/SongActionSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong, playFromContext, currentSong } = usePlayer();
  const [actionSong, setActionSong] = useState<Song | null>(null);
  const { isLikedSong, toggleLike } = useLikeSong();
  const { token, isLoading: authLoading } = useAuth();

  const { data: songsData, isLoading: songsLoading } = useQuery({
    queryKey: ["songs", "recent"],
    queryFn: () => apiClient.get("/songs?limit=10&isPublished=true"),
    enabled: !!token,
  });

  const { data: artistsData, isLoading: artistsLoading } = useQuery({
    queryKey: ["artists", "top"],
    queryFn: () => apiClient.get("/artists?limit=10"),
    enabled: !!token,
  });

  const { data: albumsData, isLoading: albumsLoading } = useQuery({
    queryKey: ["albums", "new"],
    queryFn: () => apiClient.get("/albums?limit=10"),
    enabled: !!token,
  });

  const isLoading = songsLoading || artistsLoading || albumsLoading;
  const isInitialLoading =
    isLoading && !songsData && !artistsData && !albumsData;

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
        subtitle: `${timeLabel} · Ease into the day with something you love`,
      };
    if (hour >= 9 && hour < 12)
      return {
        title: "Good morning",
        subtitle: `${timeLabel} · Great time to discover your next favorite song`,
      };
    if (hour >= 12 && hour < 14)
      return {
        title: "Good afternoon",
        subtitle: `${timeLabel} · Take a break and press play`,
      };
    if (hour >= 14 && hour < 17)
      return {
        title: "Good afternoon",
        subtitle: `${timeLabel} · Keep the energy going with fresh tracks`,
      };
    if (hour >= 17 && hour < 20)
      return {
        title: "Good evening",
        subtitle: `${timeLabel} · Unwind with your favorite artists`,
      };
    if (hour >= 20 && hour < 22)
      return {
        title: "Good evening",
        subtitle: `${timeLabel} · Settle in and enjoy the music`,
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

  if (authLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Spinner size="lg" color="#ff0000" />
      </View>
    );
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

  if (isInitialLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Spinner size="lg" color="#ff0000" />
      </View>
    );
  }

  const rawSongs: any[] = songsData?.data || [];
  const artists: Artist[] = artistsData?.data || [];
  const albums: Album[] = albumsData?.data || [];
  const songs: Song[] = rawSongs.map(formatSongFromApi);

  const handlePlaySong = (song: Song, context?: Song[]) => {
    if (context && context.length > 1) {
      void playFromContext(song, context, "playlist");
    } else {
      void playSong(song);
    }
    router.push(`/song/${song.id}` as Href);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View className={`flex-1 ${currentSong ? "pb-20" : ""}`}>
          {/* Header */}
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
            <View className="flex-row justify-between items-start mt-10 mb-6 px-3">
              <View className="flex-1 pr-4">
                <Text className="text-2xl font-bold text-foreground">
                  {greeting.title}
                </Text>
                <Text className="text-sm text-muted-foreground mt-1">
                  {greeting.subtitle}
                </Text>
              </View>
              <View className="flex-row gap-3">
                <TouchableOpacity className="bg-white/10 p-2.5 rounded-full">
                  <Ionicons
                    name="notifications-outline"
                    size={22}
                    color="white"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-white/10 p-2.5 rounded-full"
                  onPress={() => router.push("/(tabs)/setting")}
                >
                  <Ionicons name="settings-outline" size={22} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Access Cards */}
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                className="flex-1 bg-red-600/20 border border-red-500/30 rounded-2xl p-4"
                onPress={() => router.push("/liked-songs")}
              >
                <View className="flex-row justify-between">
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
                className="flex-1 bg-purple-600/20 border border-purple-500/30 rounded-2xl p-4"
                onPress={() => router.push("/(tabs)/library")}
              >
                <View className="flex-row justify-between">
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

          <View className="pt-5">
            {/* New Releases */}
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
                      onPress={() => handlePlaySong(song, songs)}
                      onLongPress={() => {
                        setActionSong(song);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                      activeOpacity={0.8}
                    >
                      <Card variant="transparent" className="w-[150px] p-0">
                        <View className="relative shadow-lg">
                          <Image
                            uri={song.coverUrl || song.album?.coverUrl}
                            variant="album"
                            className="w-[150px] h-[150px] rounded-2xl"
                            contentFit="cover"
                            transition={200}
                          />
                          <View className="absolute inset-0 items-center justify-center">
                            <View className="bg-red-600 rounded-full p-3 opacity-0 active:opacity-100">
                              <Ionicons name="play" size={24} color="white" />
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleLike(song);
                            }}
                            className="absolute top-2 right-2 bg-black/60 rounded-full p-2"
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
                            className="text-muted-foreground text-xs text-center"
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

            {/* Popular Artists */}
            <Section
              title="Popular Artists"
              subtitle="Most listened artists"
              icon="mic"
              iconColor="#ff0000"
              className="mt-5"
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-5">
                  {artists.map((artist) => (
                    <TouchableOpacity
                      key={artist.id}
                      onPress={() =>
                        router.push({
                          pathname: "/artist/[id]",
                          params: { id: artist.id },
                        })
                      }
                    >
                      <View className="items-center w-[120px]">
                        <View className="relative shadow-lg">
                          <Image
                            uri={artist.imageUrl}
                            variant="artist"
                            className="w-[120px] h-[120px] rounded-full border-4 border-white/10"
                            contentFit="cover"
                            transition={200}
                          />
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

            {/* Featured Albums */}
            <Section
              title="Featured Albums"
              subtitle="Curated just for you"
              icon="disc"
              iconColor="#ff0000"
              className="mt-5"
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-4">
                  {albums.map((album) => (
                    <TouchableOpacity
                      key={album.id}
                      onPress={() =>
                        router.push({
                          pathname: "/album/[id]",
                          params: { id: album.id },
                        })
                      }
                    >
                      <Card variant="transparent" className="w-[170px] p-0">
                        <View className="shadow-xl">
                          <Image
                            uri={album.coverUrl}
                            variant="album"
                            className="w-[170px] h-[170px] rounded-2xl"
                            contentFit="cover"
                            transition={200}
                          />
                          <View className="absolute inset-0 items-center justify-center">
                            <View className="bg-red-600/90 rounded-full p-4 opacity-0 active:opacity-100">
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
                          <Card.Description className="text-muted-foreground text-xs text-center mt-1">
                            Album
                          </Card.Description>
                        </Card.Body>
                      </Card>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Section>
            <View className="h-8" />
          </View>
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

function Section({
  title,
  subtitle,
  icon,
  iconColor,
  children,
  className,
}: any) {
  return (
    <View className={className}>
      <View className="mb-4 flex-row items-center gap-3">
        {icon && (
          <View
            className="p-2 rounded-full"
            style={{ backgroundColor: `${iconColor}20` }}
          >
            <Ionicons name={icon} size={24} color={iconColor} />
          </View>
        )}
        <View className="flex-1">
          <Text className="text-2xl font-bold text-foreground">{title}</Text>
          {subtitle && (
            <Text className="text-sm text-muted-foreground mt-1">
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {children}
    </View>
  );
}
