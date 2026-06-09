import { apiClient } from "@/lib/api";
import {
  isSeeAllSection,
  type SeeAllSection,
} from "@/lib/see-all-sections";
import { formatSongFromApi } from "@/lib/song-format";
import type { Album, Artist, Genre, Playlist, Song } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

export type SeeAllContentType =
  | "songs"
  | "genres"
  | "artists"
  | "albums"
  | "playlists";

export interface SeeAllSectionData {
  type: SeeAllContentType;
  songs?: Song[];
  genres?: Genre[];
  artists?: Artist[];
  albums?: Album[];
  playlists?: Playlist[];
}

async function fetchSeeAllSection(
  section: SeeAllSection,
): Promise<SeeAllSectionData> {
  switch (section) {
    case "trending": {
      const response = await apiClient.get("/songs/quick-play?limit=50");
      return {
        type: "songs",
        songs: (response.data || []).map(formatSongFromApi),
      };
    }
    case "new-releases": {
      const response = await apiClient.get("/songs?isPublished=true&limit=50");
      return {
        type: "songs",
        songs: (response.data || []).map(formatSongFromApi),
      };
    }
    case "recently-played": {
      const response = await apiClient.get("/play-history?limit=50");
      return {
        type: "songs",
        songs: (response.data || []).map(formatSongFromApi),
      };
    }
    case "genres": {
      const response = await apiClient.get("/genres?limit=100");
      return {
        type: "genres",
        genres: response.data || [],
      };
    }
    case "artists": {
      const response = await apiClient.get("/artists?limit=50");
      return {
        type: "artists",
        artists: response.data || [],
      };
    }
    case "albums": {
      const response = await apiClient.get("/albums?sort=recent&limit=50");
      return {
        type: "albums",
        albums: response.data || [],
      };
    }
    case "playlists": {
      const response = await apiClient.get("/playlists?isPublic=true&limit=50");
      return {
        type: "playlists",
        playlists: response.data || [],
      };
    }
  }
}

export function useSeeAllSection(sectionParam: string | undefined) {
  const section = sectionParam && isSeeAllSection(sectionParam)
    ? sectionParam
    : null;

  const query = useQuery({
    queryKey: ["see-all", section],
    queryFn: () => fetchSeeAllSection(section!),
    enabled: !!section,
    staleTime: 2 * 60 * 1000,
  });

  const itemCount =
    query.data?.songs?.length ??
    query.data?.genres?.length ??
    query.data?.artists?.length ??
    query.data?.albums?.length ??
    query.data?.playlists?.length ??
    0;

  return {
    section,
    ...query,
    itemCount,
  };
}
