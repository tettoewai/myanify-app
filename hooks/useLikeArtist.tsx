import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api";
import { Artist } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useToast } from "heroui-native";

export const useLikeArtist = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { token } = useAuth();

  const { data: likedArtists, isLoading } = useQuery({
    queryKey: ["liked-artists"],
    queryFn: () => apiClient.get("/liked-artists"),
    enabled: !!token,
  });

  const likeArtist = useMutation({
    mutationFn: (artistId: string) => {
      return apiClient.post("/liked-artists", {
        artistId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liked-artists"] });
      toast.show({
        variant: "success",
        label: "Artist Liked",
        icon: <Ionicons name="heart" size={24} color="white" />,
      });
    },
    onError: (error) => {
      toast.show({
        label: "Error liking artist",
        variant: "danger",
        icon: <Ionicons name="close-circle" size={24} color="white" />,
      });
    },
  });

  const isLikedArtist = (artistId: string) => {
    return likedArtists?.data?.some((artist: Artist) => artist.id === artistId);
  };

  const unlikeArtist = useMutation({
    mutationFn: (artistId: string) => {
      return apiClient.delete("/liked-artists?artistId=" + artistId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liked-artists"] });
      toast.show({
        variant: "success",
        label: "Artist Unliked",
        icon: <Ionicons name="heart" size={24} color="white" />,
      });
    },
    onError: () => {
      toast.show({
        label: "Error unliking artist",
        variant: "danger",
        icon: <Ionicons name="close-circle" size={24} color="white" />,
      });
    },
  });

  return {
    likedArtists,
    likeArtist,
    isLikedArtist,
    unlikeArtist,
    isLoading,
    isLiking: likeArtist.isPending,
    isUnliking: unlikeArtist.isPending,
  };
};
