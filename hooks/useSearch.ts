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

  return useQuery<SearchResponse>({
    queryKey: ["search", trimmed, options?.perPage],
    queryFn: async () => {
      const params = new URLSearchParams({ q: trimmed! });
      if (options?.perPage) {
        params.set("per_page", String(options.perPage));
      }
      return apiClient.get(`/search?${params.toString()}`);
    },
    enabled: !!trimmed && (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });
}
