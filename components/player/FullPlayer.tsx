import { StyledImage as Image } from "@/components/styled";
import { usePlayer } from "@/context/PlayerContext";
import { useLikeSong } from "@/hooks/useLikeSong";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { withUniwind } from "uniwind";

const StyledLinearGradient = withUniwind(ExpoLinearGradient);
const StyledIonicons = withUniwind(Ionicons);
const StyledSlider = withUniwind(Slider);
const StyledAnimatedView = withUniwind(Animated.View);

const { width, height } = Dimensions.get("window");

// Lead time to make lyrics feel more on-beat (in seconds)
// Reduced from 0.15 to 0.12 for better synchronization
const SYNC_LEAD_SECONDS = 0.12;

// Binary search to find the correct lyric index for a given time
// More accurate and efficient than linear search
function findLyricIndexByTime(
  lyrics: { text: string; time: number }[],
  time: number
): number {
  if (!lyrics.length) return -1;

  const times = lyrics.map((l) => l.time);
  let lo = 0;
  let hi = times.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] === time) {
      return mid;
    }
    if (times[mid] < time) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return Math.max(0, lo - 1);
}

interface LyricItemProps {
  lyric: { text: string; time: number };
  isActive: boolean;
  fontSizeClass: string;
}

const LyricItem = memo(({ lyric, isActive, fontSizeClass }: LyricItemProps) => (
  <Text
    className={`${fontSizeClass} font-bold mb-6 ${isActive ? "text-white" : "text-white/30"
      }`}
  >
    {lyric.text}
  </Text>
));

LyricItem.displayName = "LyricItem";

interface LyricsListProps {
  lyrics: { text: string; time: number }[];
  activeIndex: number;
  fontSizeClass: string;
  onClose: () => void;
  currentSong: any;
  coverUrl: string;
  artistName: string;
}

const LyricsList = memo(
  ({
    lyrics,
    activeIndex,
    fontSizeClass,
    onClose,
    currentSong,
    coverUrl,
    artistName,
  }: LyricsListProps) => {
    const flatListRef = useRef<FlatList>(null);
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      if (!isUserScrolling && flatListRef.current && activeIndex !== -1) {
        flatListRef.current.scrollToIndex({
          index: activeIndex,
          animated: true,
          viewPosition: 0.3,
        });
      }
    }, [activeIndex, isUserScrolling]);

    const onScrollBeginDrag = () => {
      setIsUserScrolling(true);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };

    const onScrollEndDrag = () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
      }, 3000);
    };

    return (
      <View className="flex-1 px-8">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onClose}
          className="flex-row items-center mb-10"
        >
          <Image
            source={{ uri: coverUrl }}
            className="w-16 h-16 rounded-lg"
            contentFit="cover"
          />
          <View className="ml-4 flex-1">
            <Text className="text-white text-xl font-bold" numberOfLines={1}>
              {currentSong.title}
            </Text>
            <Text className="text-neutral-400 text-base" numberOfLines={1}>
              {artistName}
            </Text>
          </View>
        </TouchableOpacity>

        <FlatList
          ref={flatListRef}
          data={lyrics}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item, index }) => (
            <LyricItem
              lyric={item}
              isActive={index === activeIndex}
              fontSizeClass={fontSizeClass}
            />
          )}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onScrollEndDrag}
          contentContainerStyle={{ paddingBottom: 100 }}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
        />
      </View>
    );
  }
);

LyricsList.displayName = "LyricsList";

export function FullPlayer() {
  const router = useRouter();
  const {
    currentSong,
    isPlaying,
    currentTime: contextCurrentTime,
    duration,
    isShuffled,
    repeatMode,
    togglePlay,
    nextSong,
    prevSong,
    seekTo,
    setIsShuffled,
    setRepeatMode,
  } = usePlayer();

  const { isLikedSong, toggleLike } = useLikeSong();

  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsFontSize, setLyricsFontSize] = useState<
    "small" | "medium" | "large"
  >("medium");
  const [isSliding, setIsSliding] = useState(false);
  const [slidingValue, setSlidingValue] = useState(0);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const panY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  // Use local state that updates more frequently for smoother lyrics
  // This local state is synced with context but can update faster
  const currentTime = localCurrentTime;

  // Sync local time with context time
  useEffect(() => {
    setLocalCurrentTime(contextCurrentTime);
  }, [contextCurrentTime]);

  // High-frequency time updates for smooth lyrics synchronization
  // Uses setInterval to interpolate between context updates
  useEffect(() => {
    if (isPlaying) {
      let lastUpdateTime = Date.now();
      let baseTime = contextCurrentTime;

      const intervalId = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastUpdateTime) / 1000; // Convert to seconds

        // Interpolate time between updates
        setLocalCurrentTime((prev) => {
          const interpolated = baseTime + elapsed;
          // Don't go beyond duration
          return Math.min(interpolated, duration || Infinity);
        });
      }, 50); // Update every 50ms (20fps)

      return () => {
        clearInterval(intervalId);
      };
    } else {
      // When paused, just use the context time
      setLocalCurrentTime(contextCurrentTime);
    }
  }, [isPlaying, contextCurrentTime, duration]);

  // Rotation animation for album art
  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 20000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotation.stopAnimation();
    }
  }, [isPlaying, rotation]);

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Pan responder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
          scale.setValue(1 - gestureState.dy / height);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150) {
          router.back();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const lyrics = useMemo(
    () => currentSong?.lyrics ?? [],
    [currentSong?.lyrics]
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
      currentSong?.coverUrl ||
      ""
    );
  };

  const activeIndex = useMemo(() => {
    if (!lyrics.length) return -1;
    const targetTime = Math.max(0, currentTime + SYNC_LEAD_SECONDS);
    return findLyricIndexByTime(lyrics, targetTime);
  }, [lyrics, currentTime]);

  const currentLyric = useMemo(() => {
    if (!lyrics.length || activeIndex === -1) return null;
    return lyrics[activeIndex];
  }, [lyrics, activeIndex]);

  const toggleRepeat = () => {
    const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setRepeatMode(nextMode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleShuffle = () => {
    setIsShuffled(!isShuffled);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleFontSize = () => {
    const sizes: ("small" | "medium" | "large")[] = [
      "small",
      "medium",
      "large",
    ];
    const currentIndex = sizes.indexOf(lyricsFontSize);
    const nextSize = sizes[(currentIndex + 1) % sizes.length];
    setLyricsFontSize(nextSize);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getFontSizeClass = () => {
    switch (lyricsFontSize) {
      case "small":
        return "text-xl";
      case "medium":
        return "text-2xl";
      case "large":
        return "text-3xl";
      default:
        return "text-2xl";
    }
  };

  const getIconSize = () => {
    switch (lyricsFontSize) {
      case "small":
        return 16;
      case "medium":
        return 22;
      case "large":
        return 28;
      default:
        return 22;
    }
  };

  return (
    <StyledAnimatedView
      className="flex-1"
      style={{
        transform: [{ translateY: panY }, { scale }],
      }}
    >
      <StyledLinearGradient
        colors={["#0a0a0a", "#1a1a1a", "#0a0a0a"]}
        className="flex-1"
      >
        <View className="flex-1 pt-2">
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 pb-5"
            {...panResponder.panHandlers}
          >
            <TouchableOpacity
              onPress={() => {
                router.back();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="p-2"
            >
              <StyledIonicons name="chevron-down" size={28} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-base font-semibold">
              Now Playing
            </Text>
            <TouchableOpacity className="p-2">
              <StyledIonicons
                name="ellipsis-horizontal"
                size={28}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          <View className="flex-1 justify-between pb-10">
            {!showLyrics ? (
              <>
                {/* Album Art */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setShowLyrics(true)}
                  className="items-center justify-center px-10 mb-10"
                >
                  <StyledAnimatedView
                    style={{
                      width: width * 0.8,
                      height: width * 0.8,
                      borderRadius: (width * 0.8) / 2,
                      overflow: "hidden",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 0.5,
                      shadowRadius: 20,
                      elevation: 10,
                      transform: [{ rotate: rotateInterpolate }],
                    }}
                  >
                    <Image
                      source={{ uri: getCoverUrl() }}
                      className="w-full h-full"
                      contentFit="cover"
                    />
                  </StyledAnimatedView>
                </TouchableOpacity>

                {/* Song Info */}
                <View className="px-8 mb-8 flex-row items-center">
                  <View className="flex-1 items-center">
                    <Text
                      className="text-white text-2xl font-bold text-center mb-2"
                      numberOfLines={2}
                    >
                      {currentSong?.title || "Unknown Song"}
                    </Text>
                    <Text
                      className="text-neutral-400 text-base text-center"
                      numberOfLines={1}
                    >
                      {getArtistName()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      currentSong?.id && toggleLike(currentSong.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                    className="ml-2 p-2"
                  >
                    <StyledIonicons
                      name={
                        currentSong?.id && isLikedSong(currentSong.id)
                          ? "heart"
                          : "heart-outline"
                      }
                      size={32}
                      color={
                        currentSong?.id && isLikedSong(currentSong.id)
                          ? "#ff0000"
                          : "#fff"
                      }
                    />
                  </TouchableOpacity>
                </View>

                {/* Current Lyric Snippet */}
                {currentLyric && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowLyrics(true)}
                    className="px-8 mb-8"
                  >
                    <Text className="text-white text-lg font-semibold text-center opacity-80">
                      {currentLyric.text}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View className="flex-1">
                <LyricsList
                  lyrics={currentSong?.lyrics || []}
                  activeIndex={activeIndex}
                  fontSizeClass={getFontSizeClass()}
                  onClose={() => setShowLyrics(false)}
                  currentSong={currentSong}
                  coverUrl={getCoverUrl()}
                  artistName={getArtistName()}
                />

                {/* Lyrics Controls */}
                <View className="absolute bottom-5 right-5 flex-row">
                  <TouchableOpacity
                    onPress={toggleFontSize}
                    className="w-12 h-12 bg-white/10 rounded-xl items-center justify-center"
                  >
                    <StyledIonicons
                      name="text"
                      size={getIconSize()}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Progress Bar */}
            <View className="px-5 mb-5">
              <StyledSlider
                className="w-full h-10"
                minimumValue={0}
                maximumValue={duration || 1}
                value={isSliding ? slidingValue : currentTime}
                minimumTrackTintColor="#ff0000"
                maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
                thumbTintColor="#ff0000"
                onValueChange={(value) => {
                  setSlidingValue(value);
                  setIsSliding(true);
                }}
                onSlidingComplete={(value) => {
                  seekTo(value);
                  setIsSliding(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              />
              <View className="flex-row justify-between px-4 -mt-2.5">
                <Text className="text-neutral-400 text-xs">
                  {formatTime(isSliding ? slidingValue : currentTime)}
                </Text>
                <Text className="text-neutral-400 text-xs">
                  {formatTime(duration)}
                </Text>
              </View>
            </View>

            {/* Main Controls */}
            <View className="flex-row items-center justify-between px-10 mb-8">
              <TouchableOpacity onPress={toggleShuffle} className="p-2">
                <StyledIonicons
                  name="shuffle"
                  size={24}
                  color={isShuffled ? "#ff0000" : "#a3a3a3"}
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={prevSong} className="p-2">
                <StyledIonicons name="play-skip-back" size={32} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  togglePlay();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                className="w-[70] h-[70] rounded-[35] bg-red-600 items-center justify-center shadow-red-600 shadow-opacity-50 shadow-radius-8 elevation-8"
              >
                <StyledIonicons
                  name={isPlaying ? "pause" : "play"}
                  size={36}
                  color="#fff"
                  style={{ marginLeft: isPlaying ? 0 : 3 }}
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={nextSong} className="p-2">
                <StyledIonicons
                  name="play-skip-forward"
                  size={32}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={toggleRepeat}
                className="p-2 items-center justify-center"
              >
                <StyledIonicons
                  name={repeatMode === "off" ? "repeat-outline" : "repeat"}
                  size={24}
                  color={repeatMode !== "off" ? "#ff0000" : "#a3a3a3"}
                />
                {repeatMode === "one" && (
                  <View
                    className="absolute items-center justify-center"
                    style={{ width: 24, height: 24 }}
                  >
                    <Text
                      className="text-[8px] font-bold text-red-600"
                      style={{ marginTop: 2 }}
                    >
                      1
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </StyledLinearGradient>
    </StyledAnimatedView>
  );
}
