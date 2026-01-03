import { Ionicons } from "@expo/vector-icons";
import { Button, TextField, useToast, Toast } from "heroui-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";
import Constants from "expo-constants";

WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID = Constants.expoConfig?.extra?.google?.androidClientId;
const IOS_CLIENT_ID = Constants.expoConfig?.extra?.google?.iosClientId;

const redirectUri = makeRedirectUri({
  native: "myanify://oauthredirect", // Replace 'myanify' with your app's scheme
});

export default function Login() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
      const errorMessage = error.message || "Something went wrong";
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
    mutationFn: async (googleAccessToken: string) => {
      const response = await apiClient.post("/auth/google-login", {
        googleAccessToken,
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

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: Platform.select({
        ios: IOS_CLIENT_ID,
        android: ANDROID_CLIENT_ID,
        web: ANDROID_CLIENT_ID, // Use Android client ID for web as well
      }),
      redirectUri,
      scopes: ["profile", "email"],
    },
    {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      revocationEndpoint: "https://oauth2.googleapis.com/revoke",
    }
  );

  useEffect(() => {
    if (response?.type === "success") {
      const { authentication } = response;
      if (authentication?.accessToken) {
        googleLoginMutation.mutate(authentication.accessToken);
      }
    }
  }, [response]);

  const handleGoogleLogin = () => {
    promptAsync();
  };

  const isInvalidEmail =
    email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
            pressableFeedbackVariant="ripple"
            className="w-full rounded-sm"
            size="sm"
            onPress={handleGoogleLogin}
            isDisabled={!request || googleLoginMutation.isPending}
          >
            <Ionicons
              name="logo-google"
              size={18}
              color="white"
              style={{ marginRight: 8 }}
            />
            <Button.Label>Continue with Google</Button.Label>
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
        <View className="gap-2 mt-2">
          <TextField isRequired isInvalid={isInvalidEmail}>
            <TextField.Label>Email Address</TextField.Label>
            <TextField.Input
              placeholder="Enter your email"
              placeholderTextColor="rgb(107, 114, 128, 0.5)"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              className="rounded-sm"
              editable={!loginMutation.isPending}
            >
              <TextField.InputStartContent>
                <Ionicons
                  name="mail-outline"
                  size={16}
                  className="text-muted-foreground"
                />
              </TextField.InputStartContent>
            </TextField.Input>
            <TextField.ErrorMessage>
              Please enter a valid email address
            </TextField.ErrorMessage>
          </TextField>

          <TextField isRequired>
            <TextField.Label>Password</TextField.Label>
            <TextField.Input
              placeholder="Enter password"
              placeholderTextColor="rgb(107, 114, 128, 0.5)"
              secureTextEntry
              className="rounded-sm"
              value={password}
              onChangeText={setPassword}
              editable={!loginMutation.isPending}
            >
              <TextField.InputStartContent>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  className="text-muted-foreground"
                />
              </TextField.InputStartContent>
              <TextField.InputEndContent>
                <Ionicons
                  name="eye-outline"
                  size={16}
                  className="text-muted-foreground"
                />
              </TextField.InputEndContent>
            </TextField.Input>
          </TextField>

          <Button
            pressableFeedbackVariant="ripple"
            className="mt-4 rounded-sm w-full bg-primary"
            onPress={handleLogin}
            isDisabled={loginMutation.isPending}
          >
            <Button.Label className="text-primary-foreground">
              Sign In
            </Button.Label>
          </Button>
        </View>
      </View>
    </View>
  );
}
