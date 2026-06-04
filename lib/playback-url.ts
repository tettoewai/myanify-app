import { getAppUrl } from "./env";

/** Proxied stream URL with byte-range support (same as web player). */
export function getPlaybackUrl(
  audioUrl: string | null | undefined,
): string {
  if (!audioUrl) {
    return "";
  }

  const streamPath = `/api/audio/stream?url=${encodeURIComponent(audioUrl)}`;
  const origin = getAppUrl();

  return origin ? `${origin}${streamPath}` : streamPath;
}

export function getSongStreamUrl(song: {
  audioUrl?: string | null;
  playbackUrl?: string | null;
}): string {
  return song.playbackUrl || getPlaybackUrl(song.audioUrl);
}
