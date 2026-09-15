import { LoadingView } from "@/components/LoadingSpinner";
import { DisclaimerNotice } from "@/components/DisclaimerNotice";
import { SignInPrompt } from "@/components/auth/SignInPrompt";
import {
  StyledSafeAreaView as SafeAreaView,
  StyledImage,
} from "@/components/styled";
import { UpdateModal } from "@/components/UpdateModal";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { useApkUpdate } from "@/hooks/useApkUpdate";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import { apiClient } from "@/lib/api";
import { getAppVersion, getVersionLabel } from "@/lib/app-version";
import { AppColors } from "@/lib/colors";
import { fetchAvailableApkUpdate } from "@/lib/mobile-update";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { checkForUpdateAsync } from "expo-updates";
import { Button, Card, Dialog, useToast } from "heroui-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
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

interface NotificationPreferences {
  newSongs: boolean;
  newAlbums: boolean;
  songRequestUpdates: boolean;
  announcements: boolean;
}

const LAST_UPDATE_CHECK_KEY = "@myanify:last-manual-update-check";

export default function Setting() {
  const { signOut, token, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { currentSong } = usePlayer();
  const { toast } = useToast();
  const router = useRouter();

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
    staleTime: 5 * 60 * 1000,
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

  // Notification preferences
  const { data: notifPrefs, isLoading: notifPrefsLoading } =
    useQuery<NotificationPreferences>({
      queryKey: ["notification-preferences"],
      queryFn: () => apiClient.get("/notifications/preferences"),
      enabled: !!token,
      staleTime: 5 * 60 * 1000,
    });

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if (notifPrefsLoading) return;
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotificationsEnabled(status === "granted");
    });
  }, [notifPrefsLoading]);

  const updatePrefsMutation = useMutation({
    mutationFn: (data: Partial<NotificationPreferences>) =>
      apiClient.put("/notifications/preferences", data),
    onSuccess: (data) => {
      queryClient.setQueryData(["notification-preferences"], data);
    },
    onError: (error: any) => {
      toast.show({
        label: error.message || "Failed to update preferences",
        variant: "danger",
      });
    },
  });

  const handleToggleNotifications = async (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotificationsEnabled(enabled);

    if (enabled) {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        setNotificationsEnabled(status === "granted");
        if (status !== "granted") return;
      }
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        await apiClient.post("/push-tokens", {
          token: tokenData.data,
          platform: Platform.OS.toUpperCase(),
          deviceName: Platform.OS === "android" ? "Android" : "iOS",
        });
        toast.show({
          label: "Notifications enabled",
          variant: "success",
        });
      } catch (error: any) {
        setNotificationsEnabled(false);
        toast.show({
          label: error.message || "Failed to enable notifications",
          variant: "danger",
        });
      }
    } else {
      try {
        await apiClient.delete("/push-tokens");
        toast.show({
          label: "Notifications disabled",
        });
      } catch {
        // Best-effort unregister
      }
    }
  };

  const handlePrefToggle = (key: keyof NotificationPreferences, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePrefsMutation.mutate({ [key]: value });
  };

  // Manual update check (APK on Android + OTA everywhere)
  const {
    apkUpdate,
    downloadProgress: apkDownloadProgress,
    downloadStatus: apkDownloadStatus,
    downloadAndInstall: downloadAndInstallApk,
    error: apkUpdateError,
    check: checkApkUpdate,
    clearError: clearApkUpdateError,
  } = useApkUpdate();
  const {
    isUpdateAvailable: isOtaUpdateAvailable,
    isDownloading: isOtaDownloading,
    download: downloadOtaUpdate,
  } = useUpdateCheck();
  const [isManualChecking, setIsManualChecking] = useState(false);
  const [manualUpdateVisible, setManualUpdateVisible] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LAST_UPDATE_CHECK_KEY)
      .then((v) => {
        if (v) setLastCheckedAt(v);
      })
      .catch(() => {});
  }, []);

  const recordLastChecked = () => {
    const now = new Date().toISOString();
    setLastCheckedAt(now);
    AsyncStorage.setItem(LAST_UPDATE_CHECK_KEY, now).catch(() => {});
  };

  const handleCheckForUpdates = async () => {
    if (isManualChecking) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsManualChecking(true);
    try {
      // 1. Native APK update (Android only) — same rules as automatic checks.
      if (Platform.OS === "android") {
        const result = await fetchAvailableApkUpdate();
        if (result.status === "ok" && result.update.available) {
          // Sync the hook state so the modal can download + install.
          await checkApkUpdate();
          recordLastChecked();
          setManualUpdateVisible(true);
          return;
        }
        if (result.status === "rejected") {
          toast.show({
            label: "Update check failed verification. Please try again later.",
            variant: "danger",
          });
          return;
        }
      }

      // 2. Over-the-air JS update (all platforms, production builds only).
      if (!__DEV__) {
        try {
          const ota = await checkForUpdateAsync();
          if (ota.isAvailable || isOtaUpdateAvailable) {
            recordLastChecked();
            toast.show({
              label: "Update found — downloading…",
              variant: "success",
            });
            await downloadOtaUpdate().catch(() => {});
            return;
          }
        } catch {
          toast.show({
            label:
              "Couldn't check for updates. Check your connection and try again.",
            variant: "danger",
          });
          return;
        }
      }

      recordLastChecked();
      toast.show({
        label: `You're up to date (v${getAppVersion()})`,
        variant: "success",
      });
    } catch {
      toast.show({
        label: "Couldn't check for updates. Check your connection and try again.",
        variant: "danger",
      });
    } finally {
      setIsManualChecking(false);
    }
  };

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
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{
                  false: AppColors.border,
                  true: AppColors.primary,
                }}
                thumbColor={AppColors.foreground}
              />
            </View>

            {notificationsEnabled && (
              <View className="pt-1">
                <NotifSubRow
                  icon="musical-note-outline"
                  label="New song releases"
                  description="When artists you follow release new songs"
                  value={notifPrefs?.newSongs ?? true}
                  onValueChange={(v) => handlePrefToggle("newSongs", v)}
                />
                <NotifSubRow
                  icon="albums-outline"
                  label="New albums"
                  description="When new albums are added"
                  value={notifPrefs?.newAlbums ?? true}
                  onValueChange={(v) => handlePrefToggle("newAlbums", v)}
                />
                <NotifSubRow
                  icon="checkmark-done-outline"
                  label="Song requests"
                  description="When your song request is reviewed"
                  value={notifPrefs?.songRequestUpdates ?? true}
                  onValueChange={(v) => handlePrefToggle("songRequestUpdates", v)}
                />
                <NotifSubRow
                  icon="megaphone-outline"
                  label="Announcements"
                  description="App news and updates"
                  value={notifPrefs?.announcements ?? true}
                  onValueChange={(v) => handlePrefToggle("announcements", v)}
                />
              </View>
            )}

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

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/change-password");
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
                  {profile.hasPassword ? "Change Password" : "Set Password"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

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

          {/* What's New Section */}
          <Card className="mb-4 p-4 bg-card border border-border">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/announcements");
              }}
              className="flex-row items-center justify-between py-2"
            >
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color="#ff0000"
                  style={{ marginRight: 12 }}
                />
                <View className="flex-1">
                  <Text className="text-foreground font-medium">
                    What&apos;s New
                  </Text>
                  <Text className="text-muted-foreground text-xs mt-0.5">
                    Announcements and app updates
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </Card>

          {/* Song Requests Section */}
          <Card className="mb-4 p-4 bg-card border border-border">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/request-song");
              }}
              className="flex-row items-center justify-between py-2"
            >
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="musical-notes-outline"
                  size={20}
                  color="#ff0000"
                  style={{ marginRight: 12 }}
                />
                <View className="flex-1">
                  <Text className="text-foreground font-medium">
                    Request a Song
                  </Text>
                  <Text className="text-muted-foreground text-xs mt-0.5">
                    Suggest songs and track your requests
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </Card>

          {/* Downloads Section */}
          <Card className="mb-4 p-4 bg-card border border-border">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/downloads");
              }}
              className="flex-row items-center justify-between py-2"
            >
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="cloud-download-outline"
                  size={20}
                  color="#ff0000"
                  style={{ marginRight: 12 }}
                />
                <View className="flex-1">
                  <Text className="text-foreground font-medium">
                    Downloads
                  </Text>
                  <Text className="text-muted-foreground text-xs mt-0.5">
                    Songs available offline
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
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

            <View className="flex-row items-center justify-between py-3 border-b border-border">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#ff0000"
                  style={{ marginRight: 12 }}
                />
                <Text className="text-foreground font-medium">Version</Text>
              </View>
              <Text className="text-muted-foreground">{getVersionLabel()}</Text>
            </View>

            <TouchableOpacity
              onPress={() => void handleCheckForUpdates()}
              disabled={isManualChecking}
              className="flex-row items-center justify-between py-3"
            >
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color="#ff0000"
                  style={{ marginRight: 12 }}
                />
                <View className="flex-1">
                  <Text className="text-foreground font-medium">
                    Check for updates
                  </Text>
                  {lastCheckedAt ? (
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      Last checked{" "}
                      {new Date(lastCheckedAt).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              </View>
              {isManualChecking ? (
                <ActivityIndicator size="small" color={AppColors.primary} />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="#666"
                />
              )}
            </TouchableOpacity>
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

          {/* Non-commercial disclaimer */}
          <DisclaimerNotice />
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

      {/* Manual APK update prompt (Android). OTA updates surface via the
          global prompt; the "up to date" verdict is shown as a toast. */}
      {apkUpdate.available ? (
        <UpdateModal
          visible={manualUpdateVisible}
          kind="apk"
          version={apkUpdate.version}
          notes={apkUpdate.notes}
          mandatory={apkUpdate.mandatory}
          isDownloading={apkDownloadStatus === "downloading" || isOtaDownloading}
          downloadStatus={apkDownloadStatus}
          downloadProgress={apkDownloadProgress}
          error={apkUpdateError}
          onInstall={() => void downloadAndInstallApk()}
          onLater={
            apkUpdate.mandatory
              ? undefined
              : () => setManualUpdateVisible(false)
          }
          onDismissError={clearApkUpdateError}
        />
      ) : null}
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

function NotifSubRow({
  icon,
  label,
  description,
  value,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-2.5 border-b border-border/50">
      <View className="flex-row items-center flex-1 pr-3">
        <Ionicons
          name={icon}
          size={18}
          color={AppColors.mutedForeground}
          style={{ marginRight: 12 }}
        />
        <View className="flex-1">
          <Text className="text-foreground text-sm font-medium">{label}</Text>
          <Text className="text-muted-foreground text-xs mt-0.5">
            {description}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: AppColors.border,
          true: AppColors.primary,
        }}
        thumbColor={AppColors.foreground}
      />
    </View>
  );
}
