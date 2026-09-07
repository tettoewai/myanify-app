import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export interface MobileAnnouncement {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  audience: "ALL" | "FREE" | "PREMIUM";
  startsAt: string;
  read?: boolean;
}

export function useAnnouncements(limit = 30) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<{ data: MobileAnnouncement[]; unreadCount: number }>({
    queryKey: ["announcements", limit],
    queryFn: () => apiClient.get(`/announcements?limit=${limit}`),
    staleTime: 2 * 60 * 1000,
  });

  const announcements = query.data?.data ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;

  // Mark visible unread items as read after a short delay (mirrors web).
  useEffect(() => {
    if (!token || announcements.length === 0) return;
    const unread = announcements.filter((a) => !a.read).map((a) => a.id);
    if (unread.length === 0) return;
    const t = setTimeout(() => {
      apiClient
        .post("/announcements/read", { ids: unread })
        .then(() =>
          queryClient.setQueryData<{ data: MobileAnnouncement[]; unreadCount: number }>(
            ["announcements", limit],
            (old) =>
              old
                ? {
                    data: old.data.map((a) => ({ ...a, read: true })),
                    unreadCount: 0,
                  }
                : old,
          ),
        )
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [token, announcements.map((a) => a.id + (a.read ? "1" : "0")).join(","), limit]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    announcements,
    unreadCount,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
