import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api";
import { Song } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "heroui-native";
import { useCallback, useMemo } from "react";

const getLikedSongsArray = (response: any): Song[] => response?.data || [];

export const useLikeSong = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { token } = useAuth();

  const { data: likedSongsResponse, isLoading } = useQuery({
    queryKey: ["liked-songs"],
    queryFn: () => apiClient.get("/liked-songs"),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const likedSongs = useMemo(
    () => getLikedSongsArray(likedSongsResponse),
    [likedSongsResponse],
  );

  const isLikedSong = useCallback(
    (songId: string) => likedSongs.some((song) => song.id === songId),
    [likedSongs],
  );

  const likeMutation = useMutation({
    mutationFn: (song: Song) =>
      apiClient.post("/liked-songs", { songId: song.id }),
    onMutate: async (newSong) => {
      await queryClient.cancelQueries({ queryKey: ["liked-songs"] });
      const previousLikedSongs = queryClient.getQueryData(["liked-songs"]);
      queryClient.setQueryData(["liked-songs"], (old: any) => {
        const currentSongs = getLikedSongsArray(old);
        if (currentSongs.some((s) => s.id === newSong.id)) return old;
        return { ...old, data: [newSong, ...currentSongs] };
      });
      return { previousLikedSongs };
    },
    onError: (error, song, context) => {
      queryClient.setQueryData(["liked-songs"], context?.previousLikedSongs);
      toast.show({
        label: error?.message || "Failed to like song. Please try again.",
        variant: "danger",
        icon: <Ionicons name="close-circle" size={24} color="white" />,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["liked-songs"] });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: (song: Song) =>
      apiClient.delete(`/liked-songs?songId=${song.id}`),
    onMutate: async (songToRemove) => {
      await queryClient.cancelQueries({ queryKey: ["liked-songs"] });
      const previousLikedSongs = queryClient.getQueryData(["liked-songs"]);
      queryClient.setQueryData(["liked-songs"], (old: any) => {
        const currentSongs = getLikedSongsArray(old);
        const filtered = currentSongs.filter((s) => s.id !== songToRemove.id);
        return { ...old, data: filtered };
      });
      return { previousLikedSongs };
    },
    onError: (error, song, context) => {
      queryClient.setQueryData(["liked-songs"], context?.previousLikedSongs);
      toast.show({
        label: error?.message || "Failed to unlike song. Please try again.",
        variant: "danger",
        icon: <Ionicons name="close-circle" size={24} color="white" />,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["liked-songs"] });
    },
  });

  const toggleLike = useCallback(
    async (song: Song) => {
      if (isLikedSong(song.id)) {
        return unlikeMutation.mutateAsync(song);
      } else {
        return likeMutation.mutateAsync(song);
      }
    },
    [isLikedSong, likeMutation, unlikeMutation],
  );

  return {
    likedSongs,
    isLikedSong,
    toggleLike,
    isLoading,
  };
};
