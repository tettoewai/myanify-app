import { LoadingSpinner } from "@/components/LoadingSpinner";
import { apiClient } from "@/lib/api";
import { AppColors } from "@/lib/colors";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Input, useToast } from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

export default function ForgotPassword() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isEmailSent, setIsEmailSent] = useState(false);

  const forgotPasswordMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post("/auth/forgot-password", {
        email,
      });
      return response as { message?: string };
    },
    onSuccess: () => {
      setIsEmailSent(true);
    },
    onError: (error: any) => {
      toast.show({
        variant: "danger",
        label: "Request Failed",
        description: error.message || "Failed to send reset link. Try again.",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
      });
    },
  });

  const isInvalidEmail =
    email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSendResetLink = () => {
    if (!email || isInvalidEmail) {
      toast.show({
        variant: "warning",
        label: "Validation Error",
        description: "Please enter a valid email address",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
        actionLabel: "Close",
        onActionPress: ({ hide }) => hide(),
      });
      return;
    }
    forgotPasswordMutation.mutate();
  };

  if (isEmailSent) {
    return (
      <View className="flex-1 justify-center items-center bg-background px-5">
        <View className="w-full">
          <View className="w-full items-center">
            <View className="w-16 h-16 rounded-full bg-green-100/10 items-center justify-center mb-4">
              <Ionicons name="mail" size={28} color="#22c55e" />
            </View>
            <Text className="text-foreground text-xl font-bold">
              Check your email
            </Text>
            <Text className="text-muted-foreground/80 text-sm mt-3 text-center leading-relaxed">
              We&apos;ve sent a password reset link to{" "}
              <Text className="text-foreground font-medium">{email}</Text>
            </Text>
            <Text className="text-muted-foreground/70 text-sm mt-2 text-center">
              If you don&apos;t see it, please check your spam folder.
            </Text>
          </View>
          <View className="mt-6 gap-3">
            <Button
              feedbackVariant="scale-ripple"
              className="w-full rounded-sm"
              variant="ghost"
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
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center bg-background px-5">
      <View className="w-full">
        <View className="w-full items-center">
          <Text className="font-bold text-primary text-2xl">Myanify</Text>
          <Text className="text-muted-foreground/70">
            Enter your email to receive a password reset link
          </Text>
        </View>
        <View className="gap-4 mt-6">
          <View className="gap-1">
            <Text className="text-sm font-medium text-foreground ml-1">
              Email Address <Text className="text-danger">*</Text>
            </Text>
            <View className="w-full flex-row items-center relative">
              <Input
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                className="flex-1 pl-10 pr-4 rounded-sm"
                editable={!forgotPasswordMutation.isPending}
                isInvalid={isInvalidEmail}
              />
              <StyledIonicons
                name="mail-outline"
                size={16}
                className="absolute left-3.5 text-muted-foreground"
                pointerEvents="none"
              />
            </View>
            {isInvalidEmail && (
              <Text className="text-xs text-danger ml-1">
                Please enter a valid email address
              </Text>
            )}
          </View>

          <Button
            feedbackVariant="scale-ripple"
            className="mt-4 rounded-sm w-full"
            variant="primary"
            onPress={handleSendResetLink}
            isDisabled={forgotPasswordMutation.isPending}
          >
            {forgotPasswordMutation.isPending ? (
              <LoadingSpinner size="sm" color="#ffffff" />
            ) : (
              <Button.Label>Send reset link</Button.Label>
            )}
          </Button>
        </View>
        <View className="mt-6 items-center">
          <Button
            feedbackVariant="scale-ripple"
            variant="ghost"
            className="rounded-sm"
            onPress={() => router.replace("/(auth)/login")}
            isDisabled={forgotPasswordMutation.isPending}
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
      </View>
    </View>
  );
}