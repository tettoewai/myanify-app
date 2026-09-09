import { LoadingSpinner, LoadingView } from "@/components/LoadingSpinner";
import { apiClient } from "@/lib/api";
import { AppColors } from "@/lib/colors";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Button, Input, useToast } from "heroui-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

export default function ResetPassword() {
  const router = useRouter();
  const { toast } = useToast();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetComplete, setIsResetComplete] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValidToken(false);
        return;
      }
      try {
        const response = await apiClient.get(
          `/auth/validate-reset-token?token=${encodeURIComponent(token)}`,
        );
        setIsValidToken(!!(response as { valid?: boolean }).valid);
      } catch {
        setIsValidToken(false);
      }
    };

    validateToken();
  }, [token]);

  const doPasswordsMatch = confirmPassword === "" || password === confirmPassword;

  const handleResetPassword = async () => {
    if (password.length < 6) {
      toast.show({
        variant: "warning",
        label: "Validation Error",
        description: "Password must be at least 6 characters",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
        actionLabel: "Close",
        onActionPress: ({ hide }) => hide(),
      });
      return;
    }
    if (password !== confirmPassword) {
      toast.show({
        variant: "warning",
        label: "Validation Error",
        description: "Passwords do not match",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
        actionLabel: "Close",
        onActionPress: ({ hide }) => hide(),
      });
      return;
    }

    setIsResetting(true);
    try {
      await apiClient.post("/auth/reset-password", { token, password });
      setIsResetComplete(true);
      toast.show({
        variant: "success",
        label: "Password Reset Successful",
        description: "You can now sign in with your new password.",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Reset Failed",
        description:
          error.message || "Failed to reset password. Please try again.",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (isValidToken === null) {
    return <LoadingView />;
  }

  const backToSignIn = (
    <View className="mt-6 items-center">
      <Button
        feedbackVariant="scale-ripple"
        variant="ghost"
        className="rounded-sm"
        onPress={() => router.replace("/(auth)/login")}
      >
        <Ionicons
          name="arrow-back"
          size={16}
          color={AppColors.iconMuted}
          className="mr-2"
        />
        <Button.Label className="text-muted-foreground">
          Back to sign in
        </Button.Label>
      </Button>
    </View>
  );

  const root = (
    <View className="flex-1 justify-center items-center bg-background px-5">
      <View className="w-full">
        <View className="w-full items-center">
          <Text className="font-bold text-primary text-2xl">Myanify</Text>
          <Text className="text-muted-foreground/70">
            Create a new password
          </Text>
        </View>
        <View className="gap-4 mt-6">
          <View className="gap-1">
            <Text className="text-sm font-medium text-foreground ml-1">
              New Password <Text className="text-danger">*</Text>
            </Text>
            <View className="w-full flex-row items-center relative">
              <Input
                placeholder="Enter your new password"
                secureTextEntry={!isVisible}
                className="flex-1 pl-10 pr-12 rounded-sm"
                value={password}
                onChangeText={setPassword}
                editable={!isResetting}
              />
              <StyledIonicons
                name="lock-closed-outline"
                size={16}
                className="absolute left-3.5 text-muted-foreground"
                pointerEvents="none"
              />
              <Pressable
                onPress={() => setIsVisible(!isVisible)}
                hitSlop={10}
                className="absolute right-4"
              >
                <StyledIonicons
                  name={isVisible ? "eye-off-outline" : "eye-outline"}
                  size={16}
                  className="text-muted-foreground"
                />
              </Pressable>
            </View>
            <Text className="text-xs text-muted-foreground ml-1">
              Must be at least 6 characters
            </Text>
          </View>

          <View className="gap-1">
            <Text className="text-sm font-medium text-foreground ml-1">
              Confirm New Password <Text className="text-danger">*</Text>
            </Text>
            <View className="w-full flex-row items-center relative">
              <Input
                placeholder="Confirm your new password"
                secureTextEntry={!isVisible}
                className="flex-1 pl-10 pr-12 rounded-sm"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!isResetting}
                isInvalid={!doPasswordsMatch}
              />
              <StyledIonicons
                name="lock-closed-outline"
                size={16}
                className="absolute left-3.5 text-muted-foreground"
                pointerEvents="none"
              />
              <Pressable
                onPress={() => setIsVisible(!isVisible)}
                hitSlop={10}
                className="absolute right-4"
              >
                <StyledIonicons
                  name={isVisible ? "eye-off-outline" : "eye-outline"}
                  size={16}
                  className="text-muted-foreground"
                />
              </Pressable>
            </View>
            {!doPasswordsMatch && (
              <Text className="text-xs text-danger ml-1">
                Passwords do not match
              </Text>
            )}
          </View>

          <Button
            feedbackVariant="scale-ripple"
            className="mt-4 rounded-sm w-full"
            variant="primary"
            onPress={handleResetPassword}
            isDisabled={isResetting}
          >
            {isResetting ? (
              <LoadingSpinner size="sm" color="#ffffff" />
            ) : (
              <Button.Label>Reset password</Button.Label>
            )}
          </Button>
        </View>
        {backToSignIn}
      </View>
    </View>
  );

  if (isResetComplete) {
    return (
      <View className="flex-1 justify-center items-center bg-background px-5">
        <View className="w-full">
          <View className="w-full items-center">
            <View className="w-16 h-16 rounded-full bg-green-100/10 items-center justify-center mb-4">
              <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
            </View>
            <Text className="text-foreground text-xl font-bold">
              Password reset successful
            </Text>
            <Text className="text-muted-foreground/80 text-sm mt-3 text-center leading-relaxed">
              Your password has been reset. You can now sign in with your new
              password.
            </Text>
          </View>
          <View className="mt-6 gap-3">
            <Button
              feedbackVariant="scale-ripple"
              className="w-full rounded-sm"
              variant="primary"
              onPress={() => router.replace("/(auth)/login")}
            >
              <Button.Label>Sign in</Button.Label>
            </Button>
          </View>
        </View>
      </View>
    );
  }

  if (isValidToken === false) {
    return (
      <View className="flex-1 justify-center items-center bg-background px-5">
        <View className="w-full">
          <View className="w-full items-center">
            <View className="w-16 h-16 rounded-full bg-red-100/10 items-center justify-center mb-4">
              <Ionicons name="alert-circle" size={28} color="#ef4444" />
            </View>
            <Text className="text-foreground text-xl font-bold">
              Invalid or expired link
            </Text>
            <Text className="text-muted-foreground/80 text-sm mt-3 text-center leading-relaxed">
              The password reset link is invalid or has expired.
            </Text>
          </View>
          <View className="mt-6 gap-3">
            <Button
              feedbackVariant="scale-ripple"
              className="w-full rounded-sm"
              variant="primary"
              onPress={() => router.replace("/(auth)/forgot-password")}
            >
              <Button.Label>Request new reset link</Button.Label>
            </Button>
            {backToSignIn}
          </View>
        </View>
      </View>
    );
  }

  return root;
}