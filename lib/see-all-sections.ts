export const SEE_ALL_SECTIONS = [
  "trending",
  "recently-played",
  "new-releases",
  "genres",
  "artists",
  "playlists",
  "albums",
] as const;

export type SeeAllSection = (typeof SEE_ALL_SECTIONS)[number];

export function isSeeAllSection(value: string): value is SeeAllSection {
  return (SEE_ALL_SECTIONS as readonly string[]).includes(value);
}

export function seeAllPath(section: SeeAllSection): `/see-all/${SeeAllSection}` {
  return `/see-all/${section}`;
}

export const SEE_ALL_SECTION_META: Record<
  SeeAllSection,
  {
    title: string;
    description: string;
    icon: string;
    iconColor: string;
  }
> = {
  trending: {
    title: "Trending Now",
    description: "Most played songs",
    icon: "trending-up",
    iconColor: "#ff0000",
  },
  "recently-played": {
    title: "Recently Played",
    description: "Pick up where you left off",
    icon: "time",
    iconColor: "#8b5cf6",
  },
  "new-releases": {
    title: "New Releases",
    description: "Fresh music just dropped",
    icon: "flame",
    iconColor: "#f97316",
  },
  genres: {
    title: "Browse Genres",
    description: "Explore music by genre",
    icon: "musical-note",
    iconColor: "#06b6d4",
  },
  artists: {
    title: "Popular Artists",
    description: "Discover Myanmar's top artists",
    icon: "mic",
    iconColor: "#ff0000",
  },
  playlists: {
    title: "Featured Playlists",
    description: "Curated collections to explore",
    icon: "list",
    iconColor: "#10b981",
  },
  albums: {
    title: "Albums & Releases",
    description: "Full albums, EPs, and singles",
    icon: "disc",
    iconColor: "#f59e0b",
  },
};

export function formatAlbumType(type?: string | null): string | null {
  if (!type) return null;
  if (type === "SINGLE") return "Single";
  if (type === "EP") return "EP";
  if (type === "ALBUM") return "Album";
  return type;
}
