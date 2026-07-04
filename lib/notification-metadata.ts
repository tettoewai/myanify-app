import { getAppUrl } from "@/lib/env";
import { getSongCoverUrl } from "@/lib/song-cover";
import type { Song } from "@/lib/types";
import type { AudioMetadata } from "expo-audio";
import { Image } from "react-native";

const DEFAULT_ARTWORK_URL = Image.resolveAssetSource(
  require("@/assets/images/icon.png"),
).uri;

function toAbsoluteUrl(url: string): string {
  if (/^(https?|file):\/\//i.test(url)) return url;
  const origin = getAppUrl();
  return url.startsWith("/") ? `${origin}${url}` : `${origin}/${url}`;
}

function proxyImageUrlIfNeeded(url: string): string {
  const absolute = toAbsoluteUrl(url);
  if (absolute.includes("mega.nz") || absolute.includes("mega.co.nz")) {
    return `${getAppUrl()}/api/images/proxy?url=${encodeURIComponent(absolute)}`;
  }
  return absolute;
}

function optimizeArtworkForNotification(url: string): string {
  if (!url.includes("cloudinary.com")) return url;
  if (!url.includes("/upload/") || url.includes("/upload/w_")) return url;
  return url.replace("/upload/", "/upload/w_512,h_512,c_fill/");
}

export function getArtistDisplayName(song: Song): string {
  if (song.artist?.trim()) return song.artist;
  if (song.artists.length > 0) {
    return song.artists.map((entry) => entry.artist.name).join(", ");
  }
  return "Unknown Artist";
}

export function getAlbumDisplayName(song: Song): string {
  return song.album?.name?.trim() || "Myanify";
}

/** Build lock-screen / notification metadata aligned with web `useMediaSession`. */
export function buildNotificationMetadata(song: Song): AudioMetadata {
  const cover = getSongCoverUrl(song);
  const artworkUrl = cover?.trim()
    ? optimizeArtworkForNotification(proxyImageUrlIfNeeded(cover))
    : DEFAULT_ARTWORK_URL;

  return {
    title: song.title,
    artist: getArtistDisplayName(song),
    albumTitle: getAlbumDisplayName(song),
    artworkUrl,
  };
}
