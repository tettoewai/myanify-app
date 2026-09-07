import { StyledImage as Image } from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { AppColors } from "@/lib/colors";
import { getSongCoverUrl } from "@/lib/song-cover";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

export function MiniPlayer({ bottomOffset }: { bottomOffset?: number }) {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
  } = usePlayer();

  const animationDuration = 500;

  // Hide mini player when on the full player route or if no session
  const segmentsArray = segments as string[];
  const isOnPlayerPage =
    segmentsArray.includes("player") || segmentsArray.includes("song");
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
    !isLandingPage;

  const TAB_BAR_HEIGHT = 60 + insets.bottom;
  const targetBottom =
    bottomOffset !== undefined ? bottomOffset + insets.bottom : TAB_BAR_HEIGHT;

  const opacity = useSharedValue(shouldBeVisible ? 1 : 0);
  const translateY = useSharedValue(shouldBeVisible ? 0 : 100);
  const bottomShared = useSharedValue(targetBottom);

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
      bottomShared.value = withTiming(targetBottom, {
        duration: animationDuration,
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
      bottomShared.value = withTiming(-100, {
        duration: animationDuration,
      });
    }
  }, [shouldBeVisible, targetBottom, opacity, translateY, bottomShared, animationDuration]);

  const progress = duration > 0 ? currentTime / duration : 0;

  const getArtistName = () => {
    if (currentSong?.artist) return currentSong.artist;
    if (currentSong?.artists && currentSong.artists.length > 0) {
      return currentSong.artists.map((a) => a.artist.name).join(", ");
    }
    return "Unknown Artist";
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
      <View className="overflow-hidden bg-[#1a1a1a]/95">
        {/* Progress Bar */}
        <View className="h-0.5 bg-white/10">
          <View
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
          className="flex-row items-center px-3 py-2 gap-3"
        >
          {/* Album Art */}
          <View className="w-10 h-10 rounded-full overflow-hidden">
            <Image
              uri={getSongCoverUrl(currentSong)}
              variant="album"
              className="w-full h-full"
              contentFit="cover"
            />
          </View>

          {/* Song Info */}
          <View className="flex-1">
            <Text
              className="text-sm font-semibold leading-loose"
              style={{ color: AppColors.foreground }}
              numberOfLines={1}
            >
              {currentSong.title}
            </Text>
            <Text
              className="text-xs leading-loose"
              style={{ color: AppColors.mutedForeground }}
              numberOfLines={1}
            >
              {getArtistName()}
            </Text>
          </View>

          {/* Play / Pause */}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              togglePlay();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            className="w-10 h-10 items-center justify-center rounded-full bg-primary"
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
