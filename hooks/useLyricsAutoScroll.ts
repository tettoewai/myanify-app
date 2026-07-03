import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FlatList, LayoutChangeEvent } from "react-native";
import type { LyricLine } from "@/lib/types";

export const LYRIC_SCROLL_ANCHOR_RATIO = 0.5;
export const LYRIC_SCROLL_DURATION_MS = 650;
export const LYRIC_LINE_TRANSITION = {
  duration: 700,
};
export const LYRIC_TEXT_TRANSITION = {
  duration: 700,
};

interface UseLyricsAutoScrollProps {
  currentLyricIndex: number;
  seekToken: number;
  lyrics: LyricLine[];
  itemHeight: number;
  listHeaderHeight: number;
  listFooterHeight: number;
  resetKey?: string;
}

export function useLyricsAutoScroll({
  currentLyricIndex,
  seekToken,
  lyrics,
  itemHeight,
  listHeaderHeight,
  listFooterHeight,
  resetKey,
}: UseLyricsAutoScrollProps) {
  const flatListRef = useRef<FlatList>(null);
  const viewportHeightRef = useRef(0);
  const isUserScrollingRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrolledIndexRef = useRef(-1);
  const trackKeyRef = useRef(resetKey);

  // Pass through state for EnhancedLyrics to use
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  const onFlatListLayout = useCallback((e: LayoutChangeEvent) => {
    viewportHeightRef.current = e.nativeEvent.layout.height;
  }, []);

  const scrollLineToCenter = useCallback(
    (index: number, animated: boolean) => {
      const flatList = flatListRef.current;
      if (!flatList || viewportHeightRef.current <= 0 || itemHeight <= 0) return;

      const totalContentHeight =
        listHeaderHeight + lyrics.length * itemHeight + listFooterHeight;
      const maxOffset = Math.max(0, totalContentHeight - viewportHeightRef.current);
      const itemCenter = listHeaderHeight + index * itemHeight + itemHeight / 2;
      const targetOffset = itemCenter - viewportHeightRef.current * LYRIC_SCROLL_ANCHOR_RATIO;

      flatList.scrollToOffset({
        offset: Math.max(0, Math.min(targetOffset, maxOffset)),
        animated,
      });
    },
    [lyrics.length, itemHeight, listHeaderHeight, listFooterHeight],
  );

  // Reset scroll when song changes
  useLayoutEffect(() => {
    const trackChanged = resetKey !== undefined && resetKey !== trackKeyRef.current;

    if (trackChanged) {
      trackKeyRef.current = resetKey;
      lastScrolledIndexRef.current = -1;
      isUserScrollingRef.current = false;
      isAutoScrollingRef.current = false;
      setIsUserScrolling(false);
    }

    const flatList = flatListRef.current;
    if (flatList && (trackChanged || lyrics.length)) {
      flatList.scrollToOffset({ offset: 0, animated: false });
    }
  }, [lyrics, resetKey]);

  // Handle seek events - reset user scroll lock
  useLayoutEffect(() => {
    if (seekToken > 0) {
      lastScrolledIndexRef.current = -1;
      isUserScrollingRef.current = false;
    }
  }, [seekToken]);

  // Auto-scroll to active lyric
  useEffect(() => {
    if (!flatListRef.current || lyrics.length === 0) return;
    if (currentLyricIndex < 0) return;
    if (isUserScrollingRef.current) return;
    if (currentLyricIndex === lastScrolledIndexRef.current) return;

    isAutoScrollingRef.current = true;
    scrollLineToCenter(currentLyricIndex, true);
    lastScrolledIndexRef.current = currentLyricIndex;

    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
    }
    autoScrollTimeoutRef.current = setTimeout(() => {
      scrollLineToCenter(currentLyricIndex, false);
      isAutoScrollingRef.current = false;
    }, LYRIC_SCROLL_DURATION_MS);
  }, [currentLyricIndex, seekToken, scrollLineToCenter, lyrics.length]);

  const onScrollBeginDrag = useCallback(() => {
    isUserScrollingRef.current = true;
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  }, []);

  const onScrollEndDrag = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      setIsUserScrolling(false);
      lastScrolledIndexRef.current = -1;
      // Re-center to current lyric when user stops scrolling
      if (currentLyricIndex >= 0) {
        scrollLineToCenter(currentLyricIndex, true);
      }
    }, 1500);
  }, [currentLyricIndex, scrollLineToCenter]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
    };
  }, []);

  return {
    flatListRef,
    isUserScrolling,
    onScrollBeginDrag,
    onScrollEndDrag,
    onFlatListLayout,
  };
}
