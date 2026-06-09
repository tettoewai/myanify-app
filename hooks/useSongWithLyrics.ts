import { fetchSongLyrics } from "@/lib/song-lyrics";
import type { LyricLine, Song } from "@/lib/types";
import { useEffect, useState } from "react";

export function useSongWithLyrics(song: Song | null, enabled = true) {
  const [resolvedLyrics, setResolvedLyrics] = useState<
    LyricLine[] | undefined
  >(song?.lyrics);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  useEffect(() => {
    setResolvedLyrics(song?.lyrics);
  }, [song?.id, song?.lyrics]);

  useEffect(() => {
    if (!enabled || !song || song.lyrics !== undefined) {
      setIsLoadingLyrics(false);
      return;
    }

    let cancelled = false;
    setIsLoadingLyrics(true);

    fetchSongLyrics(song.id)
      .then((lyrics) => {
        if (!cancelled) setResolvedLyrics(lyrics);
      })
      .catch(() => {
        if (!cancelled) setResolvedLyrics([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLyrics(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, song?.id, song?.lyrics]);

  if (!song) {
    return { song: null, isLoadingLyrics: false };
  }

  return {
    song: { ...song, lyrics: resolvedLyrics ?? song.lyrics },
    isLoadingLyrics,
  };
}
