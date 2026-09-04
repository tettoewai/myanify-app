import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/auth/RequireAuth";
import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeArtist } from "@/hooks/useLikeArtist";
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
import React, { useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);
const { height } = Dimensions.get("window");
const HEADER_HEIGHT = height * 0.5;

// Stats Card Component
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

export default function ArtistDetails() {
  return (
    <RequireAuth>
      <ArtistDetailsScreen />
    </RequireAuth>
  );
}

function ArtistDetailsScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const {
    likeArtist,
    unlikeArtist,
    isLikedArtist,
    isLoading: isLikedArtistsLoading,
    isLiking,
    isUnliking,
  } = useLikeArtist();
  const router = useRouter();
  const {
    playFromContext,
    currentSong: playingSong,
    isPlaying,
    setIsShuffled,
  } = usePlayer();
  const { isLikedSong, toggleLike } = useLikeSong();
  const insets = useSafeAreaInsets();

  const [isBioExpanded, setIsBioExpanded] = React.useState(false);

  const { data: artist, isLoading: artistLoading } = useQuery({
    queryKey: ["artist", id],
    queryFn: () => apiClient.get(`/artists/${id}`),
    enabled: !!id && !!token,
  });

  const songs: Song[] = useMemo(() => {
    if (!artist?.songs) return [];
    return artist.songs.map((item: any) =>
      formatSongFromApi(item.song || item),
    );
  }, [artist]);

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

  if (artistLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <LoadingSpinner size="lg" />
        <Text className="text-neutral-400 mt-4">Loading artist...</Text>
      </View>
    );
  }

  if (!artist) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Text className="text-foreground text-lg">Artist not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 p-2 bg-primary rounded-lg"
        >
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleLikeArtist = (artistId: string) => {
    if (isLikedArtist(artistId)) {
      unlikeArtist.mutate(artistId);
    } else {
      likeArtist.mutate(artistId);
    }
  };

  const handleShare = () => {
    void shareEntity("artist", artist, { title: artist.name });
  };

  const renderSongItem = ({ item, index }: { item: Song; index: number }) => {
    const isCurrentSong = playingSong?.id === item.id;

    return (
      <TouchableOpacity
        onPress={() => handlePlaySong(item)}
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
            uri={getSongCoverUrl(item) ?? ""}
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
            className={`text-base font-semibold pt-2 leading-loose ${
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
        <TouchableOpacity className="p-2">
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
    <View className="flex-1 bg-background" style={{ paddingBottom: insets.bottom }}>
      <StatusBar barStyle="light-content" />

      {/* Animated Header Background */}
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
        <Image
          uri={artist.imageUrl}
          variant="artist"
          className="w-full h-full"
          contentFit="cover"
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.7)", "#000000"]}
          className="absolute inset-0"
        />
      </Animated.View>

      {/* Animated Navigation Header */}
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
              className="text-white text-lg font-bold leading-loose"
              numberOfLines={1}
            >
              {artist.name}
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
        {/* Spacer for header */}
        <View style={{ height: HEADER_HEIGHT - 80 }} />

        {/* Artist Info Card */}
        <View className="px-6 py-4">
          <View className="flex-row items-center mb-3">
            <Text
              className="text-white text-5xl font-black flex-1 py-1 leading-loose"
              numberOfLines={2}
            >
              {artist.name}
            </Text>
          </View>

          {!!artist.monthlyListeners && (
            <View className="flex-row items-center mb-6">
              <StyledIonicons
                name="headset-outline"
                size={16}
                color="#a3a3a3"
              />
              <Text className="text-neutral-400 text-sm ml-2 font-medium leading-loose">
                {Number(artist.monthlyListeners).toLocaleString()} monthly
                listeners
              </Text>
            </View>
          )}

          {/* Stats Cards */}
          <View className="flex-row gap-3 mb-6">
            <StatCard
              icon="musical-notes"
              value={songs.length.toString()}
              label="Songs"
            />
            <StatCard
              icon="albums"
              value={artist.totalAlbums?.toString() || "0"}
              label="Albums"
            />
            <StatCard
              icon="people"
              value={
                artist.followers
                  ? `${(artist.followers / 1000).toFixed(1)}K`
                  : "0"
              }
              label="Followers"
            />
          </View>

          {/* Action Buttons */}
          <View className="flex-row items-center gap-3 mb-6">
            <TouchableOpacity
              onPress={handlePlayAll}
              className="flex-1 bg-primary rounded-full py-4 flex-row items-center justify-center"
              activeOpacity={0.8}
            >
              <StyledIonicons name="play" size={24} color="#fff" />
              <Text className="text-white text-base font-bold ml-2">
                Play All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (songs.length > 0) {
                  const shuffled = [...songs].sort(() => Math.random() - 0.5);
                  setIsShuffled(true);
                  void playFromContext(shuffled[0], shuffled, "playlist");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
              }}
              className="bg-neutral-800 rounded-full p-4"
              activeOpacity={0.8}
            >
              <StyledIonicons name="shuffle" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleLikeArtist(artist.id)}
              disabled={isLikedArtistsLoading || isLiking || isUnliking}
              className="bg-neutral-800 rounded-full p-4"
              activeOpacity={0.8}
            >
              {isLikedArtistsLoading || isLiking || isUnliking ? (
                <LoadingSpinner size="sm" color="#ffffff" />
              ) : (
                <StyledIonicons
                  name={isLikedArtist(artist.id) ? "heart" : "heart-outline"}
                  size={24}
                  color={isLikedArtist(artist.id) ? "#ff0000" : "#fff"}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-neutral-800 rounded-full p-4"
              activeOpacity={0.8}
            >
              <StyledIonicons
                name="ellipsis-horizontal"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {/* Bio Section */}
          {!!artist.bio && (
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
                numberOfLines={isBioExpanded ? undefined : 3}
              >
                {artist.bio}
              </Text>
              {artist.bio.length > 100 && (
                <TouchableOpacity
                  onPress={() => setIsBioExpanded(!isBioExpanded)}
                  className="mt-3"
                >
                  <Text className="text-primary text-sm font-bold">
                    {isBioExpanded ? "Show less" : "Read more"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Popular Songs Header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-2xl font-bold">Popular Songs</Text>
            <Text className="text-neutral-400 text-sm">
              {songs.length} tracks
            </Text>
          </View>
        </View>

        {/* Songs List */}
        {songs.length > 0 ? (
          songs.map((song, index) => (
            <React.Fragment key={song.id}>
              {renderSongItem({ item: song, index })}
            </React.Fragment>
          ))
        ) : (
          <View className="items-center py-10">
            <StyledIonicons
              name="musical-notes-outline"
              size={48}
              color="#404040"
            />
            <Text className="text-neutral-500 mt-4 text-base">
              No songs found for this artist
            </Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}
