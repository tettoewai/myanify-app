import { StyledImage as Image } from "@/components/styled";
import { useSyncedLyrics } from "@/hooks/useSyncedLyrics";
import { useLyricsAutoScroll } from "@/hooks/useLyricsAutoScroll";
import type { LyricLine } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useState, useRef, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);
const { height } = Dimensions.get("window");

// Pre-computed item heights for each size
const ITEM_HEIGHTS: Record<string, number> = {
  small: 44,
  medium: 52,
  large: 60,
};

const LIST_HEADER_HEIGHT = height * 0.22;
const LIST_FOOTER_HEIGHT = height * 0.32;

type LyricSize = "small" | "medium" | "large";

interface EnhancedLyricsProps {
  lyrics: LyricLine[];
  currentTime: number;
  isPlaying: boolean;
  currentSong: any;
  coverUrl: string;
  artistName: string;
  isLoadingLyrics?: boolean;
  onClose: () => void;
  onSeek?: (time: number) => void;
}

// Memoized LyricItem - only re-renders when its specific props change
const LyricItem = memo(
  ({
    lyric,
    isActive,
    isPast,
    size = "medium",
  }: {
    lyric: LyricLine;
    isActive: boolean;
    isPast: boolean;
    size?: LyricSize;
  }) => {
    const fontSize = size === "small" ? 16 : size === "large" ? 22 : 19;
    const lineHeight = Math.round(fontSize * 1.6);

    // Pre-split lines once
    const lines = useMemo(() => lyric.text.split(/\r?\n/).filter(Boolean), [lyric.text]);

    return (
      <View
        style={{
          height: ITEM_HEIGHTS[size],
          justifyContent: "center",
          paddingHorizontal: 16,
          transform: [{ scale: isActive ? 1.05 : 0.98 }],
          opacity: isPast ? 0.3 : isActive ? 1 : 0.5,
        }}
      >
        {lines.map((line, index) => (
          <Text
            key={`${index}-${line.slice(0, 12)}`}
            allowFontScaling={false}
            numberOfLines={2}
            style={{
              color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.7)",
              fontSize,
              lineHeight,
              fontWeight: isActive ? "600" : "400",
              textAlign: "center",
              marginTop: index > 0 ? 4 : 0,
              includeFontPadding: false,
              textShadowColor: isActive
                ? "rgba(251,191,36,0.3)"
                : "transparent",
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: isActive ? 30 : 0,
            }}
          >
            {line}
          </Text>
        ))}
      </View>
    );
  },
  (prev, next) =>
    prev.isActive === next.isActive &&
    prev.isPast === next.isPast &&
    prev.size === next.size &&
    prev.lyric.text === next.lyric.text,
);

LyricItem.displayName = "LyricItem";

export function EnhancedLyrics({
  lyrics,
  currentTime,
  isPlaying,
  currentSong,
  coverUrl,
  artistName,
  isLoadingLyrics = false,
  onClose,
  onSeek,
}: EnhancedLyricsProps) {
  const [size, setSize] = useState<LyricSize>("medium");
  const flatListRef = useRef<FlatList>(null);

  const { currentLyricIndex, seekToken } = useSyncedLyrics(
    lyrics,
    currentTime,
    undefined,
    currentSong?.id,
  );

  const {
    flatListRef: autoScrollRef,
    isUserScrolling,
    onScrollBeginDrag,
    onScrollEndDrag,
    onFlatListLayout,
  } = useLyricsAutoScroll({
    currentLyricIndex,
    seekToken,
    lyrics,
    itemHeight: ITEM_HEIGHTS[size],
    listHeaderHeight: LIST_HEADER_HEIGHT,
    listFooterHeight: LIST_FOOTER_HEIGHT,
    resetKey: currentSong?.id,
  });

  // Combine refs
  const setRefs = useCallback(
    (ref: FlatList | null) => {
      flatListRef.current = ref;
      // @ts-ignore
      autoScrollRef.current = ref;
    },
    [autoScrollRef],
  );

  const toggleFontSize = useCallback(() => {
    const sizes: LyricSize[] = ["small", "medium", "large"];
    setSize((prev) => {
      const currentIndex = sizes.indexOf(prev);
      return sizes[(currentIndex + 1) % sizes.length];
    });
  }, []);

  const getIconSize = useCallback(() => {
    return size === "small" ? 16 : size === "large" ? 28 : 22;
  }, [size]);

  // Use a key to force FlatList re-render only when active index changes significantly
  // This prevents full re-render on every 50ms tick
  const renderItem = useCallback(
    ({ item, index }: { item: LyricLine; index: number }) => (
      <LyricItem
        lyric={item}
        isActive={index === currentLyricIndex}
        isPast={index < currentLyricIndex}
        size={size}
      />
    ),
    [currentLyricIndex, size],
  );

  const keyExtractor = useCallback(
    (_: LyricLine, index: number) => index.toString(),
    [],
  );

  // getItemLayout for O(1) scroll calculations - avoids measuring items
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHTS[size],
      offset: LIST_HEADER_HEIGHT + ITEM_HEIGHTS[size] * index,
      index,
    }),
    [size],
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Header with song info */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onClose}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 16,
          zIndex: 20,
        }}
      >
        <Image
          uri={coverUrl}
          variant="album"
          style={{ width: 56, height: 56, borderRadius: 8 }}
          contentFit="cover"
        />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: "600",
              includeFontPadding: false,
            }}
            numberOfLines={2}
            allowFontScaling={false}
          >
            {currentSong?.title || "Unknown Song"}
          </Text>
          <Text
            style={{
              color: "#ff0000",
              fontSize: 14,
              includeFontPadding: false,
            }}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {artistName}
          </Text>
        </View>

        <TouchableOpacity
          onPress={toggleFontSize}
          style={{
            width: 40,
            height: 40,
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <StyledIonicons name="text" size={getIconSize()} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Lyrics list */}
      {isLoadingLyrics ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#ff0000" />
          <Text style={{ color: "#a3a3a3", marginTop: 12 }}>Loading lyrics...</Text>
        </View>
      ) : lyrics.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ color: "#a3a3a3", textAlign: "center" }}>
            No synchronized lyrics available for this song
          </Text>
        </View>
      ) : (
        <FlatList
          ref={setRefs}
          data={lyrics}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          onLayout={onFlatListLayout}
          // Spacers keep first/last item from hugging edges
          ListHeaderComponent={<View style={{ height: LIST_HEADER_HEIGHT }} />}
          ListFooterComponent={<View style={{ height: LIST_FOOTER_HEIGHT }} />}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={15}
          updateCellsBatchingPeriod={50}
          windowSize={11}
          initialNumToRender={15}
        />
      )}
    </View>
  );
}
