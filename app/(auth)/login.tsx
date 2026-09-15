import { LoadingSpinner, LoadingView } from "@/components/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { AppColors } from "@/lib/colors";
import { useSpotifyAuthRequest, getSpotifyAuthSuccess, SPOTIFY_LOGIN_ENABLED } from "@/lib/spotify-auth";
import type * as AuthSession from "expo-auth-session";
import { Ionicons } from "@expo/vector-icons";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useMutation } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Button, Input, useToast } from "heroui-native";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

const IOS_CLIENT_ID = Constants.expoConfig?.extra?.google?.iosClientId;
const WEB_CLIENT_ID = Constants.expoConfig?.extra?.google?.webClientId;

export default function Login() {
  const { signIn, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const {
    request: spotifyRequest,
    response: spotifyResponse,
    promptAsync: promptSpotifyAsync,
    clientId: spotifyClientId,
    redirectUri: spotifyRedirectUri,
    isReady: isSpotifyReady,
  } = useSpotifyAuthRequest();

  useEffect(() => {
    if (!WEB_CLIENT_ID) {
      console.warn(
        "Google Sign-In: WEB_CLIENT_ID is not defined in expoConfig.extra.google",
      );
    }
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      iosClientId: IOS_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post("/mobile-login", {
        email,
        password,
      });
      if (!response.token) {
        throw new Error("Invalid response from server");
      }
      return response.token;
    },
    onSuccess: async (token) => {
      toast.show({
        variant: "success",
        label: "Login Successful",
        description: "Welcome back to Myanify!",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
      await signIn(token);
    },
    onError: (error: any) => {
      let errorMessage = error.message || "Something went wrong";

      if (
        errorMessage.includes("Network request failed") ||
        errorMessage.includes("Connection to") ||
        errorMessage.includes("failed")
      ) {
        errorMessage =
          "Unable to connect to Myanify. Check your internet connection and try again.";
      }

      if (errorMessage === "EMAIL_NOT_VERIFIED") {
        setVerificationEmail(email);
        setNeedsVerification(true);
        toast.show({
          variant: "danger",
          label: "Email Not Verified",
          description: "Please verify your email before signing in.",
          icon: <Ionicons name="alert-circle" size={24} color="white" />,
        });
        return;
      } else if (errorMessage === "Invalid credentials") {
        errorMessage = "Incorrect email or password. Please try again.";
      } else if (errorMessage === "Internal server error") {
        errorMessage =
          "Something went wrong on our end. Please try again shortly.";
      }

      const statusCode = error.response?.status;
      toast.show({
        variant: "danger",
        label: "Login Failed",
        description: statusCode
          ? `Status ${statusCode}: ${errorMessage}`
          : errorMessage,
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
        label: "Google Login Successful",
        description: "You've successfully signed in with Google.",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
      await signIn(appSessionToken);
    },
    onError: (error: any) => {
      toast.show({
        variant: "danger",
        label: "Google Login Failed",
        description: error.message || "Something went wrong with Google login",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
      });
    },
  });

  const spotifyLoginMutation = useMutation({
    mutationFn: async ({
      code,
      codeVerifier,
      redirectUri,
    }: {
      code: string;
      codeVerifier: string;
      redirectUri: string;
    }) => {
      const response = await apiClient.post("/auth/spotify-login", {
        code,
        codeVerifier,
        redirectUri,
      });
      if (!response.token) {
        throw new Error("Invalid response from server");
      }
      return response.token;
    },
    onSuccess: async (appSessionToken) => {
      toast.show({
        variant: "success",
        label: "Spotify Login Successful",
        description: "You've successfully signed in with Spotify.",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
      await signIn(appSessionToken);
    },
    onError: (error: any) => {
      toast.show({
        variant: "danger",
        label: "Spotify Login Failed",
        description: error.message || "Something went wrong with Spotify login",
        icon: <Ionicons name="alert-circle" size={24} color="white" />,
      });
    },
  });

  const handleSpotifyResult = (
    result: AuthSession.AuthSessionResult | null | undefined,
  ) => {
    const success = getSpotifyAuthSuccess(
      result,
      spotifyRequest,
      spotifyRedirectUri,
    );
    if (success) {
      spotifyLoginMutation.mutate(success);
      return;
    }
    if (result?.type === "error") {
      const error = (result as { error?: { message?: string } }).error;
      console.error("Spotify auth error:", error, {
        redirectUri: spotifyRedirectUri,
      });
      toast.show({
        variant: "danger",
        label: "Spotify Login Error",
        description:
          error?.message || "Spotify authorization failed. Please try again.",
      });
    } else if (result?.type === "dismiss" || result?.type === "cancel") {
      // User closed the browser before completing — not an error, just log.
      console.log("Spotify auth dismissed:", result.type);
    } else if (result?.type === "success") {
      // Success without a code/verifier means the PKCE request wasn't ready
      // or the redirect didn't carry a code.
      console.error("Spotify auth missing code/verifier:", result.params, {
        redirectUri: spotifyRedirectUri,
        hasCodeVerifier: !!spotifyRequest?.codeVerifier,
      });
      toast.show({
        variant: "danger",
        label: "Spotify Login Error",
        description:
          "Spotify didn't return an authorization code. Please try again.",
      });
    }
    // type === undefined/null: prompt hasn't completed yet — do nothing.
  };

  useEffect(() => {
    // Fallback for redirects that resolve via the hook state (e.g. cold start
    // deep link) rather than the promptAsync() return value below.
    if (spotifyResponse) handleSpotifyResult(spotifyResponse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyResponse]);

  const handleSpotifyLogin = async () => {
    // Spotify login disabled via SPOTIFY_LOGIN_ENABLED in lib/spotify-auth.ts
    if (!SPOTIFY_LOGIN_ENABLED) return;
    if (!spotifyClientId) {
      toast.show({
        variant: "danger",
        label: "Spotify Not Configured",
        description:
          "EXPO_PUBLIC_SPOTIFY_CLIENT_ID is missing. Add it to .env",
      });
      return;
    }
    if (!isSpotifyReady || !spotifyRequest) {
      toast.show({
        variant: "warning",
        label: "Spotify Not Ready",
        description: "Still preparing Spotify login. Please try again.",
      });
      return;
    }
    try {
      // Use the returned result directly: the `spotifyResponse` hook state
      // is null until promptAsync() resolves, so awaiting it avoids a
      // stale-null read.
      const result = await promptSpotifyAsync();
      handleSpotifyResult(result);
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Spotify Login Error",
        description: error.message || "An unknown error occurred",
      });
    }
  };

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
      console.error("Google Login Error Details:", {
        code: error.code,
        message: error.message,
        nativeStackAndroid: error.nativeStackAndroid,
        webClientId: WEB_CLIENT_ID ? "✅ Set" : "❌ Missing",
        troubleshooting:
          "https://react-native-google-signin.github.io/docs/troubleshooting",
      });

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        toast.show({
          variant: "danger",
          label: "Google Play Services",
          description: "Google Play Services not available or outdated",
        });
      } else if (error.code === "10" || error.code === 10) {
        toast.show({
          variant: "danger",
          label: "Google Sign-In Configuration Error",
          description:
            "SHA-1 fingerprint not registered. Add your app's SHA-1 to Google Cloud Console → OAuth Client ID → SHA certificate fingerprints.",
        });
      } else {
        toast.show({
          variant: "danger",
          label: "Google Login Error",
          description: error.message || "An unknown error occurred",
        });
      }
    }
  };

  const isInvalidEmail =
    email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (authLoading) {
    return <LoadingView />;
  }

  if (token) {
    return <Redirect href="/(tabs)/home" />;
  }

  const handleLogin = async () => {
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
    // Clear any existing token before attempting login
    await authStorage.removeToken();
    loginMutation.mutate();
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    try {
      await apiClient.post("/auth/resend-verification", {
        email: verificationEmail,
      });
      toast.show({
        variant: "success",
        label: "Email sent",
        description: "Verification email resent. Valid for 24 hours.",
        icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
      });
      setNeedsVerification(false);
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

  if (needsVerification) {
    return (
      <View className="flex-1 justify-center items-center bg-background px-5">
        <View className="w-full">
          <View className="w-full items-center">
            <View className="w-16 h-16 rounded-full bg-yellow-100/10 items-center justify-center mb-4">
              <Ionicons name="mail" size={28} color="#f59e0b" />
            </View>
            <Text className="text-foreground text-xl font-bold">
              Verify Your Email
            </Text>
            <Text className="text-muted-foreground/80 text-sm mt-2 text-center leading-relaxed">
              Please verify your email address before signing in.
            </Text>
            <Text className="text-muted-foreground/80 text-sm mt-2 text-center leading-relaxed">
              We sent a verification link to{" "}
              <Text className="text-foreground font-medium">
                {verificationEmail}
              </Text>
            </Text>
          </View>
          <View className="mt-6 gap-3">
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
            <Button
              feedbackVariant="scale-ripple"
              className="w-full rounded-sm"
              variant="ghost"
              onPress={() => setNeedsVerification(false)}
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
          <Text className="text-muted-foreground/70">Login to continue</Text>
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
          {/* Spotify login disabled via SPOTIFY_LOGIN_ENABLED in lib/spotify-auth.ts */}
          {SPOTIFY_LOGIN_ENABLED && (
            <Button
              variant="tertiary"
              feedbackVariant="scale-ripple"
              className="w-full rounded-sm mt-2"
              size="sm"
              onPress={handleSpotifyLogin}
              isDisabled={spotifyLoginMutation.isPending || !isSpotifyReady}
            >
              {spotifyLoginMutation.isPending ? (
                <LoadingSpinner size="sm" color="#ffffff" />
              ) : (
                <>
                  <Ionicons
                    name="musical-notes"
                    size={18}
                    color={AppColors.iconOnDark}
                    className="mr-2"
                  />
                  <Button.Label>Continue with Spotify</Button.Label>
                </>
              )}
            </Button>
          )}
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
          {/* Email TextField - Using props directly instead of compound components */}
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
                editable={!loginMutation.isPending}
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

          {/* Password TextField - Using props directly instead of compound components */}
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
                editable={!loginMutation.isPending}
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
          </View>

          <Button
            feedbackVariant="scale-ripple"
            className="mt-4 rounded-sm w-full"
            variant="primary"
            onPress={handleLogin}
            isDisabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <LoadingSpinner size="sm" color="#ffffff" />
            ) : (
              <Button.Label>Sign In</Button.Label>
            )}
          </Button>
        </View>
        <View className="mt-6 items-center gap-1">
          <Text className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Text
              className="text-primary"
              onPress={() => router.push("/(auth)/register")}
            >
              Sign up
            </Text>
          </Text>
          <Text className="text-sm text-muted-foreground">
            Forgot your password?{" "}
            <Text
              className="text-primary"
              onPress={() => router.push("/(auth)/forgot-password")}
            >
              Reset Password
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}
