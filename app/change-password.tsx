import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { StyledSafeAreaView as SafeAreaView } from "@/components/styled";
import { apiClient } from "@/lib/api";
import { AppColors } from "@/lib/colors";
import { Ionicons } from "@expo/vector-icons";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Button, Input, useToast } from "heroui-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

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

function getPasswordStrength(pwd: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!pwd) return { score: 0, label: "", color: AppColors.border };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: "Weak", color: "#ef4444" };
  if (score <= 2) return { score, label: "Fair", color: "#f59e0b" };
  if (score <= 3) return { score, label: "Good", color: "#eab308" };
  return { score, label: "Strong", color: "#22c55e" };
}

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  isVisible,
  onToggleVisible,
  editable,
  isInvalid,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  isVisible: boolean;
  onToggleVisible: () => void;
  editable?: boolean;
  isInvalid?: boolean;
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground ml-1">{label}</Text>
      <View className="w-full flex-row items-center relative">
        <Input
          placeholder={placeholder}
          secureTextEntry={!isVisible}
          className="flex-1 pl-10 pr-12 rounded-sm"
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          isInvalid={isInvalid}
        />
        <StyledIonicons
          name="lock-closed-outline"
          size={16}
          className="absolute left-3.5 text-muted-foreground"
          pointerEvents="none"
        />
        <Pressable onPress={onToggleVisible} hitSlop={10} className="absolute right-4">
          <StyledIonicons
            name={isVisible ? "eye-off-outline" : "eye-outline"}
            size={16}
            className="text-muted-foreground"
          />
        </Pressable>
      </View>
    </View>
  );
}

function ChangePasswordScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["user", "profile"],
    queryFn: () => apiClient.get("/user/profile"),
    staleTime: 5 * 60 * 1000,
  });

  const hasPassword = profile?.hasPassword ?? false;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(
    null,
  );

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword !== "" && newPassword === confirmPassword;
  const passwordsMismatch =
    confirmPassword !== "" && newPassword !== confirmPassword;

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      apiClient.patch("/user/password", {
        currentPassword,
        newPassword,
        isInitialSetup: !hasPassword,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.setQueryData<UserProfile>(["user", "profile"], (old) =>
        old ? { ...old, hasPassword: true } : old,
      );
      toast.show({
        variant: "success",
        label: hasPassword
          ? "Password updated successfully"
          : "Password set successfully",
      });
      router.back();
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = error.message || "Failed to update password";
      setCurrentPasswordError(
        message.includes("Current password is incorrect")
          ? "Current password is incorrect"
          : null,
      );
      toast.show({
        variant: "danger",
        label: message,
      });
    },
  });

  const handleSubmit = () => {
    setCurrentPasswordError(null);

    if (newPassword !== confirmPassword) {
      toast.show({
        variant: "warning",
        label: "New passwords do not match",
      });
      return;
    }
    if (hasPassword && currentPassword === newPassword) {
      toast.show({
        variant: "warning",
        label: "New password must be different from current password",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast.show({
        variant: "warning",
        label: "Password must be at least 6 characters",
      });
      return;
    }
    if (hasPassword && !currentPassword) {
      toast.show({
        variant: "warning",
        label: "Enter your current password",
      });
      return;
    }
    changePasswordMutation.mutate();
  };

  const isSubmitDisabled =
    changePasswordMutation.isPending ||
    (hasPassword && !currentPassword) ||
    !newPassword ||
    !confirmPassword ||
    passwordsMismatch ||
    newPassword.length < 6;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-4 pb-10">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-2 mb-6"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={AppColors.foreground} />
            <Text className="text-foreground text-lg font-bold">
              {hasPassword ? "Change Password" : "Set a Password"}
            </Text>
          </Pressable>

          <Text className="text-muted-foreground text-sm">
            {hasPassword
              ? "Use a strong password you don't use elsewhere."
              : "Add a password to sign in with email alongside Google."}
          </Text>

          <View className="mt-6 gap-4">
            {hasPassword && (
              <View className="gap-1">
                <PasswordField
                  label="Current password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  isVisible={showCurrent}
                  onToggleVisible={() => setShowCurrent(!showCurrent)}
                  editable={!changePasswordMutation.isPending}
                  isInvalid={!!currentPasswordError}
                />
                {currentPasswordError ? (
                  <Text className="text-xs text-danger ml-1">
                    {currentPasswordError}
                  </Text>
                ) : null}
              </View>
            )}

            <PasswordField
              label={hasPassword ? "New password" : "Password"}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
              isVisible={showNew}
              onToggleVisible={() => setShowNew(!showNew)}
              editable={!changePasswordMutation.isPending}
            />

            {newPassword.length > 0 && (
              <View className="mt-1">
                <View className="flex-row gap-1">
                  {[1, 2, 3, 4].map((n) => (
                    <View
                      key={n}
                      className="h-1 flex-1 rounded-full"
                      style={{
                        backgroundColor:
                          strength.score >= n ? strength.color : AppColors.border,
                      }}
                    />
                  ))}
                </View>
                {strength.label ? (
                  <Text
                    className="text-xs font-medium mt-1"
                    style={{ color: strength.color }}
                  >
                    {strength.label}
                  </Text>
                ) : null}
              </View>
            )}

            <PasswordField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your password"
              isVisible={showConfirm}
              onToggleVisible={() => setShowConfirm(!showConfirm)}
              editable={!changePasswordMutation.isPending}
              isInvalid={passwordsMismatch}
            />
            {passwordsMismatch && (
              <Text className="text-xs text-danger -mt-3">
                Passwords do not match
              </Text>
            )}
            {passwordsMatch && (
              <Text className="text-xs text-green-500 -mt-3">
                Passwords match
              </Text>
            )}

            <Button
              feedbackVariant="scale-ripple"
              className="mt-2 rounded-sm w-full"
              variant="primary"
              onPress={handleSubmit}
              isDisabled={isSubmitDisabled}
            >
              {changePasswordMutation.isPending ? (
                <LoadingSpinner size="sm" color="#ffffff" />
              ) : (
                <Button.Label>
                  {hasPassword ? "Update password" : "Set password"}
                </Button.Label>
              )}
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ChangePassword() {
  return (
    <RequireAuth>
      <ChangePasswordScreen />
    </RequireAuth>
  );
}