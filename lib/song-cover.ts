import type { Song } from "@/lib/types";

function isValidCoverUrl(url?: string | null): url is string {
  return Boolean(url?.trim());
}

/** Album cover → song cover → first artist profile image. */
export function getSongCoverUrl(
  song: Pick<
    Song,
    "coverUrl" | "albumCoverUrl" | "album" | "artistImageUrl"
  > | null | undefined,
): string | undefined {
  if (!song) return undefined;

  if (isValidCoverUrl(song.albumCoverUrl)) return song.albumCoverUrl;
  if (isValidCoverUrl(song.album?.coverUrl)) return song.album.coverUrl;
  if (isValidCoverUrl(song.coverUrl)) return song.coverUrl;
  if (isValidCoverUrl(song.artistImageUrl)) return song.artistImageUrl;

  return undefined;
}
