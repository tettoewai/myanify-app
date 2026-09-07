import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StyledImage as Image } from "@/components/styled";
import { useLyricsAutoScroll } from "@/hooks/useLyricsAutoScroll";
import { useSyncedLyrics } from "@/hooks/useSyncedLyrics";
import { AppColors } from "@/lib/colors";
import { getLyricsRowMaskOpacity } from "@/lib/lyrics-scroll-mask";
import type { LyricLine } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  isLiked?: boolean;
  onToggleLike?: () => void;
}

// Memoized LyricItem - only re-renders when its specific props change
const LyricItem = memo(
  ({
    lyric,
    isActive,
    isPast,
    maskOpacity = 1,
    size = "medium",
  }: {
    lyric: LyricLine;
    isActive: boolean;
    isPast: boolean;
    maskOpacity?: number;
    size?: LyricSize;
  }) => {
    const fontSize = size === "small" ? 16 : size === "large" ? 22 : 19;
    const lineHeight = Math.round(fontSize * 2);
    const baseOpacity = isPast ? 0.3 : isActive ? 1 : 0.5;

    // Pre-split lines once
    const lines = useMemo(
      () => lyric.text.split(/\r?\n/).filter(Boolean),
      [lyric.text],
    );

    return (
      <View
        style={{
          height: ITEM_HEIGHTS[size],
          justifyContent: "center",
          paddingHorizontal: 16,
          transform: [{ scale: isActive ? 1.05 : 0.98 }],
          opacity: baseOpacity * maskOpacity,
        }}
      >
        {lines.map((line, index) => (
          <Text
            key={`${index}-${line.slice(0, 12)}`}
            allowFontScaling={false}
            numberOfLines={2}
            style={{
              color: isActive ? AppColors.foreground : "rgba(250,250,250,0.7)",
              fontSize,
              lineHeight,
              fontWeight: isActive ? "600" : "400",
              textAlign: "center",
              marginTop: index > 0 ? 4 : 0,
              includeFontPadding: false,
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
    prev.maskOpacity === next.maskOpacity &&
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
  isLiked = false,
  onToggleLike,
}: EnhancedLyricsProps) {
  const [size, setSize] = useState<LyricSize>("medium");
  const [scrollOffset, setScrollOffset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const itemHeight = ITEM_HEIGHTS[size];

  useEffect(() => {
    setScrollOffset(0);
  }, [currentSong?.id]);

  const { currentLyricIndex, seekToken } = useSyncedLyrics(
    lyrics,
    currentTime,
    undefined,
    currentSong?.id,
  );

  const {
    flatListRef: autoScrollRef,
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

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrollOffset(event.nativeEvent.contentOffset.y);
    },
    [],
  );

  const onListLayout = useCallback(
    (event: Parameters<typeof onFlatListLayout>[0]) => {
      setViewportHeight(event.nativeEvent.layout.height);
      onFlatListLayout(event);
    },
    [onFlatListLayout],
  );

  const getRowMaskOpacity = useCallback(
    (index: number) => {
      if (viewportHeight <= 0) return 1;
      const top = LIST_HEADER_HEIGHT + index * itemHeight - scrollOffset;
      const bottom = top + itemHeight;
      return getLyricsRowMaskOpacity(top, bottom, viewportHeight);
    },
    [viewportHeight, scrollOffset, itemHeight],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: LyricLine; index: number }) => (
      <LyricItem
        lyric={item}
        isActive={index === currentLyricIndex}
        isPast={index < currentLyricIndex}
        maskOpacity={getRowMaskOpacity(index)}
        size={size}
      />
    ),
    [currentLyricIndex, size, getRowMaskOpacity],
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
              color: AppColors.foreground,
              fontSize: 16,
              fontWeight: "600",
              includeFontPadding: false,
            }}
            numberOfLines={2}
            allowFontScaling={false}
            className="leading-relaxed"
          >
            {currentSong?.title || "Unknown Song"}
          </Text>
          <Text
            style={{
              color: AppColors.primary,
              fontSize: 14,
              includeFontPadding: false,
            }}
            numberOfLines={1}
            allowFontScaling={false}
            className="leading-relaxed"
          >
            {artistName}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onToggleLike}
          disabled={!onToggleLike}
          accessibilityLabel="Like song"
          style={{
            width: 40,
            height: 40,
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
          }}
        >
          <StyledIonicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color={isLiked ? "#ff0000" : AppColors.iconOnDark}
          />
        </TouchableOpacity>
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
          <StyledIonicons name="text" size={getIconSize()} color={AppColors.iconOnDark} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Lyrics list */}
      {isLoadingLyrics ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <LoadingSpinner size="lg" />
          <Text style={{ color: AppColors.mutedForeground, marginTop: 12 }}>
            Loading lyrics...
          </Text>
        </View>
      ) : lyrics.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Text style={{ color: AppColors.mutedForeground, textAlign: "center" }}>
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
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          onLayout={onListLayout}
          style={{ flex: 1 }}
          extraData={{ scrollOffset, viewportHeight, currentLyricIndex, size }}
          // Spacers keep first/last item from hugging edges
          ListHeaderComponent={
            <View style={{ height: LIST_HEADER_HEIGHT }} />
          }
          ListFooterComponent={
            <View style={{ height: LIST_FOOTER_HEIGHT }} />
          }
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
