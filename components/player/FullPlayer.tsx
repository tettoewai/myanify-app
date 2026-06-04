import { StyledImage as Image } from "@/components/styled";
import { usePlayer } from "@/context/PlayerContext";
import { UpNextSheet } from "@/components/player/UpNextSheet";
import { useLikeSong } from "@/hooks/useLikeSong";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
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

/** Vertical padding so active lines can center without clipping Myanmar glyphs at the top. */
const LYRICS_SCROLL_PADDING_TOP = Math.round(height * 0.22);
const LYRICS_SCROLL_PADDING_BOTTOM = Math.round(height * 0.32);

// Lead time to make lyrics feel more on-beat (in seconds)
const SYNC_LEAD_SECONDS = 0.12;

function splitLyricLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Same nominal size for Myanmar and English; line height scales with font size. */
function getLyricTypography(fontSize: "small" | "medium" | "large") {
  switch (fontSize) {
    case "medium":
      return { size: 15 };
    case "large":
      return { size: 17 };
    case "small":
    default:
      return { size: 14 };
  }
}

function lyricLineHeight(fontSizePx: number) {
  return Math.round(fontSizePx * 1.35);
}

// Binary search to find the correct lyric index for a given time
function findLyricIndexByTime(
  lyrics: { text: string; time: number }[],
  time: number,
): number {
  if (!lyrics.length) return -1;

  const times = lyrics.map((l) => l.time);
  let lo = 0;
  let hi = times.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] === time) return mid;
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
  fontSize: "small" | "medium" | "large";
}

const LyricItem = memo(({ lyric, isActive, fontSize }: LyricItemProps) => {
  const lines = splitLyricLines(lyric.text);
  const { size: fontSizePx } = getLyricTypography(fontSize);
  const lineHeight = lyricLineHeight(fontSizePx);
  const primaryColor = isActive ? "#ef4444" : "rgba(255,255,255,0.4)";
  const secondaryColor = isActive
    ? "rgba(255,255,255,0.75)"
    : "rgba(255,255,255,0.28)";

  return (
    <View className="mb-5 px-4" style={{ overflow: "visible" }}>
      {lines.map((line, lineIndex) => {
        const isPrimaryLine = lineIndex === 0;

        return (
          <Text
            key={`${lineIndex}-${line.slice(0, 12)}`}
            className="text-center pt-2"
            allowFontScaling={false}
            style={{
              color: isPrimaryLine ? primaryColor : secondaryColor,
              fontSize: fontSizePx,
              lineHeight,
              fontWeight: isActive ? (isPrimaryLine ? "600" : "400") : "400",
              marginTop: lineIndex > 0 ? 4 : 0,
              includeFontPadding: false,
            }}
          >
            {line}
          </Text>
        );
      })}
    </View>
  );
});

LyricItem.displayName = "LyricItem";

interface LyricsListProps {
  lyrics: { text: string; time: number }[];
  activeIndex: number;
  fontSize: "small" | "medium" | "large";
  onClose: () => void;
  currentSong: any;
  coverUrl: string;
  artistName: string;
}

const LyricsList = memo(
  ({
    lyrics,
    activeIndex,
    fontSize,
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
          viewPosition: 0.5,
        });
      }
    }, [activeIndex, isUserScrolling]);

    useEffect(() => {
      return () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }, []);

    const onScrollBeginDrag = useCallback(() => {
      setIsUserScrolling(true);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    }, []);

    const onScrollEndDrag = useCallback(() => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
      }, 3000);
    }, []);

    return (
      <View className="flex-1 px-6">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onClose}
          className="flex-row items-center mb-4"
        >
          <Image
            uri={coverUrl}
            variant="album"
            className="w-14 h-14 rounded-lg"
            contentFit="cover"
          />
          <View className="ml-3 flex-1">
            <Text
              className="text-white text-base font-semibold leading-loose pt-2"
              numberOfLines={2}
              allowFontScaling={false}
              style={{ lineHeight: 22, includeFontPadding: false }}
            >
              {currentSong?.title || "Unknown Song"}
            </Text>
            <Text
              className="text-neutral-400 text-sm leading-loose pt-2"
              numberOfLines={1}
              allowFontScaling={false}
              style={{ lineHeight: 18, includeFontPadding: false }}
            >
              {artistName}
            </Text>
          </View>
        </TouchableOpacity>

        <FlatList
          ref={flatListRef}
          style={{ flex: 1 }}
          data={lyrics}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item, index }) => (
            <LyricItem
              lyric={item}
              isActive={index === activeIndex}
              fontSize={fontSize}
            />
          )}
          showsVerticalScrollIndicator={false}
          clipToPadding={false}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onScrollEndDrag}
          contentContainerStyle={{
            paddingTop: LYRICS_SCROLL_PADDING_TOP,
            paddingBottom: LYRICS_SCROLL_PADDING_BOTTOM,
          }}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
        />
      </View>
    );
  },
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
    isLoading,
    error,
    togglePlay,
    nextSong,
    prevSong,
    seekTo,
    setIsShuffled,
    setRepeatMode,
    clearError,
    upNext,
    radioMode,
  } = usePlayer();

  const { isLikedSong, toggleLike } = useLikeSong();

  const [showUpNext, setShowUpNext] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsFontSize, setLyricsFontSize] = useState<
    "small" | "medium" | "large"
  >("small");
  const [isSliding, setIsSliding] = useState(false);
  const [slidingValue, setSlidingValue] = useState(0);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);

  const panY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const rotationAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const currentTime = localCurrentTime;

  // Sync local time with context time
  useEffect(() => {
    setLocalCurrentTime(contextCurrentTime);
  }, [contextCurrentTime]);

  // High-frequency time updates for smooth lyrics synchronization
  useEffect(() => {
    if (isPlaying && duration > 0) {
      let lastUpdateTime = Date.now();
      let baseTime = contextCurrentTime;

      const intervalId = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastUpdateTime) / 1000;
        const interpolated = baseTime + elapsed;
        setLocalCurrentTime(Math.min(interpolated, duration));
      }, 50);

      return () => clearInterval(intervalId);
    } else {
      setLocalCurrentTime(contextCurrentTime);
    }
  }, [isPlaying, contextCurrentTime, duration]);

  // Rotation animation for album art
  useEffect(() => {
    if (isPlaying && !showLyrics) {
      rotationAnimation.current = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 20000,
          useNativeDriver: true,
        }),
      );
      rotationAnimation.current.start();
    } else {
      if (rotationAnimation.current) {
        rotationAnimation.current.stop();
        rotationAnimation.current = null;
      }
    }

    return () => {
      if (rotationAnimation.current) {
        rotationAnimation.current.stop();
      }
    };
  }, [isPlaying, rotation, showLyrics]);

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Pan responder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && !showLyrics;
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
          Animated.parallel([
            Animated.spring(panY, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(scale, {
              toValue: 1,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    }),
  ).current;

  const lyrics = useMemo(
    () => currentSong?.lyrics ?? [],
    [currentSong?.lyrics],
  );

  const formatTime = useCallback((seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const getArtistName = useCallback(() => {
    if (currentSong?.artist) return currentSong.artist;
    if (currentSong?.artists && currentSong.artists.length > 0) {
      return currentSong.artists.map((a) => a.artist.name).join(", ");
    }
    return "Unknown Artist";
  }, [currentSong]);

  const getCoverUrl = useCallback(() => {
    return (
      currentSong?.albumCoverUrl ||
      currentSong?.album?.coverUrl ||
      currentSong?.coverUrl ||
      ""
    );
  }, [currentSong]);

  const activeIndex = useMemo(() => {
    if (!lyrics.length) return -1;
    const targetTime = Math.max(0, currentTime + SYNC_LEAD_SECONDS);
    return findLyricIndexByTime(lyrics, targetTime);
  }, [lyrics, currentTime]);

  const currentLyric = useMemo(() => {
    if (!lyrics.length || activeIndex === -1) return null;
    return lyrics[activeIndex];
  }, [lyrics, activeIndex]);

  const toggleRepeat = useCallback(() => {
    const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setRepeatMode(nextMode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [repeatMode, setRepeatMode]);

  const toggleShuffle = useCallback(() => {
    setIsShuffled(!isShuffled);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isShuffled, setIsShuffled]);

  const toggleFontSize = useCallback(() => {
    const sizes: ("small" | "medium" | "large")[] = [
      "small",
      "medium",
      "large",
    ];
    const currentIndex = sizes.indexOf(lyricsFontSize);
    const nextSize = sizes[(currentIndex + 1) % sizes.length];
    setLyricsFontSize(nextSize);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [lyricsFontSize]);

  const getIconSize = useCallback(() => {
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
  }, [lyricsFontSize]);

  const handleSeekStart = useCallback((value: number) => {
    setSlidingValue(value);
    setIsSliding(true);
  }, []);

  const handleSeekComplete = useCallback(
    (value: number) => {
      seekTo(value);
      setIsSliding(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [seekTo],
  );

  const handlePlayPause = useCallback(() => {
    togglePlay();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [togglePlay]);

  const handleClose = useCallback(() => {
    router.back();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [router]);

  const handleLikeToggle = useCallback(() => {
    if (currentSong?.id) {
      toggleLike(currentSong.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [currentSong?.id, toggleLike]);

  if (!currentSong) {
    return (
      <StyledAnimatedView className="flex-1 bg-black items-center justify-center">
        <Text className="text-white text-lg">No song selected</Text>
        <TouchableOpacity
          onPress={handleClose}
          className="mt-4 px-6 py-3 bg-white/10 rounded-lg"
        >
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </StyledAnimatedView>
    );
  }

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
        <View className="flex-1">
          {/* Header — hidden in lyrics mode to leave room for Myanmar script at the top */}
          {!showLyrics && (
            <View
              className="flex-row items-center justify-between px-5 pb-5"
              {...panResponder.panHandlers}
            >
              <TouchableOpacity onPress={handleClose} className="p-2">
                <StyledIonicons name="chevron-down" size={28} color="#fff" />
              </TouchableOpacity>
              <Text className="text-white text-base font-semibold">
                Now Playing
              </Text>
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => setShowUpNext(true)}
                  className="p-2 relative"
                >
                  <StyledIonicons name="list" size={26} color="#fff" />
                  {radioMode && (
                    <View className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLikeToggle} className="p-2">
                  <StyledIonicons
                    name={
                      currentSong?.id && isLikedSong(currentSong.id)
                        ? "heart"
                        : "heart-outline"
                    }
                    size={26}
                    color={
                      currentSong?.id && isLikedSong(currentSong.id)
                        ? "#ff0000"
                        : "#fff"
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showLyrics && (
            <View className="flex-row items-center justify-between px-5 pb-2">
              <TouchableOpacity onPress={handleClose} className="p-2">
                <StyledIonicons name="chevron-down" size={28} color="#fff" />
              </TouchableOpacity>
              <View className="flex-row items-center">
                <TouchableOpacity onPress={handleLikeToggle} className="p-2">
                  <StyledIonicons
                    name={
                      currentSong?.id && isLikedSong(currentSong.id)
                        ? "heart"
                        : "heart-outline"
                    }
                    size={26}
                    color={
                      currentSong?.id && isLikedSong(currentSong.id)
                        ? "#ff0000"
                        : "#fff"
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowLyrics(false)}
                  className="p-2"
                >
                  <StyledIonicons name="musical-notes" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Error banner */}
          {error && (
            <View className="mx-5 mb-3 bg-red-500/20 rounded-lg p-3 flex-row items-center justify-between">
              <Text className="text-red-400 flex-1 text-sm">{error}</Text>
              <TouchableOpacity onPress={clearError} className="ml-2 p-1">
                <StyledIonicons name="close" size={20} color="#ff4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <View className="absolute top-12 right-5 z-10">
              <ActivityIndicator size="small" color="#ff0000" />
            </View>
          )}

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
                      uri={getCoverUrl()}
                      variant="album"
                      className="w-full h-full"
                      contentFit="cover"
                    />
                  </StyledAnimatedView>
                </TouchableOpacity>

                {/* Song Info */}
                <View className="px-8 mb-8 items-center">
                  <Text
                    className="text-white text-xl font-bold text-center leading-loose"
                    numberOfLines={2}
                  >
                    {currentSong.title || "Unknown Song"}
                  </Text>
                  <Text
                    className="text-neutral-400 text-base text-center leading-loose"
                    numberOfLines={1}
                  >
                    {getArtistName()}
                  </Text>
                  {upNext[0] && (
                    <Text
                      className="text-neutral-500 text-xs text-center mt-1"
                      numberOfLines={1}
                    >
                      Up next: {upNext[0].song.title}
                    </Text>
                  )}
                  {!upNext[0] && radioMode && (
                    <Text className="text-neutral-500 text-xs text-center mt-1">
                      Similar songs will follow
                    </Text>
                  )}
                </View>

                {/* Current Lyric Snippet */}
                {currentLyric && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowLyrics(true)}
                    className="px-8 mb-8"
                  >
                    {splitLyricLines(currentLyric.text).map((line, i) => (
                      <Text
                        key={i}
                        className="text-white text-center leading-loose"
                        allowFontScaling={false}
                        style={{ fontSize: 14, fontWeight: "400" }}
                      >
                        {line}
                      </Text>
                    ))}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View className="flex-1">
                <LyricsList
                  lyrics={lyrics}
                  activeIndex={activeIndex}
                  fontSize={lyricsFontSize}
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
                onValueChange={handleSeekStart}
                onSlidingComplete={handleSeekComplete}
                disabled={!duration || duration === 0}
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
                onPress={handlePlayPause}
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
      <UpNextSheet visible={showUpNext} onClose={() => setShowUpNext(false)} />
    </StyledAnimatedView>
  );
}
