import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useToast } from "heroui-native";
import { Song } from "@/lib/types";

export const useLikeSong = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: likedSongsResponse, isLoading } = useQuery({
    queryKey: ["liked-songs"],
    queryFn: () => apiClient.get("/liked-songs"),
  });

  const likedSongs: Song[] = likedSongsResponse?.data || [];

  const likeSongMutation = useMutation({
    mutationFn: (songId: string) => {
      return apiClient.post("/liked-songs", {
        songId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liked-songs"] });
      toast.show({
        variant: "success",
        label: "Added to Liked Songs",
        icon: <Ionicons name="heart" size={24} color="white" />,
      });
    },
    onError: (error: any) => {
      console.log("Error liking song", error);
      toast.show({
        label: error.message || "Error liking song",
        variant: "danger",
        icon: <Ionicons name="close-circle" size={24} color="white" />,
      });
    },
  });

  const unlikeSongMutation = useMutation({
    mutationFn: (songId: string) => {
      return apiClient.fetch(`/liked-songs?songId=${songId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liked-songs"] });
      toast.show({
        variant: "success",
        label: "Removed from Liked Songs",
        icon: <Ionicons name="heart-outline" size={24} color="white" />,
      });
    },
    onError: (error: any) => {
      console.log("Error unliking song", error);
      toast.show({
        label: error.message || "Error unliking song",
        variant: "danger",
        icon: <Ionicons name="close-circle" size={24} color="white" />,
      });
    },
  });

  const isLikedSong = (songId: string) => {
    return likedSongs.some((song) => song.id === songId);
  };

  const toggleLike = async (songId: string) => {
    if (isLikedSong(songId)) {
      return unlikeSongMutation.mutateAsync(songId);
    } else {
      return likeSongMutation.mutateAsync(songId);
    }
  };

  return {
    likedSongs,
    isLikedSong,
    toggleLike,
    isLoading,
    isLiking: likeSongMutation.isPending,
    isUnliking: unlikeSongMutation.isPending,
  };
};
