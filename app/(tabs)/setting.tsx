import { StyledSafeAreaView as SafeAreaView } from "@/components/styled";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { apiClient } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Button, Card } from "heroui-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Uniwind, useUniwind } from "uniwind";

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

export default function Setting() {
  const { signOut, token } = useAuth();
  const { theme } = useUniwind();
  const queryClient = useQueryClient();
  const { currentSong } = usePlayer();

  // Local state for form fields
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);

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
      setAvatarUrl(profile.avatarUrl || "");
    }
  }, [profile]);

  // Mutation for updating profile
  const updateProfileMutation = useMutation({
    mutationFn: (data: { name: string; avatarUrl: string }) =>
      apiClient.patch("/user/profile", data),
    onSuccess: (data) => {
      queryClient.setQueryData(["user", "profile"], data);
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Profile updated successfully");
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to update profile");
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({ name, avatarUrl });
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            signOut();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const toggleTheme = () => {
    Uniwind.setTheme(theme === "light" ? "dark" : "light");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#ff0000" />
        </View>
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
              <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center mr-4">
                {profile.avatarUrl ? (
                  <Ionicons name="person" size={32} color="#ff0000" />
                ) : (
                  <Ionicons name="person" size={32} color="#ff0000" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-lg">
                  {profile.name || "User"}
                </Text>
                <Text className="text-muted-foreground text-sm">
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
                    placeholderTextColor="#666"
                    className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                  />
                </View>

                <View>
                  <Text className="text-foreground font-medium mb-2">
                    Avatar URL
                  </Text>
                  <TextInput
                    value={avatarUrl}
                    onChangeText={setAvatarUrl}
                    placeholder="https://example.com/avatar.jpg"
                    placeholderTextColor="#666"
                    className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                  />
                </View>

                <View className="flex-row gap-2 mt-2">
                  <Button
                    onPress={handleSaveProfile}
                    isDisabled={updateProfileMutation.isPending}
                    className="flex-1"
                  >
                    <Button.Label>
                      {updateProfileMutation.isPending ? "Saving..." : "Save"}
                    </Button.Label>
                  </Button>
                  <Button
                    onPress={() => {
                      setIsEditing(false);
                      setName(profile.name || "");
                      setAvatarUrl(profile.avatarUrl || "");
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    className="flex-1"
                    variant="ghost"
                  >
                    <Button.Label>Cancel</Button.Label>
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

            <TouchableOpacity
              onPress={toggleTheme}
              className="flex-row items-center justify-between py-3 border-b border-border"
            >
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name={theme === "dark" ? "moon" : "sunny"}
                  size={20}
                  color="#ff0000"
                  style={{ marginRight: 12 }}
                />
                <Text className="text-foreground font-medium">Theme</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-muted-foreground mr-2">
                  {theme === "dark" ? "Dark" : "Light"}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </View>
            </TouchableOpacity>

            <View className="flex-row items-center justify-between py-3 border-b border-border">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color="#ff0000"
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
                trackColor={{ false: "#3e3e3e", true: "#ff0000" }}
                thumbColor="#fff"
              />
            </View>

            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name="download-outline"
                  size={20}
                  color="#ff0000"
                  style={{ marginRight: 12 }}
                />
                <Text className="text-foreground font-medium">
                  Download Quality
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-muted-foreground mr-2">High</Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
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
                  Alert.alert(
                    "Premium",
                    "Upgrade to Premium for ad-free listening and more features!"
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
                  Alert.alert(
                    "Change Password",
                    "Please use the web app to change your password."
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
                Alert.alert(
                  "Privacy Settings",
                  "Manage your privacy preferences here."
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

          {/* About Section */}
          <Card className="mb-4 p-4 bg-card border border-border">
            <Text className="text-lg font-bold text-foreground mb-4">
              About
            </Text>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert(
                  "Help & Support",
                  "Contact us at support@myanify.com"
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
                Alert.alert(
                  "Terms & Privacy",
                  "Read our terms of service and privacy policy."
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
              <Text className="text-muted-foreground">1.0.0</Text>
            </View>
          </Card>

          {/* Sign Out Button */}
          <TouchableOpacity
            onPress={handleSignOut}
            className="bg-destructive rounded-lg py-4 items-center mb-4"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Ionicons
                name="log-out-outline"
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text className="text-white font-semibold text-base">
                Sign Out
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
          color="#ff0000"
          style={{ marginRight: 12 }}
        />
        <Text className="text-foreground font-medium">{label}</Text>
      </View>
      <Text className="text-muted-foreground">{value}</Text>
    </View>
  );
}
