import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { apiClient } from "@/lib/api";
import { Artist, Genre, Song } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Card, TextField } from "heroui-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = (width - 48) / 2;

export default function Search() {
  const { playSong, setQueue } = usePlayer();
  const { isLikedSong, toggleLike } = useLikeSong();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: genresData, isLoading: genresLoading } = useQuery({
    queryKey: ["genres"],
    queryFn: () => apiClient.get("/genres"),
    enabled: !debouncedQuery,
  });

  const { data: songsData, isLoading: songsLoading } = useQuery({
    queryKey: ["songs", "search", debouncedQuery],
    queryFn: () =>
      apiClient.get(`/songs?search=${debouncedQuery}&isPublished=true`),
    enabled: !!debouncedQuery,
  });

  const { data: artistsData, isLoading: artistsLoading } = useQuery({
    queryKey: ["artists", "search", debouncedQuery],
    queryFn: () => apiClient.get(`/artists?search=${debouncedQuery}`),
    enabled: !!debouncedQuery,
  });

  const genres: Genre[] = genresData?.data || [];
  const rawSongs: any[] = songsData?.data || [];
  const artists: Artist[] = artistsData?.data || [];

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

  const isLoading =
    (!!debouncedQuery && (songsLoading || artistsLoading)) ||
    (!debouncedQuery && genresLoading);

  const renderGenreItem = ({ item }: { item: Genre }) => (
    <Card
      className="h-[100px] mb-4 p-0 overflow-hidden"
      style={{
        width: COLUMN_WIDTH,
      }}
    >
      <Image
        source={{ uri: item.imageUrl || "https://via.placeholder.com/150" }}
        className="w-full h-full absolute"
        contentFit="cover"
      />
      <Card.Body className="flex-1 bg-black/30 justify-end p-3">
        <Card.Title className="text-white font-bold text-base">
          {item.name}
        </Card.Title>
      </Card.Body>
    </Card>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <View className="px-4 pt-4">
        <Text className="text-2xl font-bold text-foreground mb-4">Search</Text>

        {/* Search Bar */}
        <TextField className="mb-6">
          <View className="w-full flex-row items-center">
            <TextField.Input
              placeholder="What do you want to listen to?"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 px-10"
            />
            <StyledIonicons
              name="search"
              size={20}
              className="absolute left-3.5 text-muted-foreground"
              pointerEvents="none"
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                className="absolute right-4"
              >
                <StyledIonicons
                  name="close-circle"
                  size={20}
                  className="text-muted-foreground"
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </TextField>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#ff0000" />
        </View>
      ) : !debouncedQuery ? (
        /* Browse All */
        <FlatList
          data={genres}
          renderItem={renderGenreItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: "space-between" }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text className="text-lg font-bold text-foreground mb-4">
              Browse All
            </Text>
          }
        />
      ) : (
        /* Search Results */
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {artists.length > 0 && (
            <View className="mb-6">
              <Text className="text-lg font-bold text-foreground mb-4">
                Artists
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-4">
                  {artists.map((artist) => (
                    <Card
                      key={artist.id}
                      variant="transparent"
                      className="items-center w-[100px] p-0"
                    >
                      <TouchableOpacity
                        onPress={() => {
                          router.push({
                            pathname: "/artist/[id]",
                            params: { id: artist.id },
                          });
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <Image
                          source={{
                            uri:
                              artist.imageUrl ||
                              "https://via.placeholder.com/100",
                          }}
                          className="w-[100px] h-[100px] rounded-[50px]"
                          contentFit="cover"
                        />
                      </TouchableOpacity>
                      <Card.Body className="p-0 mt-2 items-center">
                        <Card.Title
                          className="text-foreground text-center text-[12px]"
                          numberOfLines={1}
                        >
                          {artist.name}
                        </Card.Title>
                      </Card.Body>
                    </Card>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {songs.length > 0 && (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">
                Songs
              </Text>
              {songs.map((song) => (
                <TouchableOpacity
                  key={song.id}
                  onPress={() => handlePlaySong(song)}
                  activeOpacity={0.8}
                >
                  <Card className="flex-row items-center mb-4 p-2 bg-[#1a1a1a]">
                    <Image
                      source={{ uri: song.coverUrl || song.album?.coverUrl }}
                      className="w-[50px] h-[50px] rounded-[4px]"
                      contentFit="cover"
                    />
                    <Card.Body className="flex-1 ml-4 p-0">
                      <Card.Title
                        className="text-foreground font-semibold"
                        numberOfLines={1}
                      >
                        {song.title}
                      </Card.Title>
                      <Card.Description
                        className="text-muted-foreground text-sm"
                        numberOfLines={1}
                      >
                        {song.artists.map((a) => a.artist.name).join(", ")}
                      </Card.Description>
                    </Card.Body>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleLike(song.id);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                      className="p-2 mr-2"
                    >
                      <Ionicons
                        name={isLikedSong(song.id) ? "heart" : "heart-outline"}
                        size={22}
                        color={isLikedSong(song.id) ? "#ff0000" : "#a3a3a3"}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        // Handle menu
                      }}
                    >
                      <Ionicons
                        name="ellipsis-vertical"
                        size={20}
                        color="#a3a3a3"
                      />
                    </TouchableOpacity>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {artists.length === 0 && songs.length === 0 && (
            <View className="flex-1 justify-center items-center pt-[100px]">
              <Text className="text-muted-foreground text-base">
                No results found for "{debouncedQuery}"
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
