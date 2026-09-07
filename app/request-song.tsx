import { RequireAuth } from "@/components/auth/RequireAuth";
import { StyledSafeAreaView as SafeAreaView } from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { apiClient } from "@/lib/api";
import { AppColors } from "@/lib/colors";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Button, Card, useToast } from "heroui-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SongRequest {
  id: string;
  songTitle: string;
  artistName: string;
  notes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export default function RequestSong() {
  return (
    <RequireAuth inline>
      <RequestSongScreen />
    </RequireAuth>
  );
}

function RequestSongScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { currentSong } = usePlayer();
  const { toast } = useToast();
  const router = useRouter();

  const [songTitle, setSongTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [notes, setNotes] = useState("");

  const {
    data: songRequestsData,
    isLoading: requestsLoading,
    isError: requestsError,
    refetch: refetchRequests,
  } = useQuery<{ data: SongRequest[] }>({
    queryKey: ["song-requests"],
    queryFn: () => apiClient.get("/song-requests"),
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
  });

  const submitRequestMutation = useMutation({
    mutationFn: (data: { songTitle: string; artistName: string; notes?: string }) =>
      apiClient.post("/song-requests", data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({
        label: "Song request submitted!",
        variant: "success",
      });
      setSongTitle("");
      setArtistName("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["song-requests"] });
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show({
        label: error.message || "Failed to submit request",
        variant: "danger",
      });
    },
  });

  const handleSubmit = () => {
    if (!songTitle.trim() || !artistName.trim()) {
      toast.show({
        label: "Song title and artist name are required",
        variant: "danger",
      });
      return;
    }
    submitRequestMutation.mutate({
      songTitle: songTitle.trim(),
      artistName: artistName.trim(),
      notes: notes.trim() || undefined,
    });
  };

  const songRequests = songRequestsData?.data || [];
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background" style={{ paddingBottom: insets.bottom }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <SafeAreaView edges={["top"]} className="bg-background">
          <View className="flex-row items-center px-4 py-3">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              className="w-10 h-10 items-center justify-center rounded-full bg-card"
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View className="ml-3 flex-1">
              <Text className="text-foreground text-lg font-bold">
                Request a Song
              </Text>
              <Text className="text-muted-foreground text-xs mt-0.5">
                Tell us what song you would like to see on Myanify
              </Text>
            </View>
          </View>
        </SafeAreaView>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: currentSong ? 120 : 24 }}
        >
          <View className="flex-1 px-4 pt-2">
            {/* New request form */}
            <Card className="mb-4 p-4 bg-card border border-border">
              <View className="flex-row items-center mb-4">
                <View className="w-9 h-9 rounded-lg bg-primary/10 items-center justify-center mr-3">
                  <Ionicons name="send-outline" size={18} color={AppColors.primary} />
                </View>
                <View>
                  <Text className="text-base font-bold text-foreground">
                    New Request
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    Fill in the song details below
                  </Text>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">
                  Song Title <Text className="text-danger">*</Text>
                </Text>
                <TextInput
                  value={songTitle}
                  onChangeText={setSongTitle}
                  placeholder="e.g. မနှင်းဆီ"
                  placeholderTextColor={AppColors.placeholder}
                  style={{ color: AppColors.foreground }}
                  className="bg-background border border-border rounded-lg px-4 py-3"
                />
              </View>

              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">
                  Artist Name <Text className="text-danger">*</Text>
                </Text>
                <TextInput
                  value={artistName}
                  onChangeText={setArtistName}
                  placeholder="e.g. လွှမ်းမိုး"
                  placeholderTextColor={AppColors.placeholder}
                  style={{ color: AppColors.foreground }}
                  className="bg-background border border-border rounded-lg px-4 py-3"
                />
              </View>

              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">
                  Notes <Text className="text-muted-foreground text-xs">(optional)</Text>
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="YouTube link, version, etc."
                  placeholderTextColor={AppColors.placeholder}
                  style={{ color: AppColors.foreground, minHeight: 80 }}
                  className="bg-background border border-border rounded-lg px-4 py-3"
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <Button
                onPress={handleSubmit}
                isDisabled={
                  submitRequestMutation.isPending ||
                  !songTitle.trim() ||
                  !artistName.trim()
                }
                className="w-full"
              >
                <Button.Label>
                  {submitRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button.Label>
              </Button>
            </Card>

            {/* Request history */}
            <Card className="mb-4 p-4 bg-card border border-border">
              <View className="flex-row items-center mb-4">
                <View className="w-9 h-9 rounded-lg bg-primary/10 items-center justify-center mr-3">
                  <Ionicons name="musical-notes-outline" size={18} color={AppColors.primary} />
                </View>
                <View>
                  <Text className="text-base font-bold text-foreground">
                    Your Requests
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    Track the status of your song requests
                  </Text>
                </View>
              </View>

              {requestsLoading ? (
                <View className="gap-3">
                  {[1, 2, 3].map((i) => (
                    <View
                      key={i}
                      className="h-14 bg-muted rounded-lg opacity-60"
                    />
                  ))}
                </View>
              ) : requestsError ? (
                <View className="items-center py-8">
                  <Ionicons
                    name="alert-circle-outline"
                    size={32}
                    color="#ef4444"
                  />
                  <Text className="text-muted-foreground text-sm mt-2">
                    Failed to load requests
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => void refetchRequests()}
                    className="mt-2"
                  >
                    <Button.Label>Retry</Button.Label>
                  </Button>
                </View>
              ) : songRequests.length === 0 ? (
                <View className="items-center py-8">
                  <Ionicons
                    name="musical-notes-outline"
                    size={40}
                    color={AppColors.mutedForeground}
                    style={{ opacity: 0.4 }}
                  />
                  <Text className="text-muted-foreground text-sm mt-3">
                    No requests yet
                  </Text>
                  <Text className="text-muted-foreground/70 text-xs mt-1">
                    Submit your first song request above
                  </Text>
                </View>
              ) : (
                <View>
                  {songRequests.map((request) => (
                    <View
                      key={request.id}
                      className="flex-row items-center justify-between py-3 border-b border-border last:border-b-0"
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-foreground font-medium" numberOfLines={1}>
                          {request.songTitle}
                        </Text>
                        <Text
                          className="text-muted-foreground text-sm"
                          numberOfLines={1}
                        >
                          {request.artistName}
                        </Text>
                        {request.notes ? (
                          <Text
                            className="text-muted-foreground/70 text-xs mt-0.5"
                            numberOfLines={1}
                          >
                            {request.notes}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        className={`px-2 py-1 rounded-full ${
                          request.status === "PENDING"
                            ? "bg-amber-500/20"
                            : request.status === "APPROVED"
                              ? "bg-emerald-500/20"
                              : "bg-danger/20"
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            request.status === "PENDING"
                              ? "text-amber-500"
                              : request.status === "APPROVED"
                                ? "text-emerald-500"
                                : "text-danger"
                          }`}
                        >
                          {request.status.charAt(0) +
                            request.status.slice(1).toLowerCase()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
