import { getPlaybackUrl } from "@/lib/playback-url";
import type { LyricLine, Song } from "@/lib/types";

/** Parse lyrics from API — undefined when the response omitted them. */
export function formatLyricsFromApi(lyrics: any): LyricLine[] | undefined {
  if (lyrics === undefined) return undefined;
  if (!Array.isArray(lyrics)) return [];

  if (
    lyrics.length > 0 &&
    "time" in lyrics[0] &&
    "text" in lyrics[0]
  ) {
    return [...lyrics]
      .sort((a: any, b: any) => (a.time ?? 0) - (b.time ?? 0))
      .map((line: any) => ({
        time: line.time ?? 0,
        text: line.text ?? "",
      }));
  }

  const linesRow = lyrics[0];
  if (linesRow?.lines && Array.isArray(linesRow.lines)) {
    return [...linesRow.lines]
      .sort((a: any, b: any) => (a.time ?? 0) - (b.time ?? 0))
      .map((line: any) => ({
        time: line.time ?? 0,
        text: line.text ?? "",
      }));
  }

  return [];
}

/** Normalize API song payloads for the mobile player. */
export function formatSongFromApi(song: any): Song {
  const audioUrl = song.audioUrl || "";

  const artistImageUrl =
    song.artists
      ?.map((a: any) => a.artist?.imageUrl)
      .find((url: string | null | undefined) => Boolean(url)) ?? null;

  return {
    id: song.id,
    title: song.title,
    coverUrl: song.coverUrl || song.album?.coverUrl || "",
    albumCoverUrl: song.album?.coverUrl || song.coverUrl || null,
    artistImageUrl,
    artists: song.artists || [],
    artist:
      song.artists?.map((a: any) => a.artist?.name || a.name).join(", ") || "",
    album: song.album
      ? {
          id: song.album.id,
          name: song.album.name,
          coverUrl: song.album.coverUrl || "",
        }
      : undefined,
    duration: song.duration || 0,
    audioUrl,
    playbackUrl: song.playbackUrl || getPlaybackUrl(audioUrl),
    genre: song.genre?.name || song.genre || "",
    language: song.language ?? null,
    mood: song.mood ?? null,
    tags: Array.isArray(song.tags) ? song.tags : [],
    _reason: song._reason ?? null,
    lyrics: formatLyricsFromApi(song.lyrics),
    isPremium: song.isPremium || false,
  };
}
