import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StyledImage as Image } from "@/components/styled";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useSegments } from "expo-router";
import React from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";

export function MiniPlayer({ bottomOffset }: { bottomOffset?: number }) {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const isDark = theme === "dark";
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    nextSong,
  } = usePlayer();

  const { isLikedSong, toggleLike } = useLikeSong();

  // Hide mini player when on player page
  const isOnPlayerPage = (segments as string[]).includes("player");
  if (!currentSong || isOnPlayerPage) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const TAB_BAR_HEIGHT = 60 + insets.bottom;

  const getArtistName = () => {
    if (currentSong.artist) return currentSong.artist;
    if (currentSong.artists && currentSong.artists.length > 0) {
      return currentSong.artists.map((a) => a.artist.name).join(", ");
    }
    return "Unknown Artist";
  };

  const getCoverUrl = () => {
    return (
      currentSong.albumCoverUrl ||
      currentSong.album?.coverUrl ||
      currentSong.coverUrl
    );
  };

  return (
    <LinearGradient
      colors={
        isDark
          ? ["rgba(26, 26, 26, 0.95)", "#0a0a0a"]
          : ["rgba(245, 245, 245, 0.95)", "#ffffff"]
      }
      className="absolute left-0 right-0 z-10 border-b-0 m-0 p-0"
      style={{
        bottom: bottomOffset !== undefined ? bottomOffset : TAB_BAR_HEIGHT,
      }}
    >
      {/* Progress Bar */}
      <View className={isDark ? "h-[2px] bg-white/10" : "h-[2px] bg-black/10"}>
        <Animated.View
          className="h-full bg-primary"
          style={{
            width: `${progress * 100}%`,
          }}
        />
      </View>

      <TouchableOpacity
        onPress={() => {
          router.push("/player");
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        activeOpacity={0.9}
        className="flex-row items-center px-4 py-3"
      >
        {/* Album Art */}
        <View className="w-14 h-14 rounded-lg overflow-hidden mr-3">
          <Image
            source={{ uri: getCoverUrl() }}
            className="w-full h-full"
            contentFit="cover"
          />
        </View>

        {/* Song Info */}
        <View className="flex-1 mr-3">
          <Text
            className={`${
              isDark ? "text-white" : "text-foreground"
            } text-base font-semibold mb-1`}
            numberOfLines={1}
          >
            {currentSong.title}
          </Text>
          <Text
            className={`${
              isDark ? "text-[#a3a3a3]" : "text-muted-foreground"
            } text-sm`}
            numberOfLines={1}
          >
            {getArtistName()}
          </Text>
        </View>

        {/* Controls */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              toggleLike(currentSong.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="p-2"
          >
            <Ionicons
              name={isLikedSong(currentSong.id) ? "heart" : "heart-outline"}
              size={24}
              color={
                isLikedSong(currentSong.id)
                  ? "#ff0000"
                  : isDark
                  ? "white"
                  : "#0a0a0a"
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              togglePlay();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            className="p-2"
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={28}
              color={isDark ? "white" : "#0a0a0a"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              nextSong();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="p-2"
          >
            <Ionicons
              name="play-skip-forward"
              size={24}
              color={isDark ? "white" : "#0a0a0a"}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </LinearGradient>
  );
}
