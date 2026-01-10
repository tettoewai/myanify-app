import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { Song } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Spinner } from "heroui-native";
import React, { useState, useMemo } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Pressable,
} from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

type SortOption = "recent" | "title" | "artist";

export default function LikedSongs() {
  const { likedSongs, isLoading, toggleLike } = useLikeSong();
  const { playSong, setQueue, currentSong } = usePlayer();
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [showSortModal, setShowSortModal] = useState(false);

  // Sort liked songs
  const sortedSongs = useMemo(() => {
    const songs = [...likedSongs];
    switch (sortBy) {
      case "title":
        return songs.sort((a, b) => a.title.localeCompare(b.title));
      case "artist":
        return songs.sort((a, b) =>
          (a.artist || "").localeCompare(b.artist || "")
        );
      case "recent":
      default:
        return songs.reverse(); // Most recent first
    }
  }, [likedSongs, sortBy]);

  const handlePlaySong = (song: Song, contextSongs: Song[]) => {
    setQueue(contextSongs);
    playSong(song);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleShuffle = () => {
    const shuffled = [...sortedSongs].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    playSong(shuffled[0]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const renderSongItem = ({ item, index }: { item: Song; index: number }) => {
    const isPlaying = currentSong?.id === item.id;

    return (
      <TouchableOpacity
        className={`flex-row items-center mb-2 px-4 py-3 mx-4 rounded-xl ${
          isPlaying
            ? "bg-primary/10 border border-primary/30"
            : "active:bg-card/50"
        }`}
        onPress={() => handlePlaySong(item, sortedSongs)}
      >
        {/* Track Number / Playing Indicator */}
        <View className="w-8 items-center justify-center mr-3">
          {isPlaying ? (
            <StyledIonicons
              name="volume-high"
              size={20}
              className="text-primary"
            />
          ) : (
            <Text className="text-muted-foreground font-medium">
              {index + 1}
            </Text>
          )}
        </View>

        {/* Album Art */}
        <View className="w-14 h-14 rounded-lg overflow-hidden mr-3 shadow">
          <Image
            source={{ uri: item.coverUrl || "https://via.placeholder.com/150" }}
            className="w-full h-full"
            contentFit="cover"
          />
        </View>

        {/* Song Info */}
        <View className="flex-1">
          <Text
            className={`font-bold text-base ${
              isPlaying ? "text-primary" : "text-foreground"
            }`}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text
            className="text-muted-foreground text-sm mt-0.5"
            numberOfLines={1}
          >
            {item.artist || "Unknown Artist"}
          </Text>
        </View>

        {/* Like Button */}
        <TouchableOpacity
          onPress={() => {
            toggleLike(item.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          className="p-2 ml-2"
        >
          <StyledIonicons name="heart" size={24} className="text-primary" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (isLoading && !likedSongs.length) {
    return (
      <SafeAreaView
        className="flex-1 bg-background justify-center items-center"
        edges={["left", "right"]}
      >
        <Spinner size="lg" />
      </SafeAreaView>
    );
  }

  const totalDuration = sortedSongs.length * 3.5; // Approximate minutes
  const hours = Math.floor(totalDuration / 60);
  const minutes = Math.floor(totalDuration % 60);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      {/* Header */}
      <View className="pb-4 bg-primary">
        <View className="flex-row items-center px-4 py-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-black/20 items-center justify-center mr-4"
          >
            <StyledIonicons
              name="chevron-back"
              size={24}
              className="text-white"
            />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-white flex-1">
            Liked Songs
          </Text>
          <TouchableOpacity
            onPress={() => {
              setShowSortModal(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="w-10 h-10 rounded-full bg-black/20 items-center justify-center"
          >
            <StyledIonicons
              name="swap-vertical"
              size={22}
              className="text-white"
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={sortedSongs}
        renderItem={renderSongItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {/* Hero Section */}
            <LinearGradient
              colors={["#ff0000", "#cc0000", "transparent"]}
              className="px-4 pt-6 pb-8"
            >
              <View className="items-center mb-6">
                <View className="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl mb-6">
                  <LinearGradient
                    colors={["#ff6666", "#ff0000"]}
                    className="w-full h-full items-center justify-center"
                  >
                    <StyledIonicons
                      name="heart"
                      size={100}
                      className="text-white"
                    />
                  </LinearGradient>
                </View>

                {/* Stats Cards */}
                <View className="flex-row w-full justify-center gap-3 mb-6">
                  <View className="flex-1 bg-card/20 backdrop-blur rounded-xl p-3 border-[0.5] border-border">
                    <View className="items-center">
                      <StyledIonicons
                        name="musical-notes"
                        size={24}
                        className="text-primary mb-1"
                      />
                      <Text className="text-2xl font-bold text-foreground">
                        {sortedSongs.length}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        Songs
                      </Text>
                    </View>
                  </View>
                  <View className="flex-1 bg-card/20 backdrop-blur rounded-xl p-3 border-[0.5] border-border">
                    <View className="items-center">
                      <StyledIonicons
                        name="time"
                        size={24}
                        className="text-primary mb-1"
                      />
                      <Text className="text-2xl font-bold text-foreground">
                        {hours > 0 ? `${hours}h` : `${minutes}m`}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        Duration
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                {sortedSongs.length > 0 && (
                  <View className="flex-row w-full gap-3">
                    <TouchableOpacity
                      onPress={() =>
                        handlePlaySong(sortedSongs[0], sortedSongs)
                      }
                      className="flex-1 bg-primary h-14 rounded-full flex-row items-center justify-center shadow-lg"
                    >
                      <StyledIonicons
                        name="play"
                        size={24}
                        className="text-white mr-2"
                      />
                      <Text className="text-white font-bold text-base">
                        Play All
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleShuffle}
                      className="flex-1 bg-card border border-border h-14 rounded-full flex-row items-center justify-center"
                    >
                      <StyledIonicons
                        name="shuffle"
                        size={24}
                        className="text-foreground mr-2"
                      />
                      <Text className="text-foreground font-bold text-base">
                        Shuffle
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </LinearGradient>

            {/* Sort Indicator */}
            {sortedSongs.length > 0 && (
              <View className="px-4 py-2 mb-2">
                <Text className="text-muted-foreground text-xs">
                  Sorted by:{" "}
                  <Text className="text-foreground font-medium">
                    {sortBy === "recent"
                      ? "Recently Added"
                      : sortBy === "title"
                      ? "Title (A-Z)"
                      : "Artist (A-Z)"}
                  </Text>
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center pt-20 px-6">
            <View className="w-32 h-32 rounded-full bg-card items-center justify-center mb-6 border-4 border-border">
              <StyledIonicons
                name="heart-outline"
                size={64}
                className="text-muted-foreground"
              />
            </View>
            <Text className="text-foreground text-xl font-bold mb-2">
              No Liked Songs Yet
            </Text>
            <Text className="text-muted-foreground text-center text-base">
              Start building your collection by liking songs you love
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Sort Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSortModal}
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-end"
          onPress={() => setShowSortModal(false)}
        >
          <Pressable
            className="bg-background rounded-t-3xl border-t-2 border-primary shadow-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle Bar */}
            <View className="items-center py-3">
              <View className="w-12 h-1 bg-border rounded-full" />
            </View>

            <View className="px-6 pb-8">
              <Text className="text-xl font-bold text-foreground mb-6">
                Sort By
              </Text>

              {/* Sort Options */}
              <TouchableOpacity
                onPress={() => {
                  setSortBy("recent");
                  setShowSortModal(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`flex-row items-center p-4 rounded-xl mb-2 ${
                  sortBy === "recent"
                    ? "bg-primary"
                    : "bg-card border border-border"
                }`}
              >
                <StyledIonicons
                  name="time"
                  size={24}
                  className={
                    sortBy === "recent" ? "text-white" : "text-foreground"
                  }
                />
                <Text
                  className={`flex-1 ml-4 font-semibold text-base ${
                    sortBy === "recent" ? "text-white" : "text-foreground"
                  }`}
                >
                  Recently Added
                </Text>
                {sortBy === "recent" && (
                  <StyledIonicons
                    name="checkmark-circle"
                    size={24}
                    className="text-white"
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSortBy("title");
                  setShowSortModal(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`flex-row items-center p-4 rounded-xl mb-2 ${
                  sortBy === "title"
                    ? "bg-primary"
                    : "bg-card border border-border"
                }`}
              >
                <StyledIonicons
                  name="text"
                  size={24}
                  className={
                    sortBy === "title" ? "text-white" : "text-foreground"
                  }
                />
                <Text
                  className={`flex-1 ml-4 font-semibold text-base ${
                    sortBy === "title" ? "text-white" : "text-foreground"
                  }`}
                >
                  Title (A-Z)
                </Text>
                {sortBy === "title" && (
                  <StyledIonicons
                    name="checkmark-circle"
                    size={24}
                    className="text-white"
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSortBy("artist");
                  setShowSortModal(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`flex-row items-center p-4 rounded-xl ${
                  sortBy === "artist"
                    ? "bg-primary"
                    : "bg-card border border-border"
                }`}
              >
                <StyledIonicons
                  name="person"
                  size={24}
                  className={
                    sortBy === "artist" ? "text-white" : "text-foreground"
                  }
                />
                <Text
                  className={`flex-1 ml-4 font-semibold text-base ${
                    sortBy === "artist" ? "text-white" : "text-foreground"
                  }`}
                >
                  Artist (A-Z)
                </Text>
                {sortBy === "artist" && (
                  <StyledIonicons
                    name="checkmark-circle"
                    size={24}
                    className="text-white"
                  />
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
