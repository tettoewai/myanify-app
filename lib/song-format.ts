import { getPlaybackUrl } from "@/lib/playback-url";
import type { Song } from "@/lib/types";

/** Normalize API song payloads for the mobile player. */
export function formatSongFromApi(song: any): Song {
  const audioUrl = song.audioUrl || "";

  return {
    id: song.id,
    title: song.title,
    coverUrl: song.coverUrl || song.album?.coverUrl || "",
    albumCoverUrl: song.album?.coverUrl || song.coverUrl || null,
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
    lyrics:
      song.lyrics?.map((l: any) => ({ time: l.time, text: l.text })) || [],
    isPremium: song.isPremium || false,
  };
}
