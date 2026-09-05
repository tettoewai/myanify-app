import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text, TouchableOpacity, View } from "react-native";

/**
 * Genre deep-link entry point. The web app surfaces genres as `/genre/<slug>`,
 * but in the mobile app genres are browsed through the Search tab filtered by a
 * genre id. This screen resolves the incoming slug (or id) to a real genre id,
 * then redirects into Search.
 */
export default function GenreRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, isLoading } = useAuth();

  const { data, isLoading: genreLoading } = useQuery({
    queryKey: ["genre", id],
    queryFn: () => apiClient.get(`/genres/${id}`),
    enabled: !!id && !!token,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (genreLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
        <Text className="text-neutral-400 mt-4">Loading genre...</Text>
      </View>
    );
  }

  if (data?.id) {
    return (
      <Redirect
        href={{
          pathname: "/(tabs)/search",
          params: { genreId: data.id },
        }}
      />
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-foreground text-lg">Genre not found</Text>
      <TouchableOpacity
        onPress={() => router.replace("/(tabs)/home")}
        className="mt-4 px-6 py-3 bg-primary rounded-lg"
      >
        <Text className="text-white font-semibold">Go to Home</Text>
      </TouchableOpacity>
    </View>
  );
}
