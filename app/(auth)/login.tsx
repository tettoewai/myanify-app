import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { Ionicons } from "@expo/vector-icons";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useMutation } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Button, Input, Spinner, useToast } from "heroui-native";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

const IOS_CLIENT_ID = Constants.expoConfig?.extra?.google?.iosClientId;
const WEB_CLIENT_ID = Constants.expoConfig?.extra?.google?.webClientId;

export default function Login() {
  const { signIn, token, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);

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
          "Connection to server failed. Please ensure your backend is running and both devices are on the same Wi-Fi.";
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
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#ff0000" />
      </View>
    );
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
              <Spinner color="white" size="sm" />
            ) : (
              <>
                <Ionicons
                  name="logo-google"
                  size={18}
                  color="white"
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
          {/* Email TextField - Using props directly instead of compound components */}
          <View className="gap-1">
            <Text className="text-sm font-medium text-foreground ml-1">
              Email Address <Text className="text-danger">*</Text>
            </Text>
            <View className="w-full flex-row items-center relative">
              <Input
                placeholder="Enter your email"
                placeholderTextColor="rgb(107, 114, 128, 0.5)"
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
                placeholderTextColor="rgb(107, 114, 128, 0.5)"
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
              <Spinner color="white" size="sm" />
            ) : (
              <Button.Label>Sign In</Button.Label>
            )}
          </Button>
        </View>
      </View>
    </View>
  );
}
