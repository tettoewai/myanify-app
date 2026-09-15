import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StyledImage as Image } from "@/components/styled";
import { usePlayer } from "@/context/PlayerContext";
import { UpNextSheet } from "@/components/player/UpNextSheet";
import { MoreOptionsSheet } from "@/components/player/MoreOptionsSheet";
import { EnhancedLyrics } from "@/components/player/EnhancedLyrics";
import { useLikeSong } from "@/hooks/useLikeSong";
import { getSongCoverUrl } from "@/lib/song-cover";
import {
  findLyricIndexByTime,
  SYNC_LEAD_SECONDS,
} from "@/hooks/useSyncedLyrics";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);
const StyledSlider = withUniwind(Slider);

const { width } = Dimensions.get("window");
const ART_SIZE = width * 0.75;

type PlayMode = "sequential" | "repeat-all" | "repeat-one" | "shuffle";

function splitLyricLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function FullPlayer() {
  const insets = useSafeAreaInsets();
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
    sleepTimerRemaining,
  } = usePlayer();

  const { isLikedSong, toggleLike } = useLikeSong();

  const [showUpNext, setShowUpNext] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  const [slidingValue, setSlidingValue] = useState(0);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);

  const currentTime = localCurrentTime;

  // Store values in refs to avoid re-creating interval on every render
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const contextTimeRef = useRef(contextCurrentTime);
  contextTimeRef.current = contextCurrentTime;
  const baseTimeRef = useRef(contextCurrentTime);
  const lastContextTimeRef = useRef(contextCurrentTime);

  // Detect seeks: only restart interval when context time jumps significantly.
  // Also snap local time to the engine when drift exceeds 0.5s (low-power
  // mode / throttled timers) so the playhead never desyncs for a whole song.
  const [seekTick, setSeekTick] = useState(0);
  useEffect(() => {
    const jump = Math.abs(contextCurrentTime - lastContextTimeRef.current);
    if (jump > 2 || lastContextTimeRef.current === 0) {
      baseTimeRef.current = contextCurrentTime;
      setSeekTick((t) => t + 1);
      if (!isPlaying || isSliding === false) {
        setLocalCurrentTime(contextCurrentTime);
      }
    } else if (!isPlaying) {
      setLocalCurrentTime(contextCurrentTime);
    } else if (!isSliding) {
      setLocalCurrentTime((prev) => {
        if (Math.abs(prev - contextCurrentTime) > 0.5) {
          return contextCurrentTime;
        }
        return prev;
      });
    }
    lastContextTimeRef.current = contextCurrentTime;
  }, [contextCurrentTime, isPlaying, isSliding]);

  // Interpolate between native status updates so lyric changes stay aligned
  // even when Android throttles JS updates while the player is visible.
  useEffect(() => {
    if (!isPlaying || duration <= 0) return;

    const baseTime = contextTimeRef.current;
    baseTimeRef.current = baseTime;
    const startTime = globalThis.performance?.now?.() ?? Date.now();

    const intervalId = setInterval(() => {
      const now = globalThis.performance?.now?.() ?? Date.now();
      const elapsed = (now - startTime) / 1000;
      const interpolated = baseTime + elapsed;
      // Guard against drift: if the engine moved on (seek from elsewhere),
      // prefer engine time over extrapolation.
      const engineTime = contextTimeRef.current;
      const candidate =
        Math.abs(interpolated - engineTime) > 1.0 ? engineTime : interpolated;
      setLocalCurrentTime(Math.min(candidate, durationRef.current));
    }, 50);

    return () => clearInterval(intervalId);
  }, [currentSong?.id, isPlaying, duration, seekTick]);

  useEffect(() => {
    if (!currentSong) return;

    if (currentSongLyrics !== undefined && currentSongLyrics.length > 0) {
      return;
    }

    requestCurrentSongLyrics();
  }, [currentSong, currentSongLyrics, requestCurrentSongLyrics]);

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
    const targetTime = Math.max(0, currentTime + SYNC_LEAD_SECONDS);
    const index = findLyricIndexByTime(lyrics, targetTime);
    return index !== -1 ? lyrics[index] : null;
  }, [lyrics, currentTime]);

  const playMode: PlayMode = useMemo(() => {
    if (isShuffled) return "shuffle";
    if (repeatMode === "all") return "repeat-all";
    if (repeatMode === "one") return "repeat-one";
    return "sequential";
  }, [isShuffled, repeatMode]);

  const playModeConfig = useMemo(() => {
    switch (playMode) {
      case "repeat-all":
        return { name: "repeat" as const, color: "#ff0000", showBadge: false };
      case "repeat-one":
        return { name: "repeat" as const, color: "#ff0000", showBadge: true };
      case "shuffle":
        return { name: "shuffle" as const, color: "#ff0000", showBadge: false };
      case "sequential":
      default:
        return {
          name: "repeat-outline" as const,
          color: "#a3a3a3",
          showBadge: false,
        };
    }
  }, [playMode]);

  const cyclePlayMode = useCallback(() => {
    const order: PlayMode[] = [
      "sequential",
      "repeat-all",
      "repeat-one",
      "shuffle",
    ];
    const nextMode = order[(order.indexOf(playMode) + 1) % order.length];
    switch (nextMode) {
      case "sequential":
        setIsShuffled(false);
        setRepeatMode("off");
        break;
      case "repeat-all":
        setIsShuffled(false);
        setRepeatMode("all");
        break;
      case "repeat-one":
        setIsShuffled(false);
        setRepeatMode("one");
        break;
      case "shuffle":
        setIsShuffled(true);
        setRepeatMode("all");
        break;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [playMode, setIsShuffled, setRepeatMode]);

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

  const handleLikeToggle = useCallback(() => {
    if (currentSong) {
      toggleLike(currentSong);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [currentSong, toggleLike]);

  const handleClose = useCallback(() => {
    router.back();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [router]);

  if (!currentSong) {
    return (
      <View
        className="flex-1 bg-black items-center justify-center px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <Text className="text-white text-lg text-center">
          Nothing is playing right now
        </Text>
        <TouchableOpacity
          onPress={handleClose}
          className="mt-6 px-6 py-3 bg-white/10 rounded-lg"
        >
          <Text className="text-white font-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  // Render the main player content
  const renderPlayerContent = () => (
    <>
      {!showLyrics ? (
        <>
          {/* Album Art */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowLyrics(true)}
            className="items-center justify-center px-10 mb-6"
          >
            <View style={styles.artContainer}>
              <Image
                uri={coverUrl}
                variant="album"
                className="w-full h-full"
                contentFit="cover"
              />
            </View>
          </TouchableOpacity>

          {/* Song Info */}
          <View className="px-8 mb-4 flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text
                className="text-white text-xl font-bold leading-relaxed"
                numberOfLines={2}
              >
                {currentSong.title || "Unknown Song"}
              </Text>
              <Text
                className="text-primary text-base leading-relaxed"
                numberOfLines={1}
              >
                {getArtistName()}
              </Text>
              {upNext[0] && (
                <Text
                  className="text-neutral-500 text-xs mt-0.5 leading-normal"
                  numberOfLines={1}
                >
                  Up next: {upNext[0].song.title}
                </Text>
              )}
              {!upNext[0] && radioMode && (
                <Text className="text-neutral-500 text-xs mt-0.5 leading-normal">
                  Similar songs will follow
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={handleLikeToggle}
              className="p-2"
              accessibilityLabel="Like song"
            >
              <StyledIonicons
                name={
                  currentSong?.id && isLikedSong(currentSong.id)
                    ? "heart"
                    : "heart-outline"
                }
                size={28}
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
              className="px-8 mb-4"
            >
              {/* <View className="absolute -top-5 left-0 right-0 items-center">
                <Text className="text-neutral-500 text-xs">
                  Tap for full lyrics ↑
                </Text>
              </View> */}
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
            isLiked={!!(currentSong?.id && isLikedSong(currentSong.id))}
            onToggleLike={handleLikeToggle}
          />
        </View>
      )}
    </>
  );

  return (
    <View
      className="flex-1 bg-black"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Backdrop for lyrics */}
      {renderBackdrop()}

      <View className="flex-1 relative">
          {/* Header */}
          <View className="flex-row items-center justify-between px-2 pb-4">
            <TouchableOpacity onPress={handleClose} className="p-2">
              <StyledIonicons name="chevron-down" size={28} color="#fff" />
            </TouchableOpacity>

            <Text className="text-white text-base font-semibold">
              {showLyrics ? "Lyrics" : "Now Playing"}
            </Text>

            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => {
                  setShowMoreOptions(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className="p-2 relative"
                accessibilityLabel="More options"
              >
                <StyledIonicons
                  name="ellipsis-vertical"
                  size={24}
                  color="#fff"
                />
                {sleepTimerRemaining > 0 && (
                  <View className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
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
              <LoadingSpinner size="sm" />
            </View>
          )}

          <View className="flex-1 justify-between">
            {renderPlayerContent()}

            {/* Progress Bar */}
            <View className="px-5 mb-4">
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
            <View className="flex-row items-center justify-between px-10 mb-4">
              <TouchableOpacity
                onPress={cyclePlayMode}
                className="p-2 items-center justify-center"
                accessibilityLabel={`Play mode: ${playMode}. Tap to change.`}
              >
                <StyledIonicons
                  name={playModeConfig.name}
                  size={24}
                  color={playModeConfig.color}
                />
                {playModeConfig.showBadge && (
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

              {/* Queue */}
              <TouchableOpacity
                onPress={() => {
                  setShowUpNext(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className="p-2 relative items-center justify-center"
                accessibilityLabel="Open queue"
              >
                <StyledIonicons name="list" size={24} color="#a3a3a3" />
                {radioMode && (
                  <View className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </TouchableOpacity>
            </View>
          </View>
      </View>

      <UpNextSheet visible={showUpNext} onClose={() => setShowUpNext(false)} />
      <MoreOptionsSheet
        visible={showMoreOptions}
        onClose={() => setShowMoreOptions(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  artContainer: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: ART_SIZE / 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  } satisfies ViewStyle,
});
