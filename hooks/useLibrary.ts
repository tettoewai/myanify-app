import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatSongFromApi } from "@/lib/song-format";
import { Artist, Playlist, Song } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { usePlaylistMutations } from "@/hooks/usePlaylistMutations";

export const useLibrary = () => {
  const { token } = useAuth();
  const mutations = usePlaylistMutations();

  const {
    data: likedSongsData,
    isLoading: isLoadingSongs,
    isRefetching: isRefetchingSongs,
    refetch: refetchSongs,
  } = useQuery({
    // Canonical shape { data: [...] } shared with useLikeSong — do not unwrap
    // here or the two hooks thrash each other's cache and double-fetch.
    queryKey: ["liked-songs"],
    queryFn: async () => {
      const response = await apiClient.get("/liked-songs");
      return response;
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: likedArtistsData,
    isLoading: isLoadingArtists,
    isRefetching: isRefetchingArtists,
    refetch: refetchArtists,
  } = useQuery({
    // Shared with useLikeArtist — same key/shape/staleTime.
    queryKey: ["liked-artists"],
    queryFn: async () => {
      const response = await apiClient.get("/liked-artists");
      return response;
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: playlistsData,
    isLoading: isLoadingPlaylists,
    isRefetching: isRefetchingPlaylists,
    refetch: refetchPlaylists,
  } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const response = await apiClient.get("/playlists");
      return response.data as Playlist[];
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
  });

  const rawLikedSongs: any[] = Array.isArray(likedSongsData)
    ? likedSongsData
    : (likedSongsData?.data ?? []);
  const rawLikedArtists: Artist[] = Array.isArray(likedArtistsData)
    ? (likedArtistsData as Artist[])
    : (likedArtistsData?.data ?? []);
  const likedSongs: Song[] = rawLikedSongs.length
    ? rawLikedSongs.map((s) => {
        try {
          return formatSongFromApi(s);
        } catch {
          return s as Song;
        }
      })
    : [];
  const likedArtists: Artist[] = rawLikedArtists || [];
  const playlists: Playlist[] = playlistsData || [];

  return {
    likedSongs,
    likedArtists,
    playlists,
    isLoading: isLoadingSongs || isLoadingArtists || isLoadingPlaylists,
    isRefetching:
      isRefetchingSongs || isRefetchingArtists || isRefetchingPlaylists,
    ...mutations,
    refetch: async () => {
      await Promise.all([
        refetchSongs(),
        refetchArtists(),
        refetchPlaylists(),
      ]);
    },
  };
};
