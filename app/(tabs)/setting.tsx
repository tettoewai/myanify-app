import { LoadingView } from "@/components/LoadingSpinner";
import { SignInPrompt } from "@/components/auth/SignInPrompt";
import {
  StyledSafeAreaView as SafeAreaView,
  StyledImage,
} from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { apiClient } from "@/lib/api";
import { AppColors } from "@/lib/colors";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Button, Card, Dialog, useToast } from "heroui-native";
import { useEffect, useState } from "react";
import {
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  isPremium: boolean;
  createdAt: string;
  hasPassword: boolean;
}

interface SongRequest {
  id: string;
  songTitle: string;
  artistName: string;
  notes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export default function Setting() {
  const { signOut, token, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { currentSong } = usePlayer();
  const { toast } = useToast();

  // Local state for form fields
  const [name, setName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: "",
    description: "",
  });

  const showDialog = (
    title: string,
    description: string,
    onConfirm?: () => void,
    confirmText = "OK",
    cancelText?: string,
    isDestructive = false,
  ) => {
    setDialogConfig({
      isOpen: true,
      title,
      description,
      onConfirm,
      confirmText,
      cancelText,
      isDestructive,
    });
  };

  // Fetch user profile
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery<UserProfile>({
    queryKey: ["user", "profile"],
    queryFn: () => apiClient.get("/user/profile"),
    enabled: !!token,
  });

  // Update form fields when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
    }
  }, [profile]);

  // Mutation for updating profile
  const updateProfileMutation = useMutation({
    mutationFn: (data: { name: string }) =>
      apiClient.patch("/user/profile", data),
    onSuccess: (data) => {
      queryClient.setQueryData(["user", "profile"], data);
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({
        label: "Profile updated successfully",
        variant: "success",
      });
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show({
        label: error.message || "Failed to update profile",
        variant: "danger",
      });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({ name });
  };

  // Song request form state
  const [requestSongTitle, setRequestSongTitle] = useState("");
  const [requestArtistName, setRequestArtistName] = useState("");
  const [requestNotes, setRequestNotes] = useState("");

  // Fetch song requests
  const { data: songRequestsData, refetch: refetchRequests } = useQuery<{
    data: SongRequest[];
  }>({
    queryKey: ["song-requests"],
    queryFn: () => apiClient.get("/song-requests"),
    enabled: !!token,
  });

  // Submit song request mutation
  const submitRequestMutation = useMutation({
    mutationFn: (data: { songTitle: string; artistName: string; notes?: string }) =>
      apiClient.post("/song-requests", data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({
        label: "Song request submitted!",
        variant: "success",
      });
      setRequestSongTitle("");
      setRequestArtistName("");
      setRequestNotes("");
      refetchRequests();
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show({
        label: error.message || "Failed to submit request",
        variant: "danger",
      });
    },
  });

  const handleSubmitSongRequest = () => {
    if (!requestSongTitle.trim() || !requestArtistName.trim()) {
      toast.show({
        label: "Song title and artist name are required",
        variant: "danger",
      });
      return;
    }
    submitRequestMutation.mutate({
      songTitle: requestSongTitle.trim(),
      artistName: requestArtistName.trim(),
      notes: requestNotes.trim() || undefined,
    });
  };

  const songRequests = songRequestsData?.data || [];

  const handleSignOut = () => {
    showDialog(
      "Sign Out",
      "Are you sure you want to sign out?",
      () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        signOut();
      },
      "Sign Out",
      "Cancel",
      true,
    );
  };

  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <LoadingView />
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <SignInPrompt
          title="Sign in to view settings"
          description="Manage your profile, theme, and account preferences after signing in."
          compact
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <LoadingView />
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <View className="flex-1 justify-center items-center px-4">
          <Ionicons name="alert-circle-outline" size={64} color="#ff0000" />
          <Text className="text-foreground text-lg font-semibold mt-4">
            Failed to load profile
          </Text>
          <Text className="text-muted-foreground text-center mt-2">
            {error?.message || "Please try again later"}
          </Text>
          <TouchableOpacity
            onPress={handleSignOut}
            className="mt-6 px-6 py-3 bg-primary rounded-lg"
          >
            <Text className="text-white font-semibold">Sign in again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className={`flex-1 px-4 pt-4 pb-8 ${currentSong ? "pb-20" : ""}`}>
          {/* Header */}
          <View className="mb-6">
            <Text className="text-2xl font-bold text-foreground">Settings</Text>
            <Text className="text-muted-foreground mt-1">
              Manage your account and preferences
            </Text>
          </View>

          {/* Profile Section */}
          <Card className="mb-4 p-4 bg-card border border-border">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-foreground">Profile</Text>
              {!isEditing && (
                <TouchableOpacity
                  onPress={() => {
                    setIsEditing(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className="p-2"
                >
                  <Ionicons name="create-outline" size={20} color="#ff0000" />
                </TouchableOpacity>
              )}
            </View>

            <View className="flex-row items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center mr-4 overflow-hidden">
                {profile.avatarUrl ? (
                  <StyledImage
                    source={{ uri: profile.avatarUrl }}
                    className="w-full h-full"
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons name="person" size={32} color="#ff0000" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-lg leading-loose">
                  {profile.name || "User"}
                </Text>
                <Text className="text-muted-foreground text-sm leading-loose">
                  {profile.email}
                </Text>
                {profile.isPremium && (
                  <View className="bg-primary/20 px-2 py-1 rounded-full self-start mt-1">
                    <Text className="text-primary text-xs font-semibold">
                      Premium
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {isEditing && (
              <View className="space-y-4">
                <View>
                  <Text className="text-foreground font-medium mb-2">
                    Display Name
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                    placeholderTextColor={AppColors.placeholder}
                    style={{ color: AppColors.foreground }}
                    className="bg-background border border-border rounded-lg px-4 py-3"
                  />
                </View>

                <View className="flex-row gap-2 mt-2">
                  <Button
                    onPress={() => {
                      setIsEditing(false);
                      setName(profile.name || "");
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    className="flex-1"
                    variant="ghost"
                  >
                    <Button.Label>Cancel</Button.Label>
                  </Button>
                  <Button
                    onPress={handleSaveProfile}
                    isDisabled={updateProfileMutation.isPending}
                    className="flex-1"
                  >
                    <Button.Label>
                      {updateProfileMutation.isPending ? "Saving..." : "Save"}
                    </Button.Label>
                  </Button>
                </View>
              </View>
            )}

            {!isEditing && (
              <View className="border-t border-border pt-3 mt-3">
                <SettingRow
                  icon="calendar-outline"
                  label="Member Since"
                  value={new Date(profile.createdAt).toLocaleDateString()}
                />
              </View>
            )}
          </Card>

          {/* App Preferences */}
          <Card className="mb-4 p-4 bg-card border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">
              Preferences
            </Text>

            <View className="flex-row items-center justify-between py-3 border-b border-border">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={AppColors.primary}
                  style={{ marginRight: 12 }}
                />
                <Text className="text-foreground font-medium">
                  Notifications
                </Text>
              </View>
              <Switch
                value={true}
                onValueChange={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                trackColor={{
                  false: AppColors.border,
                  true: AppColors.primary,
                }}
                thumbColor={AppColors.foreground}
              />
            </View>

            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="download-outline"
                  size={20}
                  color={AppColors.primary}
                  style={{ marginRight: 12 }}
                />
                <Text className="text-foreground font-medium">
                  Download Quality
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-muted-foreground mr-2">High</Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={AppColors.mutedForeground}
                />
              </View>
            </View>
          </Card>

          {/* Account Settings */}
          <Card className="mb-4 p-4 bg-card border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">
              Account
            </Text>

            {!profile.isPremium && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  showDialog(
                    "Premium",
                    "Upgrade to Premium for ad-free listening and more features!",
                  );
                }}
                className="flex-row items-center justify-between py-3 border-b border-border"
              >
                <View className="flex-row items-center flex-1">
                  <Ionicons
                    name="star-outline"
                    size={20}
                    color="#ff0000"
                    style={{ marginRight: 12 }}
                  />
                  <Text className="text-foreground font-medium">
                    Upgrade to Premium
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            )}

            {profile.hasPassword && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  showDialog(
                    "Change Password",
                    "Please use the web app to change your password.",
                  );
                }}
                className="flex-row items-center justify-between py-3 border-b border-border"
              >
                <View className="flex-row items-center flex-1">
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#ff0000"
                    style={{ marginRight: 12 }}
                  />
                  <Text className="text-foreground font-medium">
                    Change Password
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                showDialog(
                  "Privacy Settings",
                  "Manage your privacy preferences here.",
                );
              }}
              className="flex-row items-center justify-between py-3"
            >
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color="#ff0000"
                  style={{ marginRight: 12 }}
                />
                <Text className="text-foreground font-medium">
                  Privacy & Security
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </Card>

          {/* Song Requests Section */}
          <Card className="mb-4 p-4 bg-card border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">
              Song Requests
            </Text>

            <View className="mb-4">
              <Text className="text-foreground font-medium mb-2">
                Song Title *
              </Text>
              <TextInput
                value={requestSongTitle}
                onChangeText={setRequestSongTitle}
                placeholder="e.g. မနှင်းဆီ"
                placeholderTextColor={AppColors.placeholder}
                style={{ color: AppColors.foreground }}
                className="bg-background border border-border rounded-lg px-4 py-3"
              />
            </View>

            <View className="mb-4">
              <Text className="text-foreground font-medium mb-2">
                Artist Name *
              </Text>
              <TextInput
                value={requestArtistName}
                onChangeText={setRequestArtistName}
                placeholder="e.g. လွှမ်းမိုး"
                placeholderTextColor={AppColors.placeholder}
                style={{ color: AppColors.foreground }}
                className="bg-background border border-border rounded-lg px-4 py-3"
              />
            </View>

            <View className="mb-4">
              <Text className="text-foreground font-medium mb-2">
                Notes (optional)
              </Text>
              <TextInput
                value={requestNotes}
                onChangeText={setRequestNotes}
                placeholder="YouTube link, version, etc."
                placeholderTextColor={AppColors.placeholder}
                style={{ color: AppColors.foreground }}
                className="bg-background border border-border rounded-lg px-4 py-3"
              />
            </View>

            <Button
              onPress={handleSubmitSongRequest}
              isDisabled={
                submitRequestMutation.isPending ||
                !requestSongTitle.trim() ||
                !requestArtistName.trim()
              }
              className="w-full"
            >
              <Button.Label>
                {submitRequestMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button.Label>
            </Button>

            {songRequests.length > 0 && (
              <View className="mt-4 pt-4 border-t border-border">
                <Text className="text-foreground font-medium mb-3">
                  Your Requests
                </Text>
                {songRequests.map((request) => (
                  <View
                    key={request.id}
                    className="flex-row items-center justify-between py-3 border-b border-border last:border-b-0"
                  >
                    <View className="flex-1 mr-3">
                      <Text className="text-foreground font-medium" numberOfLines={1}>
                        {request.songTitle}
                      </Text>
                      <Text className="text-muted-foreground text-sm" numberOfLines={1}>
                        {request.artistName}
                      </Text>
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
                        {request.status.charAt(0) + request.status.slice(1).toLowerCase()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* About Section */}
          <Card className="mb-4 p-4 bg-card border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">
              About
            </Text>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                showDialog(
                  "Help & Support",
                  "Contact us at support@myanify.com",
                );
              }}
              className="flex-row items-center justify-between py-3 border-b border-border"
            >
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="help-circle-outline"
                  size={20}
                  color="#ff0000"
                  style={{ marginRight: 12 }}
                />
                <Text className="text-foreground font-medium">
                  Help & Support
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                showDialog(
                  "Terms & Privacy",
                  "Read our terms of service and privacy policy.",
                );
              }}
              className="flex-row items-center justify-between py-3 border-b border-border"
            >
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#ff0000"
                  style={{ marginRight: 12 }}
                />
                <Text className="text-foreground font-medium">
                  Terms & Privacy
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#ff0000"
                  style={{ marginRight: 12 }}
                />
                <Text className="text-foreground font-medium">Version</Text>
              </View>
              <Text className="text-muted-foreground">1.0.1</Text>
            </View>
          </Card>

          {/* Sign Out Button */}
          <TouchableOpacity
            onPress={handleSignOut}
            className="bg-danger rounded-lg py-4 items-center mb-4"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Ionicons
                name="log-out-outline"
                size={20}
                color={AppColors.dangerForeground}
                style={{ marginRight: 8 }}
              />
              <Text className="text-danger-foreground font-semibold text-base">
                Sign Out
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Generic Dialog */}
      <Dialog
        isOpen={dialogConfig.isOpen}
        onOpenChange={(isOpen) =>
          setDialogConfig((prev) => ({ ...prev, isOpen }))
        }
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Close />
            <View className="mb-5 gap-1.5">
              <Dialog.Title>{dialogConfig.title}</Dialog.Title>
              <Dialog.Description>
                {dialogConfig.description}
              </Dialog.Description>
            </View>
            <View className="flex-row justify-end gap-3">
              {dialogConfig.cancelText && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() =>
                    setDialogConfig((prev) => ({ ...prev, isOpen: false }))
                  }
                >
                  <Button.Label>{dialogConfig.cancelText}</Button.Label>
                </Button>
              )}
              <Button
                size="sm"
                className={dialogConfig.isDestructive ? "bg-danger" : ""}
                onPress={() => {
                  const action = dialogConfig.onConfirm;
                  setDialogConfig((prev) => ({ ...prev, isOpen: false }));
                  if (action) {
                    // Delay action to let Dialog exit animation finish.
                    // Without this, signOut() triggers router.replace("/") and
                    // unmounts this screen while Reanimated is still animating
                    // the Dialog, causing "Cannot find host instance" crash.
                    setTimeout(() => action(), 200);
                  }
                }}
              >
                <Button.Label>{dialogConfig.confirmText || "OK"}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <View className="flex-row items-center flex-1">
        <Ionicons
          name={icon}
          size={20}
          color={AppColors.primary}
          style={{ marginRight: 12 }}
        />
        <Text className="text-foreground font-medium">{label}</Text>
      </View>
      <Text className="text-muted-foreground">{value}</Text>
    </View>
  );
}
