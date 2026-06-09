import { RequireAuth } from "@/components/auth/RequireAuth";
import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { useLibrary } from "@/hooks/useLibrary";
import { apiClient } from "@/lib/api";
import { formatSongFromApi } from "@/lib/song-format";
import { Song } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useToast } from "heroui-native";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);
const { height } = Dimensions.get("window");
const HEADER_HEIGHT = height * 0.45;

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

export default function PlaylistDetails() {
  return (
    <RequireAuth>
      <PlaylistDetailsScreen />
    </RequireAuth>
  );
}

function PlaylistDetailsScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const {
    playSong,
    playFromContext,
    currentSong: playingSong,
    isPlaying,
  } = usePlayer();
  const [actionSong, setActionSong] = useState<Song | null>(null);
  const { isLikedSong, toggleLike } = useLikeSong();
  const { deletePlaylist, removeFromPlaylist, updatePlaylist } = useLibrary();
  const { toast } = useToast();

  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");

  const {
    data: playlist,
    isLoading: playlistLoading,
    refetch,
  } = useQuery({
    queryKey: ["playlist", id],
    queryFn: () => apiClient.get(`/playlists/${id}`),
    enabled: !!id && !!token,
  });

  const songs: Song[] = useMemo(() => {
    if (!playlist?.songs) return [];
    return playlist.songs.map((item: any) =>
      formatSongFromApi(item.song || item),
    );
  }, [playlist]);

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
      void playFromContext(shuffled[0], shuffled, "playlist");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleEditPlaylist = async () => {
    if (!editedName.trim()) {
      toast.show({
        variant: "danger",
        label: "Please enter a playlist name",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
      });
      return;
    }

    try {
      await updatePlaylist(id, {
        name: editedName.trim(),
        description: editedDescription.trim(),
      });
      setShowEditModal(false);
      refetch();
      toast.show({
        variant: "success",
        label: "Playlist updated successfully",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: error.message || "Failed to update playlist",
        icon: <Ionicons name="close-circle" size={24} color="white" />,
      });
    }
  };

  const handleDeletePlaylist = async () => {
    try {
      await deletePlaylist(id);
      setShowDeleteModal(false);
      router.back();
      toast.show({
        variant: "success",
        label: "Playlist deleted successfully",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: error.message || "Failed to delete playlist",
        icon: <Ionicons name="close-circle" size={24} color="white" />,
      });
    }
  };

  const handleRemoveSong = async (songId: string) => {
    try {
      await removeFromPlaylist(id, songId);
      refetch();
      toast.show({
        variant: "success",
        label: "Song removed from playlist",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: error.message || "Failed to remove song",
        icon: <Ionicons name="close-circle" size={24} color="white" />,
      });
    }
  };

  if (playlistLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#ff0000" />
        <Text className="text-neutral-400 mt-4">Loading playlist...</Text>
      </View>
    );
  }

  if (!playlist) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Text className="text-foreground text-lg">Playlist not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 p-2 bg-primary rounded-lg"
        >
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
            uri={item.coverUrl}
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
        <TouchableOpacity
          onPress={() => {
            toggleLike(item.id);
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
          onPress={() => handleRemoveSong(item.id)}
          className="p-2"
        >
          <StyledIonicons name="trash-outline" size={24} color="#737373" />
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

  const totalDuration = songs.reduce((acc, song) => acc + song.duration, 0);
  const hours = Math.floor(totalDuration / 3600);
  const minutes = Math.floor((totalDuration % 3600) / 60);

  return (
    <View className="flex-1 bg-background">
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
        {playlist.coverUrl ? (
          <Image
            uri={playlist.coverUrl}
            variant="playlist"
            className="w-full h-full"
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={["#ff6666", "#ff0000", "#cc0000"]}
            className="w-full h-full items-center justify-center"
          >
            <StyledIonicons name="musical-notes" size={100} color="white" />
          </LinearGradient>
        )}
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
              {playlist.name}
            </Animated.Text>
            <TouchableOpacity
              onPress={() => {
                setEditedName(playlist.name);
                setEditedDescription(playlist.description || "");
                setShowEditModal(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="w-10 h-10 items-center justify-center rounded-full bg-black/50"
            >
              <StyledIonicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Spacer for header */}
        <View style={{ height: HEADER_HEIGHT - 80 }} />

        {/* Playlist Info Card */}
        <View className="px-6 py-4">
          <View className="flex-row items-center mb-3">
            <Text
              className="text-white text-5xl font-black flex-1 leading-loose"
              numberOfLines={2}
            >
              {playlist.name}
            </Text>
          </View>

          {/* Creator Info */}
          {!!playlist.createdBy && (
            <View className="flex-row items-center mb-4">
              <StyledIonicons
                name="person-circle-outline"
                size={16}
                color="#a3a3a3"
              />
              <Text className="text-neutral-400 text-sm ml-2 font-medium leading-loose">
                Created by{" "}
                {typeof playlist.createdBy === "string"
                  ? playlist.createdBy
                  : playlist.createdBy.name || playlist.createdBy.email || "Unknown"}
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
              icon="time"
              value={hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
              label="Duration"
            />
            <StatCard
              icon={playlist.isPublic ? "globe" : "lock-closed"}
              value={playlist.isPublic ? "Public" : "Private"}
              label="Status"
            />
          </View>

          {/* Action Buttons */}
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
              <Text className="text-white text-base font-bold ml-2">
                Play All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShuffle}
              disabled={songs.length === 0}
              className="bg-neutral-800 rounded-full p-4"
              activeOpacity={0.8}
            >
              <StyledIonicons name="shuffle" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setShowDeleteModal(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="bg-neutral-800 rounded-full p-4"
              activeOpacity={0.8}
            >
              <StyledIonicons name="trash-outline" size={24} color="#ff0000" />
            </TouchableOpacity>

            <TouchableOpacity
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

          {/* Description Section */}
          {!!playlist.description && (
            <View className="mb-6 bg-neutral-900/50 rounded-2xl p-4 border border-neutral-800">
              <View className="flex-row items-center mb-2">
                <StyledIonicons
                  name="information-circle"
                  size={20}
                  color="#ff0000"
                />
                <Text className="text-white text-base font-bold ml-2">
                  Description
                </Text>
              </View>
              <Text
                className="text-neutral-300 text-sm leading-loose"
                numberOfLines={isDescExpanded ? undefined : 3}
              >
                {playlist.description}
              </Text>
              {playlist.description.length > 100 && (
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

          {/* Songs Header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-2xl font-bold">Songs</Text>
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
              No songs in this playlist
            </Text>
            <Text className="text-neutral-600 text-sm mt-2">
              Add songs to get started
            </Text>
          </View>
        )}
      </Animated.ScrollView>

      {/* Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showEditModal}
        onRequestClose={() => setShowEditModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-end"
          onPress={() => setShowEditModal(false)}
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
              {/* Header with Icon */}
              <View className="items-center mb-6">
                <LinearGradient
                  colors={["#ff6666", "#ff0000"]}
                  className="w-20 h-20 rounded-full items-center justify-center mb-4 shadow-lg"
                >
                  <StyledIonicons
                    name="create"
                    size={40}
                    className="text-white"
                  />
                </LinearGradient>
                <Text className="text-2xl font-bold text-foreground">
                  Edit Playlist
                </Text>
                <Text className="text-muted-foreground text-sm mt-1">
                  Update your playlist details
                </Text>
              </View>

              {/* Name Input */}
              <View className="mb-4">
                <Text className="text-foreground text-sm font-semibold mb-2">
                  Playlist Name
                </Text>
                <TextInput
                  className="w-full bg-card border-2 border-border focus:border-primary rounded-xl px-5 py-4 text-foreground text-lg"
                  placeholder="My awesome playlist"
                  placeholderTextColor="#737373"
                  value={editedName}
                  onChangeText={setEditedName}
                />
              </View>

              {/* Description Input */}
              <View className="mb-6">
                <Text className="text-foreground text-sm font-semibold mb-2">
                  Description (Optional)
                </Text>
                <TextInput
                  className="w-full bg-card border-2 border-border focus:border-primary rounded-xl px-5 py-4 text-foreground text-base"
                  placeholder="Add a description..."
                  placeholderTextColor="#737373"
                  value={editedDescription}
                  onChangeText={setEditedDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setShowEditModal(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className="flex-1 bg-card border border-border px-6 py-4 rounded-xl"
                >
                  <Text className="text-foreground font-bold text-center text-base">
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleEditPlaylist}
                  disabled={!editedName.trim()}
                  className={`flex-1 px-6 py-4 rounded-xl shadow ${
                    !editedName.trim() ? "bg-muted-foreground/30" : "bg-primary"
                  }`}
                >
                  <View className="flex-row items-center justify-center">
                    <StyledIonicons
                      name="checkmark-circle"
                      size={20}
                      className="text-white mr-2"
                    />
                    <Text className="text-white font-bold text-base">Save</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDeleteModal}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-center items-center px-6"
          onPress={() => setShowDeleteModal(false)}
        >
          <Pressable
            className="bg-background rounded-3xl border-2 border-primary shadow-2xl p-6 w-full max-w-sm"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center mb-6">
              <View className="w-20 h-20 rounded-full bg-red-500/20 items-center justify-center mb-4">
                <StyledIonicons name="trash" size={40} color="#ff0000" />
              </View>
              <Text className="text-2xl font-bold text-foreground mb-2">
                Delete Playlist?
              </Text>
              <Text className="text-muted-foreground text-center text-base">
                This action cannot be undone. All songs will be removed from
                this playlist.
              </Text>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteModal(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className="flex-1 bg-card border border-border px-6 py-4 rounded-xl"
              >
                <Text className="text-foreground font-bold text-center text-base">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeletePlaylist}
                className="flex-1 bg-red-500 px-6 py-4 rounded-xl shadow"
              >
                <Text className="text-white font-bold text-center text-base">
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
