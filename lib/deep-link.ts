import type { Href } from "expo-router";

/**
 * Paths that can be opened directly as a screen in the app. These match the
 * expo-router routes that exist under `app/`.
 */
const DIRECT_ROUTES: Record<string, string> = {
  song: "/song/[id]",
  album: "/album/[id]",
  artist: "/artist/[id]",
  playlist: "/playlist/[id]",
  genre: "/genre/[id]",
};

export interface DeepLinkTarget {
  href: Href;
  /** The raw slug / id captured from the URL, if any. */
  slug?: string;
}

/**
 * Convert a deep-link pathname (e.g. "/album/some-slug") into an expo-router
 * navigation target. Returns null when the path isn't a routable entity.
 *
 * Works for both web universal-link URLs (https://myanify.vercel.app/...)
 * and the custom "myanify://" scheme, since only the pathname is inspected.
 */
export function parseDeepLinkPath(pathname: string): DeepLinkTarget | null {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const segments = normalized.split("/").filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const [type, slug] = segments;

  if (DIRECT_ROUTES[type] && slug) {
    return {
      href: {
        pathname: DIRECT_ROUTES[type] as Href,
        params: { id: slug },
      } as any,
      slug,
    };
  }

  return null;
}

/** Extract a pathname from a full deep link URL, stripping the origin / query.
 *  Handles both web universal links (`https://myanify.vercel.app/album/x`) and
 *  the custom scheme (`myanify://album/x`). */
export function extractPathnameFromUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    const withoutScheme = url.replace(/^[^:]+:\/\//, "");
    const qIndex = withoutScheme.search(/[?#]/);
    return qIndex === -1 ? withoutScheme : withoutScheme.slice(0, qIndex);
  }

  const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
  // Custom schemes: the host is actually the first path segment (e.g. "album").
  const base = isHttp ? parsed.pathname : `${parsed.host}${parsed.pathname}`;
  return `${base}${parsed.search}`;
}
