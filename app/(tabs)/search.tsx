import { SignInPrompt } from "@/components/auth/SignInPrompt";
import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { SongActionSheet } from "@/components/SongActionSheet";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { useSearch } from "@/hooks/useSearch";
import { apiClient } from "@/lib/api";
import { formatSongFromApi } from "@/lib/song-format";
import { getSongCoverUrl } from "@/lib/song-cover";
import { Artist, Genre, Song } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { Card, Input, TextField } from "heroui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Search() {
  const { playSong, playFromContext } = usePlayer();
  const [actionSong, setActionSong] = useState<Song | null>(null);
  const { isLikedSong, toggleLike } = useLikeSong();
  const { token, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);
  const router = useRouter();
  const { genreId: genreIdParam } = useLocalSearchParams<{
    genreId?: string;
  }>();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (genreIdParam) {
      setSelectedGenreId(genreIdParam);
      setSearchQuery("");
      setDebouncedQuery("");
    }
  }, [genreIdParam]);

  const shouldSearch = debouncedQuery.length > 0;
  const showBrowse = !shouldSearch && !selectedGenreId;

  const { data: genresData, isLoading: genresLoading } = useQuery({
    queryKey: ["genres"],
    queryFn: () => apiClient.get("/genres"),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: searchData,
    isLoading: searchLoading,
    isError: searchError,
  } = useSearch(debouncedQuery, {
    perPage: 20,
    enabled: shouldSearch && !!token,
  });

  const { data: genreSongsData, isLoading: genreSongsLoading } = useQuery({
    queryKey: ["songs", "genre", selectedGenreId],
    queryFn: () =>
      apiClient.get(
        `/songs?genreId=${selectedGenreId}&isPublished=true&limit=50`,
      ),
    enabled: !!selectedGenreId && !shouldSearch && !!token,
  });

  const genres: Genre[] = genresData?.data || [];
  const rawSearchSongs: any[] = searchData?.songs || [];
  const artists: Artist[] = searchData?.artists || [];
  const rawGenreSongs: any[] = genreSongsData?.data || [];

  const searchSongs: Song[] = useMemo(
    () => rawSearchSongs.map(formatSongFromApi),
    [rawSearchSongs],
  );
  const genreSongs: Song[] = useMemo(
    () => rawGenreSongs.map(formatSongFromApi),
    [rawGenreSongs],
  );

  const selectedGenre = useMemo(
    () => genres.find((g) => g.id === selectedGenreId) ?? null,
    [genres, selectedGenreId],
  );

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

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
  }, []);

  const handleClearGenre = useCallback(() => {
    setSelectedGenreId(null);
  }, []);

  const handleGenrePress = useCallback((genre: Genre) => {
    setSelectedGenreId(genre.id);
    setSearchQuery("");
    setDebouncedQuery("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const isLoading =
    (shouldSearch && searchLoading) ||
    (showBrowse && genresLoading) ||
    (!!selectedGenreId && !shouldSearch && genreSongsLoading);

  const renderGenreItem = ({ item }: { item: Genre }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => handleGenrePress(item)}
      style={{ width: COLUMN_WIDTH }}
      className="mb-4"
    >
      <Card className="h-[100px] p-0 overflow-hidden">
        <Image
          uri={
            item.imageUrl ||
            "https://placehold.co/200x100/333/ff0000?text=Genre"
          }
          variant="artist"
          className="w-full h-full absolute"
          contentFit="cover"
        />
        <Card.Body className="flex-1 bg-black/30 justify-end p-3">
          <Card.Title className="text-white font-bold text-base leading-loose">
            {item.name}
          </Card.Title>
          {item.description ? (
            <Card.Description
              className="text-white/70 text-xs leading-loose"
              numberOfLines={1}
            >
              {item.description}
            </Card.Description>
          ) : null}
        </Card.Body>
      </Card>
    </TouchableOpacity>
  );

  const renderSongRow = (song: Song, index: number, context: Song[]) => (
    <TouchableOpacity
      key={song.id}
      onPress={() => handlePlaySong(song, context)}
      onLongPress={() => {
        setActionSong(song);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
      activeOpacity={0.8}
    >
      <Card className="flex-row items-center mb-3 p-2 bg-card/50">
        <Text className="text-muted-foreground text-sm w-6 text-center">
          {index + 1}
        </Text>
        <Image
          uri={
            getSongCoverUrl(song) ??
            "https://placehold.co/50x50/333/ff0000?text=No+Cover"
          }
          variant="album"
          className="w-[50px] h-[50px] rounded-md ml-2"
          contentFit="cover"
        />
        <Card.Body className="flex-1 ml-3 p-0 min-w-0">
          <Card.Title
            className="text-foreground font-semibold leading-loose"
            numberOfLines={1}
          >
            {song.title}
          </Card.Title>
          <Card.Description
            className="text-muted-foreground text-sm leading-loose"
            numberOfLines={1}
          >
            {song.artists.map((a) => a.artist.name).join(", ")}
          </Card.Description>
        </Card.Body>
        <Text className="text-muted-foreground text-xs mr-2 leading-loose">
          {formatDuration(song.duration)}
        </Text>
        {song.isPremium && (
          <View className="bg-primary/20 px-2 py-0.5 rounded-full mr-2">
            <Text className="text-primary text-xs font-medium">Premium</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            toggleLike(song);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          className="p-2"
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
            setActionSong(song);
          }}
          className="p-2"
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#a3a3a3" />
        </TouchableOpacity>
      </Card>
    </TouchableOpacity>
  );

  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#ff0000" />
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <SignInPrompt
          title="Sign in to search"
          description="Find artists, songs, and genres across the Myanify catalog."
          compact
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <View className="px-4 pt-4">
        {selectedGenreId && !shouldSearch ? (
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={handleClearGenre}
              className="mr-3 p-1"
              accessibilityLabel="Back to browse"
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground leading-loose">
                {selectedGenre?.name || "Genre"}
              </Text>
              {selectedGenre?.description ? (
                <Text
                  className="text-sm text-muted-foreground leading-loose"
                  numberOfLines={2}
                >
                  {selectedGenre.description}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <Text className="text-2xl font-bold text-foreground mb-4">
            Search
          </Text>
        )}

        <TextField className="mb-6">
          <View className="w-full flex-row items-center">
            <Input
              placeholder="What do you want to listen to?"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text.trim()) setSelectedGenreId(null);
              }}
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
                onPress={handleClearSearch}
                className="absolute right-4"
                accessibilityLabel="Clear search"
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
      ) : showBrowse ? (
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
          ListEmptyComponent={
            <Text className="text-muted-foreground text-center py-12">
              No genres available
            </Text>
          }
        />
      ) : selectedGenreId && !shouldSearch ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {genreSongs.length > 0 ? (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">
                Songs
              </Text>
              {genreSongs.map((song, index) =>
                renderSongRow(song, index, genreSongs),
              )}
            </View>
          ) : (
            <View className="items-center pt-24">
              <Ionicons name="musical-notes-outline" size={48} color="#888" />
              <Text className="text-muted-foreground text-base mt-4 text-center">
                No songs in this genre yet
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {searchError && (
            <View className="items-center pt-12">
              <Text className="text-muted-foreground text-center">
                Search failed. Please try again.
              </Text>
            </View>
          )}

          {!searchError && artists.length > 0 && (
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
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <Image
                          uri={
                            artist.imageUrl ||
                            "https://placehold.co/100x100/333/ff0000?text=Artist"
                          }
                          variant="artist"
                          className="w-[100px] h-[100px] rounded-full"
                          contentFit="cover"
                        />
                      </TouchableOpacity>
                      <Card.Body className="p-0 mt-2 items-center">
                        <Card.Title
                          className="text-foreground text-center text-xs leading-loose"
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

          {!searchError && searchSongs.length > 0 && (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">
                Songs
              </Text>
              {searchSongs.map((song, index) =>
                renderSongRow(song, index, searchSongs),
              )}
            </View>
          )}

          {!searchError &&
            !searchLoading &&
            artists.length === 0 &&
            searchSongs.length === 0 && (
              <View className="items-center pt-24">
                <Ionicons name="search-outline" size={48} color="#888" />
                <Text className="text-muted-foreground text-base mt-4 text-center">
                  No results found for &quot;{debouncedQuery}&quot;
                </Text>
                <Text className="text-muted-foreground text-sm mt-2 text-center">
                  Try a different song, artist, or genre
                </Text>
              </View>
            )}
        </ScrollView>
      )}

      <SongActionSheet
        song={actionSong}
        visible={!!actionSong}
        onClose={() => setActionSong(null)}
      />
    </SafeAreaView>
  );
}
