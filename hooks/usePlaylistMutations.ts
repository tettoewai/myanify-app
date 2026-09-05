import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

/**
 * Playlist mutations only — no queries.
 * Use this in detail screens so opening a playlist doesn't fire
 * GET /liked-songs + /liked-artists + /playlists via useLibrary().
 */
export const usePlaylistMutations = () => {
  const queryClient = useQueryClient();

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

  return {
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
  };
};
