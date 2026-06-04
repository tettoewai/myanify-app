import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatSongFromApi } from "@/lib/song-format";
import type { Song } from "@/lib/types";

export function useSimilarSongs(
  seedSongId: string | null,
  excludeIds: string[] = [],
  enabled = true,
) {
  return useQuery({
    queryKey: ["similar-songs", seedSongId, excludeIds.join(",")],
    enabled: enabled && !!seedSongId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (seedSongId) params.set("seedSongId", seedSongId);
      if (excludeIds.length > 0) params.set("excludeIds", excludeIds.join(","));
      params.set("limit", "10");
      const data = await apiClient.get(`/songs/similar?${params.toString()}`);
      const raw = data?.data || data || [];
      return (Array.isArray(raw) ? raw : []).map((s: unknown) =>
        formatSongFromApi(s as Parameters<typeof formatSongFromApi>[0]),
      ) as Song[];
    },
    staleTime: 60_000,
  });
}
