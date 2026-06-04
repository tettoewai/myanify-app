import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatSongFromApi } from "@/lib/song-format";
import { Artist, Playlist, Song } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

export const useLibrary = () => {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  const {
    data: likedSongsData,
    isLoading: isLoadingSongs,
    isRefetching: isRefetchingSongs,
    refetch: refetchSongs,
  } = useQuery({
    queryKey: ["liked-songs"],
    queryFn: async () => {
      const response = await apiClient.get("/liked-songs");
      return response.data as any[];
    },
    enabled: !!token,
  });

  const {
    data: likedArtistsData,
    isLoading: isLoadingArtists,
    isRefetching: isRefetchingArtists,
    refetch: refetchArtists,
  } = useQuery({
    queryKey: ["liked-artists"],
    queryFn: async () => {
      const response = await apiClient.get("/liked-artists");
      return response.data as Artist[];
    },
    enabled: !!token,
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
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiClient.post("/playlists", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });

  const updatePlaylistMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; description?: string };
    }) => {
      return apiClient.put(`/playlists/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlist", variables.id] });
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/playlists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });

  const removeFromPlaylistMutation = useMutation({
    mutationFn: async ({
      playlistId,
      songId,
    }: {
      playlistId: string;
      songId: string;
    }) => {
      return apiClient.delete(`/playlists/${playlistId}/songs/${songId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.invalidateQueries({
        queryKey: ["playlist", variables.playlistId],
      });
    },
  });

  const likedSongs: Song[] = likedSongsData?.length
    ? likedSongsData.map(formatSongFromApi)
    : [];
  const likedArtists: Artist[] = likedArtistsData || [];
  const playlists: Playlist[] = playlistsData || [];

  return {
    likedSongs,
    likedArtists,
    playlists,
    isLoading: isLoadingSongs || isLoadingArtists || isLoadingPlaylists,
    isRefetching:
      isRefetchingSongs || isRefetchingArtists || isRefetchingPlaylists,
    createPlaylist: createPlaylistMutation.mutateAsync,
    isCreatingPlaylist: createPlaylistMutation.isPending,
    updatePlaylist: (
      id: string,
      data: { name?: string; description?: string }
    ) => updatePlaylistMutation.mutateAsync({ id, data }),
    isUpdatingPlaylist: updatePlaylistMutation.isPending,
    deletePlaylist: deletePlaylistMutation.mutateAsync,
    isDeletingPlaylist: deletePlaylistMutation.isPending,
    removeFromPlaylist: (playlistId: string, songId: string) =>
      removeFromPlaylistMutation.mutateAsync({ playlistId, songId }),
    isRemovingFromPlaylist: removeFromPlaylistMutation.isPending,
    refetch: async () => {
      await Promise.all([
        refetchSongs(),
        refetchArtists(),
        refetchPlaylists(),
      ]);
    },
  };
};
