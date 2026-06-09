import { apiClient } from "@/lib/api";
import { formatLyricsFromApi } from "@/lib/song-format";
import type { LyricLine } from "@/lib/types";

/** Fetch synchronized lyrics for a song (Myanmar `my` locale via API). */
export async function fetchSongLyrics(
  songIdOrSlug: string,
): Promise<LyricLine[]> {
  const encoded = encodeURIComponent(songIdOrSlug);
  const data = await apiClient.get(`/songs/${encoded}?include=lyrics`);
  const song = data?.data ?? data;
  return formatLyricsFromApi(song?.lyrics) ?? [];
}
