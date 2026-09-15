import { getAppUrl } from "@/lib/env";
import { getSongCoverUrl } from "@/lib/song-cover";
import type { Song } from "@/lib/types";
import type { AudioMetadata } from "expo-audio";
import { Image } from "react-native";

const DEFAULT_ARTWORK_URL: string | undefined = (() => {
  // Module-scope resolve can throw outside the native runtime (e.g. web);
  // and the MediaSession service can only decode file/http(s) artwork, so
  // fall back to "no large icon" rather than a URI that breaks per OS version.
  try {
    const uri = Image.resolveAssetSource(
      require("@/assets/images/icon.png"),
    )?.uri;
    return typeof uri === "string" && uri.length > 0 ? uri : undefined;
  } catch {
    return undefined;
  }
})();

function isLocalHost(url: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.0\.2\.2)([:/]|$)/i.test(
    url,
  );
}

function toAbsoluteUrl(url: string): string {
  if (/^(https?|file):\/\//i.test(url)) return url;
  const origin = getAppUrl();
  return url.startsWith("/") ? `${origin}${url}` : `${origin}/${url}`;
}

/**
 * Android 9+ blocks cleartext (http) by default and the notification service
 * has no cleartext exception — http artwork silently fails on newer Android.
 * Upgrade remote http to https (dev localhost/10.0.2.2 stays http).
 */
function ensureHttpsForRemote(url: string): string {
  if (/^http:\/\//i.test(url) && !isLocalHost(url)) {
    return url.replace(/^http:\/\//i, "https://");
  }
  return url;
}

function proxyImageUrlIfNeeded(url: string): string {
  const absolute = ensureHttpsForRemote(toAbsoluteUrl(url));
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
  // Omit artwork when unknown — matches web placeholder behavior closely
  // enough while guaranteeing the notification renders on every Android
  // version (a broken artwork URL can blank the whole notification on
  // some OEM skins).
  const artworkUrl = cover?.trim()
    ? optimizeArtworkForNotification(proxyImageUrlIfNeeded(cover))
    : DEFAULT_ARTWORK_URL;

  return {
    title: song.title?.trim() || "Unknown Title",
    artist: getArtistDisplayName(song),
    albumTitle: getAlbumDisplayName(song),
    ...(artworkUrl ? { artworkUrl } : {}),
  };
}
