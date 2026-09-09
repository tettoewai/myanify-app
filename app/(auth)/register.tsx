import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api";
import { AppColors } from "@/lib/colors";
import { Ionicons } from "@expo/vector-icons";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useMutation } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Button, Input, useToast } from "heroui-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

const IOS_CLIENT_ID = Constants.expoConfig?.extra?.google?.iosClientId;
const WEB_CLIENT_ID = Constants.expoConfig?.extra?.google?.webClientId;

export default function Register() {
  const { signIn } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      iosClientId: IOS_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  const registerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post("/auth/register", {
        email,
        password,
      });
      return response as {
        message?: string;
        requiresVerification?: boolean;
      };
    },
    onSuccess: (data) => {
      toast.show({
        variant: "success",
        label: "Account created",
        description:
          data.message ||
          "Please check your email to verify your account.",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
      setRegisteredEmail(email);
      setNeedsVerification(true);
    },
    onError: (error: any) => {
      toast.show({
        variant: "danger",
        label: "Registration Failed",
        description: error.message || "Failed to create account. Try again.",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
      });
    },
  });

  const googleLoginMutation = useMutation({
    mutationFn: async (idToken: string) => {
      const response = await apiClient.post("/auth/google-login", {
        idToken,
      });
      if (!response.token) {
        throw new Error("Invalid response from server");
      }
      return response.token;
    },
    onSuccess: async (appSessionToken) => {
      toast.show({
        variant: "success",
        label: "Account Created",
        description: "You've successfully signed in with Google.",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
      await signIn(appSessionToken);
    },
    onError: (error: any) => {
      toast.show({
        variant: "danger",
        label: "Google Sign Up Failed",
        description: error.message || "Something went wrong with Google login",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
      });
    },
  });

  const handleGoogleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (idToken) {
        googleLoginMutation.mutate(idToken);
      } else {
        throw new Error("No ID token received from Google");
      }
    } catch (error: any) {
      if (
        error.code !== statusCodes.SIGN_IN_CANCELLED &&
        error.code !== statusCodes.IN_PROGRESS
      ) {
        toast.show({
          variant: "danger",
          label: "Google Sign Up Error",
          description: error.message || "An unknown error occurred",
        });
      }
    }
  };

  const handleResendVerification = async () => {
    try {
      await apiClient.post("/auth/resend-verification", {
        email: registeredEmail,
      });
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
    }
  };

  const isInvalidEmail =
    email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const doPasswordsMatch = confirmPassword === "" || password === confirmPassword;

  const handleRegister = () => {
    if (!email || !password || isInvalidEmail) {
      toast.show({
        variant: "warning",
        label: "Validation Error",
        description: "Please enter a valid email and password",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
        actionLabel: "Close",
        onActionPress: ({ hide }) => hide(),
      });
      return;
    }
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
    registerMutation.mutate();
  };

  if (needsVerification) {
    return (
      <View className="flex-1 justify-center items-center bg-background px-5">
        <View className="w-full">
          <View className="w-full items-center">
            <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
              <Ionicons name="mail" size={28} color="#ff0000" />
            </View>
            <Text className="text-foreground text-xl font-bold">
              Verify Your Email
            </Text>
            <Text className="text-muted-foreground/80 text-sm mt-2 text-center leading-relaxed">
              We&apos;ve sent a verification link to{" "}
              <Text className="text-foreground font-medium">
                {registeredEmail}
              </Text>
            </Text>
            <View className="mt-4 bg-card/60 rounded-lg px-4 py-3 items-center">
              <View className="flex-row items-center gap-2">
                <Ionicons name="time-outline" size={14} color={AppColors.mutedForeground} />
                <Text className="text-muted-foreground text-xs">
                  Link expires in 24 hours
                </Text>
              </View>
              <Text className="text-muted-foreground text-xs mt-1">
                Tap the link in your email to activate your account.
              </Text>
            </View>
          </View>
          <View className="mt-6 gap-3">
            <Button
              feedbackVariant="scale-ripple"
              className="w-full rounded-sm"
              variant="primary"
              onPress={handleResendVerification}
            >
              <Ionicons name="mail-outline" size={16} color="white" className="mr-2" />
              <Button.Label>Resend verification email</Button.Label>
            </Button>
            <Button
              feedbackVariant="scale-ripple"
              className="w-full rounded-sm"
              variant="ghost"
              onPress={() => router.replace("/(auth)/login")}
            >
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
          <Text className="text-muted-foreground/70">Create your account</Text>
        </View>
        <View className="mt-4">
          <Button
            variant="tertiary"
            feedbackVariant="scale-ripple"
            className="w-full rounded-sm"
            size="sm"
            onPress={handleGoogleLogin}
            isDisabled={googleLoginMutation.isPending}
          >
            {googleLoginMutation.isPending ? (
              <LoadingSpinner size="sm" color="#ffffff" />
            ) : (
              <>
                <Ionicons
                  name="logo-google"
                  size={18}
                  color={AppColors.iconOnDark}
                  className="mr-2"
                />
                <Button.Label>Continue with Google</Button.Label>
              </>
            )}
          </Button>
        </View>
        <View className="relative mt-2 flex-row items-center justify-center">
          <View className="absolute w-full h-px bg-border" />
          <View className="bg-background px-4">
            <Text className="text-[10px] font-medium uppercase text-muted-foreground tracking-wider">
              Or continue with email
            </Text>
          </View>
        </View>
        <View className="gap-4 mt-2">
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
                editable={!registerMutation.isPending}
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

          <View className="gap-1">
            <Text className="text-sm font-medium text-foreground ml-1">
              Password <Text className="text-danger">*</Text>
            </Text>
            <View className="w-full flex-row items-center relative">
              <Input
                placeholder="Enter password"
                secureTextEntry={!isVisible}
                className="flex-1 pl-10 pr-12 rounded-sm"
                value={password}
                onChangeText={setPassword}
                editable={!registerMutation.isPending}
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
              Confirm Password <Text className="text-danger">*</Text>
            </Text>
            <View className="w-full flex-row items-center relative">
              <Input
                placeholder="Confirm your password"
                secureTextEntry={!isVisible}
                className="flex-1 pl-10 pr-12 rounded-sm"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!registerMutation.isPending}
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
            onPress={handleRegister}
            isDisabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? (
              <LoadingSpinner size="sm" color="#ffffff" />
            ) : (
              <Button.Label>Create account</Button.Label>
            )}
          </Button>
        </View>
        <View className="mt-6 items-center">
          <Text className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Text
              className="text-primary"
              onPress={() => router.replace("/(auth)/login")}
            >
              Sign in
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}