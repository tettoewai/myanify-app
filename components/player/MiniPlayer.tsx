import { StyledImage as Image } from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { apiClient } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";

export function MiniPlayer({ bottomOffset }: { bottomOffset?: number }) {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const isDark = theme === "dark";
  const { token } = useAuth();
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    nextSong,
  } = usePlayer();

  const { isLikedSong, toggleLike } = useLikeSong();
  const animationDuration = 500;

  // Fetch play history to check if user has any recent plays
  const { data: playHistoryData, isLoading: isLoadingPlayHistory } = useQuery({
    queryKey: ["play-history", "check"],
    queryFn: () => apiClient.get("/play-history?limit=1"),
    enabled: !!token,
  });

  const hasPlayHistory =
    playHistoryData?.data && playHistoryData.data.length > 0;

  // Hide mini player when on player page or if no session
  const segmentsArray = segments as string[];
  const isOnPlayerPage = segmentsArray.includes("player");
  const isAuthPage = segmentsArray.includes("(auth)");
  const isLandingPage =
    segmentsArray.length === 0 ||
    (segmentsArray.length === 1 && segmentsArray[0] === "index");

  // Determine if miniplayer should be visible
  const shouldBeVisible =
    !!token &&
    !!currentSong &&
    !isOnPlayerPage &&
    !isAuthPage &&
    !isLandingPage &&
    (isLoadingPlayHistory || hasPlayHistory);

  const TAB_BAR_HEIGHT = 60 + insets.bottom;
  const targetBottom =
    bottomOffset !== undefined ? bottomOffset : TAB_BAR_HEIGHT;

  const opacity = useSharedValue(shouldBeVisible ? 1 : 0);
  const translateY = useSharedValue(shouldBeVisible ? 0 : 100);
  const bottomShared = useSharedValue(targetBottom);

  useEffect(() => {
    bottomShared.value = withTiming(targetBottom, {
      duration: animationDuration,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    });
  }, [targetBottom, bottomShared]);

  useEffect(() => {
    if (shouldBeVisible) {
      opacity.value = withTiming(1, {
        duration: animationDuration,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      });
      translateY.value = withTiming(0, {
        duration: animationDuration,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      });
    } else {
      opacity.value = withTiming(0, {
        duration: animationDuration,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      });
      translateY.value = withTiming(100, {
        duration: animationDuration,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      });
    }
  }, [shouldBeVisible, opacity, translateY]);

  const progress = duration > 0 ? currentTime / duration : 0;

  const getArtistName = () => {
    if (currentSong?.artist) return currentSong.artist;
    if (currentSong?.artists && currentSong.artists.length > 0) {
      return currentSong.artists.map((a) => a.artist.name).join(", ");
    }
    return "Unknown Artist";
  };

  const getCoverUrl = () => {
    return (
      currentSong?.albumCoverUrl ||
      currentSong?.album?.coverUrl ||
      currentSong?.coverUrl
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    bottom: bottomShared.value,
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!shouldBeVisible) {
    return null;
  }

  return (
    <Animated.View style={animatedStyle}>
      <LinearGradient
        colors={
          isDark
            ? ["rgba(26, 26, 26, 0.95)", "#0a0a0a"]
            : ["rgba(245, 245, 245, 0.95)", "#ffffff"]
        }
        className="border-b-0 m-0 p-0"
      >
        {/* Progress Bar */}
        <View
          className={isDark ? "h-[2px] bg-white/10" : "h-[2px] bg-black/10"}
        >
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
              className={`${isDark ? "text-white" : "text-foreground"
                } text-base font-semibold mb-1`}
              numberOfLines={1}
            >
              {currentSong.title}
            </Text>
            <Text
              className={`${isDark ? "text-[#a3a3a3]" : "text-muted-foreground"
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
    </Animated.View>
  );
}
