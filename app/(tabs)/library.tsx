import { SignInPrompt } from "@/components/auth/SignInPrompt";
import {
  StyledImage as Image,
  StyledSafeAreaView as SafeAreaView,
} from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { useLibrary } from "@/hooks/useLibrary";
import { Artist, Playlist } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Spinner, useToast } from "heroui-native";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

type TabType = "playlists" | "artists";
type ViewMode = "list" | "grid";

export default function Library() {
  const { token, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("playlists");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    likedSongs,
    likedArtists,
    playlists,
    isLoading,
    isRefetching,
    refetch,
    createPlaylist,
    isCreatingPlaylist,
  } = useLibrary();
  const router = useRouter();
  const { toast } = useToast();

  // Filter data based on search query
  const filteredPlaylists = useMemo(() => {
    if (!searchQuery) return playlists;
    return playlists.filter((playlist) =>
      playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [playlists, searchQuery]);

  const filteredArtists = useMemo(() => {
    if (!searchQuery) return likedArtists;
    return likedArtists.filter((artist) =>
      artist.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [likedArtists, searchQuery]);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      toast.show({
        variant: "danger",
        label: "Please enter a playlist name",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
      });
      return;
    }

    try {
      await createPlaylist(newPlaylistName.trim());
      setIsModalVisible(false);
      setNewPlaylistName("");
      toast.show({
        variant: "success",
        label: "Playlist created successfully",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: error.message || "Failed to create playlist",
        icon: <Ionicons name="close-circle" size={24} color="white" />,
      });
    }
  };

  const renderPlaylistItem = ({
    item,
  }: {
    item: Playlist | { id: string; name: string; isLikedSongs: boolean };
  }) => {
    if ("isLikedSongs" in item) {
      if (viewMode === "grid") {
        return (
          <TouchableOpacity
            className="flex-1 mx-2 mb-4"
            style={{ maxWidth: "45%" }}
            onPress={() => {
              router.push("/liked-songs");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <LinearGradient
              colors={["#ff6666", "#ff0000"]}
              className="w-full aspect-square rounded-xl items-center justify-center shadow-lg"
            >
              <StyledIonicons name="heart" size={56} className="text-white" />
            </LinearGradient>
            <Text
              className="text-foreground font-bold text-base mt-2"
              numberOfLines={1}
            >
              Liked Songs
            </Text>
            <Text className="text-muted-foreground text-sm" numberOfLines={1}>
              {likedSongs.length} songs
            </Text>
          </TouchableOpacity>
        );
      }

      return (
        <TouchableOpacity
          className="flex-row items-center mb-3 px-4 py-2 active:bg-card/50 rounded-xl"
          onPress={() => {
            router.push("/liked-songs");
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <LinearGradient
            colors={["#ff6666", "#ff0000"]}
            className="w-16 h-16 rounded-xl items-center justify-center mr-4 shadow"
          >
            <StyledIonicons name="heart" size={32} className="text-white" />
          </LinearGradient>
          <View className="flex-1">
            <Text className="text-foreground font-bold text-lg">
              Liked Songs
            </Text>
            <Text className="text-muted-foreground text-sm">
              Playlist • {likedSongs.length} songs
            </Text>
          </View>
          <StyledIonicons
            name="chevron-forward"
            size={24}
            className="text-muted-foreground"
          />
        </TouchableOpacity>
      );
    }

    const playlist = item as Playlist;

    if (viewMode === "grid") {
      return (
        <TouchableOpacity
          className="flex-1 mx-2 mb-4"
          style={{ maxWidth: "45%" }}
          onPress={() => {
            router.push(`/playlist/${playlist.id}`);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Image
            uri={playlist.coverUrl}
            variant="playlist"
            className="w-full aspect-square rounded-xl shadow-lg"
            contentFit="cover"
          />
          <Text
            className="text-foreground font-bold text-base mt-2"
            numberOfLines={1}
          >
            {playlist.name}
          </Text>
          <Text className="text-muted-foreground text-sm" numberOfLines={1}>
            {playlist.songs?.length || 0} songs
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        className="flex-row items-center mb-3 px-4 py-2 active:bg-card/50 rounded-xl"
        onPress={() => {
          router.push(`/playlist/${playlist.id}`);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <Image
          uri={playlist.coverUrl}
          variant="playlist"
          className="w-16 h-16 rounded-xl mr-4 shadow"
          contentFit="cover"
        />
        <View className="flex-1">
          <Text className="text-foreground font-bold text-lg">
            {playlist.name}
          </Text>
          <Text className="text-muted-foreground text-sm">
            Playlist • {playlist.songs?.length || 0} songs
          </Text>
        </View>
        <StyledIonicons
          name="chevron-forward"
          size={24}
          className="text-muted-foreground"
        />
      </TouchableOpacity>
    );
  };

  const renderArtistItem = ({ item }: { item: Artist }) => {
    if (viewMode === "grid") {
      return (
        <TouchableOpacity
          className="flex-1 mx-2 mb-4 items-center"
          style={{ maxWidth: "45%" }}
          onPress={() => {
            router.push(`/artist/${item.id}`);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Image
            uri={item.imageUrl}
            variant="artist"
            className="w-full aspect-square rounded-full shadow-lg"
            contentFit="cover"
          />
          <Text
            className="text-foreground font-bold text-base mt-2 text-center"
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            className="text-muted-foreground text-sm text-center"
            numberOfLines={1}
          >
            Artist
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        className="flex-row items-center mb-3 px-4 py-2 active:bg-card/50 rounded-xl"
        onPress={() => {
          router.push(`/artist/${item.id}`);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <Image
          uri={item.imageUrl}
          variant="artist"
          className="w-16 h-16 rounded-full mr-4 shadow"
          contentFit="cover"
        />
        <View className="flex-1">
          <Text className="text-foreground font-bold text-lg">{item.name}</Text>
          <Text className="text-muted-foreground text-sm">Artist</Text>
        </View>
        <StyledIonicons
          name="chevron-forward"
          size={24}
          className="text-muted-foreground"
        />
      </TouchableOpacity>
    );
  };

  const refreshControl = (
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={refetch}
      tintColor="#ff0000"
      colors={["#ff0000"]}
    />
  );

  const renderContent = () => {
    if (
      isLoading &&
      !likedSongs.length &&
      !likedArtists.length &&
      !playlists.length
    ) {
      return (
        <View className="flex-1 justify-center items-center">
          <Spinner size="lg" color="#ff0000" />
        </View>
      );
    }

    if (activeTab === "playlists") {
      const data = [
        { id: "liked-songs", name: "Liked Songs", isLikedSongs: true },
        ...filteredPlaylists,
      ];
      return (
        <FlatList
          data={data}
          renderItem={renderPlaylistItem}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === "grid" ? 2 : 1}
          key={viewMode}
          refreshControl={refreshControl}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center pt-20 px-6">
              <StyledIonicons
                name="musical-notes-outline"
                size={80}
                className="text-muted-foreground mb-4"
              />
              <Text className="text-muted-foreground text-lg text-center">
                {searchQuery
                  ? "No playlists found"
                  : "No playlists yet. Create one to get started!"}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          columnWrapperStyle={
            viewMode === "grid" ? { paddingHorizontal: 8 } : undefined
          }
        />
      );
    }

    if (activeTab === "artists") {
      return (
        <FlatList
          data={filteredArtists}
          renderItem={renderArtistItem}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === "grid" ? 2 : 1}
          key={viewMode}
          refreshControl={refreshControl}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center pt-20 px-6">
              <StyledIonicons
                name="people-outline"
                size={80}
                className="text-muted-foreground mb-4"
              />
              <Text className="text-muted-foreground text-lg text-center">
                {searchQuery
                  ? "No artists found"
                  : "No artists yet. Start liking artists!"}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          columnWrapperStyle={
            viewMode === "grid" ? { paddingHorizontal: 8 } : undefined
          }
        />
      );
    }

    return null;
  };

  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <View className="flex-1 justify-center items-center">
          <Spinner size="lg" color="#ff0000" />
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <SignInPrompt
          title="Sign in to open your library"
          description="Save liked songs, follow artists, and create playlists."
          compact
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <View className="px-4 pt-7">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <LinearGradient
              colors={["#ff6666", "#ff0000"]}
              className="w-10 h-10 rounded-full items-center justify-center mr-3 shadow"
            >
              <StyledIonicons name="library" size={22} className="text-white" />
            </LinearGradient>
            <Text className="text-3xl font-bold text-foreground">
              Your Library
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => {
                setViewMode(viewMode === "list" ? "grid" : "list");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="w-10 h-10 rounded-full bg-card items-center justify-center border border-border"
            >
              <StyledIonicons
                name={viewMode === "list" ? "grid" : "list"}
                size={22}
                className="text-foreground"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setIsModalVisible(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="w-10 h-10 rounded-full bg-primary items-center justify-center shadow"
            >
              <StyledIonicons name="add" size={24} className="text-white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Section */}
        <View className="flex-row mb-4 gap-2">
          <View className="flex-1 bg-card rounded-xl p-3 border border-border">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-foreground">
                  {playlists.length}
                </Text>
                <Text className="text-muted-foreground text-xs">Playlists</Text>
              </View>
              <StyledIonicons
                name="musical-notes"
                size={28}
                className="text-primary"
              />
            </View>
          </View>
          <View className="flex-1 bg-card rounded-xl p-3 border border-border">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-foreground">
                  {likedArtists.length}
                </Text>
                <Text className="text-muted-foreground text-xs">Artists</Text>
              </View>
              <StyledIonicons
                name="people"
                size={28}
                className="text-primary"
              />
            </View>
          </View>
          <View className="flex-1 bg-card rounded-xl p-3 border border-border">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-foreground">
                  {likedSongs.length}
                </Text>
                <Text className="text-muted-foreground text-xs">Songs</Text>
              </View>
              <StyledIonicons name="heart" size={28} className="text-primary" />
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-card rounded-xl px-4 py-3 mb-4 border border-border">
          <StyledIonicons
            name="search"
            size={20}
            className="text-muted-foreground mr-3"
          />
          <TextInput
            className="flex-1 text-foreground text-base"
            placeholder={`Search ${activeTab}...`}
            placeholderTextColor="#737373"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              className="ml-2"
            >
              <StyledIonicons
                name="close-circle"
                size={20}
                className="text-muted-foreground"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Buttons */}
        <View className="flex-row gap-2 mb-4">
          <TouchableOpacity
            onPress={() => {
              setActiveTab("playlists");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`flex-1 px-4 py-3 rounded-xl ${activeTab === "playlists"
              ? "bg-primary shadow"
              : "bg-card border border-border"
              }`}
          >
            <View className="flex-row items-center justify-center">
              <StyledIonicons
                name="musical-notes"
                size={18}
                className={
                  activeTab === "playlists" ? "text-white" : "text-foreground"
                }
              />
              <Text
                className={`font-semibold ml-2 ${activeTab === "playlists" ? "text-white" : "text-foreground"
                  }`}
              >
                Playlists
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setActiveTab("artists");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`flex-1 px-4 py-3 rounded-xl ${activeTab === "artists"
              ? "bg-primary shadow"
              : "bg-card border border-border"
              }`}
          >
            <View className="flex-row items-center justify-center">
              <StyledIonicons
                name="people"
                size={18}
                className={
                  activeTab === "artists" ? "text-white" : "text-foreground"
                }
              />
              <Text
                className={`font-semibold ml-2 ${activeTab === "artists" ? "text-white" : "text-foreground"
                  }`}
              >
                Artists
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {renderContent()}

      {/* Create Playlist Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-end"
          onPress={() => setIsModalVisible(false)}
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
                    name="musical-notes"
                    size={40}
                    className="text-white"
                  />
                </LinearGradient>
                <Text className="text-2xl font-bold text-foreground">
                  Create Playlist
                </Text>
                <Text className="text-muted-foreground text-sm mt-1">
                  Give your playlist a unique name
                </Text>
              </View>

              {/* Input Field */}
              <View className="mb-6">
                <TextInput
                  className="w-full bg-card border-2 border-border focus:border-primary rounded-xl px-5 py-4 text-foreground text-lg"
                  placeholder="My awesome playlist"
                  placeholderTextColor="#737373"
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  autoFocus
                />
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setIsModalVisible(false);
                    setNewPlaylistName("");
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className="flex-1 bg-card border border-border px-6 py-4 rounded-xl"
                >
                  <Text className="text-foreground font-bold text-center text-base">
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCreatePlaylist}
                  disabled={isCreatingPlaylist || !newPlaylistName.trim()}
                  className={`flex-1 px-6 py-4 rounded-xl shadow ${isCreatingPlaylist || !newPlaylistName.trim()
                    ? "bg-muted-foreground/30"
                    : "bg-primary"
                    }`}
                >
                  {isCreatingPlaylist ? (
                    <Spinner color="white" size="sm" />
                  ) : (
                    <View className="flex-row items-center justify-center">
                      <StyledIonicons
                        name="checkmark-circle"
                        size={20}
                        className="text-white mr-2"
                      />
                      <Text className="text-white font-bold text-base">
                        Create
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
