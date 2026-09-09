import { LoadingSpinner, LoadingView } from "@/components/LoadingSpinner";
import { apiClient } from "@/lib/api";
import { AppColors } from "@/lib/colors";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Input, useToast } from "heroui-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

type VerifyStatus = "loading" | "success" | "error" | "expired";

export default function VerifyEmail() {
  const router = useRouter();
  const { toast } = useToast();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<VerifyStatus>("loading");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus("error");
        setMessage("No verification token provided");
        return;
      }

      try {
        const response = (await apiClient.get(
          `/auth/verify-email?token=${encodeURIComponent(token)}`,
        )) as { success?: boolean; expired?: boolean; error?: string };

        if (response.success) {
          setStatus("success");
          setMessage("Your email has been verified successfully!");
        } else if (response.expired) {
          setStatus("expired");
          setMessage(
            response.error || "Verification link has expired. Please request a new one.",
          );
        } else {
          setStatus("error");
          setMessage(response.error || "Failed to verify email");
        }
      } catch (error: any) {
        if (String(error.message).toLowerCase().includes("expired")) {
          setStatus("expired");
          setMessage(
            error.message ||
              "Verification link has expired. Please request a new one.",
          );
        } else {
          setStatus("error");
          setMessage(error.message || "An error occurred. Please try again.");
        }
      }
    };

    verifyEmail();
  }, [token]);

  const isInvalidEmail =
    email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleResendVerification = async () => {
    if (!email || isInvalidEmail) {
      toast.show({
        variant: "warning",
        label: "Validation Error",
        description: "Please enter your email address",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
        actionLabel: "Close",
        onActionPress: ({ hide }) => hide(),
      });
      return;
    }

    setIsResending(true);
    try {
      const response = (await apiClient.post("/auth/resend-verification", {
        email,
      })) as { message?: string };
      setStatus("loading");
      setMessage(
        response.message || "New verification link sent. Please check your email.",
      );
      toast.show({
        variant: "success",
        label: "Email sent",
        description: "Verification email resent. Valid for 24 hours.",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Resend Failed",
        description:
          error.message || "Failed to resend verification email",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
      });
    } finally {
      setIsResending(false);
    }
  };

  if (status === "loading") {
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

  return (
    <View className="flex-1 justify-center items-center bg-background px-5">
      <View className="w-full">
        <View className="w-full items-center">
          {status === "success" && (
            <>
              <View className="w-16 h-16 rounded-full bg-green-100/10 items-center justify-center mb-4">
                <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
              </View>
              <Text className="text-foreground text-xl font-bold">
                Email Verified
              </Text>
              <Text className="text-muted-foreground/80 text-sm mt-3 text-center leading-relaxed">
                {message}
              </Text>
              <Text className="text-muted-foreground/70 text-sm mt-2 text-center">
                You can now sign in and start enjoying Myanmar music.
              </Text>
              <View className="w-full mt-6">
                <Button
                  feedbackVariant="scale-ripple"
                  className="w-full rounded-sm"
                  variant="primary"
                  onPress={() => router.replace("/(auth)/login")}
                >
                  <Button.Label>Sign In Now</Button.Label>
                </Button>
              </View>
            </>
          )}

          {status === "expired" && (
            <>
              <View className="w-16 h-16 rounded-full bg-yellow-100/10 items-center justify-center mb-4">
                <Ionicons name="time" size={28} color="#f59e0b" />
              </View>
              <Text className="text-foreground text-xl font-bold">
                Link Expired
              </Text>
              <Text className="text-muted-foreground/80 text-sm mt-3 text-center leading-relaxed">
                {message}
              </Text>
              <Text className="text-muted-foreground/70 text-sm mt-2 text-center">
                Verification links are valid for 24 hours for security reasons.
              </Text>
            </>
          )}

          {status === "error" && (
            <>
              <View className="w-16 h-16 rounded-full bg-red-100/10 items-center justify-center mb-4">
                <Ionicons name="close-circle" size={28} color="#ef4444" />
              </View>
              <Text className="text-foreground text-xl font-bold">
                Verification Failed
              </Text>
              <Text className="text-muted-foreground/80 text-sm mt-3 text-center leading-relaxed">
                {message}
              </Text>
            </>
          )}
        </View>

        {(status === "expired" || status === "error") && (
          <View className="mt-6 gap-1">
            <Text className="text-sm font-medium text-foreground ml-1">
              Email Address <Text className="text-danger">*</Text>
            </Text>
            <View className="w-full flex-row items-center relative">
              <Input
                placeholder="Enter your email to resend"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                className="flex-1 pl-10 pr-4 rounded-sm"
                editable={!isResending}
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
            <View className="mt-4 gap-3">
              <Button
                feedbackVariant="scale-ripple"
                className="w-full rounded-sm"
                variant="primary"
                onPress={handleResendVerification}
                isDisabled={isResending}
              >
                {isResending ? (
                  <LoadingSpinner size="sm" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="mail-outline" size={16} color="white" className="mr-2" />
                    <Button.Label>Resend verification email</Button.Label>
                  </>
                )}
              </Button>
            </View>
            {backToSignIn}
          </View>
        )}

        {status === "success" && backToSignIn}
      </View>
    </View>
  );
}