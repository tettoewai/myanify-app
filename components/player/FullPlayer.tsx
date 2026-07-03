import { StyledImage as Image } from "@/components/styled";
import { usePlayer } from "@/context/PlayerContext";
import { UpNextSheet } from "@/components/player/UpNextSheet";
import { EnhancedLyrics } from "@/components/player/EnhancedLyrics";
import { useLikeSong } from "@/hooks/useLikeSong";
import { getSongCoverUrl } from "@/lib/song-cover";
import { findLyricIndexByTime } from "@/hooks/useSyncedLyrics";
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
  ImageBackground,
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

function splitLyricLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function FullPlayer() {
  const router = useRouter();
  const {
    currentSong,
    currentSongLyrics,
    isLoadingLyrics,
    requestCurrentSongLyrics,
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
  const [isSliding, setIsSliding] = useState(false);
  const [slidingValue, setSlidingValue] = useState(0);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);

  const panY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const rotationAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const currentTime = localCurrentTime;

  // Store values in refs to avoid re-creating interval on every render
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const contextTimeRef = useRef(contextCurrentTime);
  contextTimeRef.current = contextCurrentTime;
  const baseTimeRef = useRef(contextCurrentTime);
  const lastContextTimeRef = useRef(contextCurrentTime);

  // Detect seeks: only restart interval when context time jumps significantly
  // This uses a state counter so it triggers a single re-render + interval restart
  const [seekTick, setSeekTick] = useState(0);
  useEffect(() => {
    const jump = Math.abs(contextCurrentTime - lastContextTimeRef.current);
    if (jump > 2 || lastContextTimeRef.current === 0) {
      baseTimeRef.current = contextCurrentTime;
      setSeekTick((t) => t + 1);
      // When paused, sync directly since the interval isn't running
      if (!isPlaying) {
        setLocalCurrentTime(contextCurrentTime);
      }
    }
    lastContextTimeRef.current = contextCurrentTime;
  }, [contextCurrentTime, isPlaying]);

  // High-frequency time updates for smooth lyrics synchronization
  useEffect(() => {
    if (!isPlaying || duration <= 0) return;

    const baseTime = contextTimeRef.current;
    baseTimeRef.current = baseTime;
    const startTime = Date.now();

    const intervalId = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const interpolated = baseTime + elapsed;
      setLocalCurrentTime(Math.min(interpolated, durationRef.current));
    }, 100);

    return () => clearInterval(intervalId);
  }, [isPlaying, duration, seekTick]);

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

  useEffect(() => {
    console.log('🎵 FullPlayer: Song changed, currentSongLyrics:', currentSongLyrics?.length);

    if (currentSong) {
      // If lyrics are already loaded, use them
      if (currentSongLyrics !== undefined && currentSongLyrics.length > 0) {
        console.log('✅ FullPlayer: Lyrics already loaded, no need to request');
        return;
      }

      // If we have cached lyrics but they're empty, request anyway
      console.log('🔄 FullPlayer: Requesting lyrics for:', currentSong.id);
      requestCurrentSongLyrics();
    }
  }, [currentSong?.id, currentSongLyrics, requestCurrentSongLyrics]);

  const lyrics = useMemo(() => {
    if (currentSongLyrics && currentSongLyrics.length > 0) {
      return currentSongLyrics;
    }
    return [];
  }, [currentSongLyrics]);

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

  const coverUrl = useMemo(
    () => getSongCoverUrl(currentSong) ?? "",
    [currentSong],
  );

  const currentLyric = useMemo(() => {
    if (!lyrics.length) return null;
    // Use binary search from useSyncedLyrics for O(log n) lookup
    const targetTime = Math.max(0, currentTime + 0.12);
    const index = findLyricIndexByTime(lyrics, targetTime);
    return index !== -1 ? lyrics[index] : null;
  }, [lyrics, currentTime]);

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
    if (currentSong) {
      toggleLike(currentSong);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [currentSong, toggleLike]);

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

  // Render the main player content
  const renderPlayerContent = () => (
    <>
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
                uri={coverUrl}
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
                className="text-neutral-500 text-xs text-center mt-1 leading-loose"
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
          <EnhancedLyrics
            lyrics={lyrics}
            currentTime={currentTime}
            isPlaying={isPlaying}
            currentSong={currentSong}
            coverUrl={coverUrl}
            artistName={getArtistName()}
            isLoadingLyrics={isLoadingLyrics}
            onClose={() => setShowLyrics(false)}
            onSeek={seekTo}
          />
        </View>
      )}
    </>
  );

  // Render backdrop for lyrics mode
  const renderBackdrop = () => {
    if (!showLyrics || !coverUrl) return null;

    return (
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <ImageBackground
          source={{ uri: coverUrl }}
          className="absolute inset-0 opacity-30"
          blurRadius={30}
          resizeMode="cover"
        />
        <View className="absolute inset-0 bg-black/60" />
      </View>
    );
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
        {/* Backdrop for lyrics */}
        {renderBackdrop()}

        <View className="flex-1 relative">
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 pb-5"
            {...(!showLyrics ? panResponder.panHandlers : {})}
          >
            <TouchableOpacity onPress={handleClose} className="p-2">
              <StyledIonicons name="chevron-down" size={28} color="#fff" />
            </TouchableOpacity>

            <Text className="text-white text-base font-semibold">
              {showLyrics ? "Lyrics" : "Now Playing"}
            </Text>

            <View className="flex-row items-center">
              {!showLyrics && (
                <TouchableOpacity
                  onPress={() => setShowUpNext(true)}
                  className="p-2 relative"
                >
                  <StyledIonicons name="list" size={26} color="#fff" />
                  {radioMode && (
                    <View className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
                  )}
                </TouchableOpacity>
              )}
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
              {showLyrics && (
                <TouchableOpacity
                  onPress={() => setShowLyrics(false)}
                  className="p-2"
                >
                  <StyledIonicons name="musical-notes" size={24} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>

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
            {renderPlayerContent()}

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