import { apiClient } from "@/lib/api";
import { Artist } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

interface SearchResponse {
  songs: any[];
  artists: Artist[];
}

export function useSearch(
  query?: string,
  options?: { perPage?: number; enabled?: boolean },
) {
  const trimmed = query?.trim();
  const limit = options?.perPage ?? 20;

  return useQuery<SearchResponse>({
    queryKey: ["search", trimmed, limit],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        search: trimmed!,
        limit: String(limit),
      });

      const [songsRes, artistsRes] = await Promise.all([
        apiClient.fetch(`/songs?${params}&isPublished=true`, { signal }),
        apiClient.fetch(`/artists?${params}`, { signal }),
      ]);

      return {
        songs: songsRes.data || [],
        artists: artistsRes.data || [],
      };
    },
    enabled: !!trimmed && (options?.enabled ?? true),
    staleTime: 60 * 1000,
    // Keep last results visible while typing so list doesn't flash empty.
    placeholderData: (prev) => prev,
  });
}
