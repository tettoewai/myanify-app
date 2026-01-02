import { Ionicons } from "@expo/vector-icons";
import { Button, TextField } from "heroui-native";
import { useEffect, useState } from "react";
import { Text, View, Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";

WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID = "YOUR_ANDROID_CLIENT_ID"; // Replace with your Android client ID
const IOS_CLIENT_ID = "YOUR_IOS_CLIENT_ID"; // Replace with your iOS client ID

const redirectUri = makeRedirectUri({
  native: "myanify://oauthredirect", // Replace 'myanify' with your app's scheme
  useProxy: true,
});

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post("/auth/login", { email, password });
      if (!response.token) {
        throw new Error("Invalid response from server");
      }
      return response.token;
    },
    onSuccess: async (token) => {
      await signIn(token);
    },
    onError: (error: any) => {
      Alert.alert("Login Failed", error.message || "Something went wrong");
    },
  });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: ANDROID_CLIENT_ID, // Use Android client ID for both platforms in Expo Go
      iosClientId: IOS_CLIENT_ID,
      androidClientId: ANDROID_CLIENT_ID,
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
        // Here you would send the accessToken to your backend for verification and session creation
        // For now, let's just log it and simulate a successful login
        console.log("Google Access Token:", authentication.accessToken);
        Alert.alert(
          "Google Login Success",
          "Token: " + authentication.accessToken
        );
        // You'll need to replace this with an actual backend call to exchange the Google token for your app's session token
        // For demonstration, we'll just sign in with a dummy token
        signIn("dummy-google-token");
      }
    }
  }, [response]);

  const handleGoogleLogin = () => {
    promptAsync();
  };

  const isInvalidEmail =
    email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = () => {
    if (!email || !password || isInvalidEmail) {
      Alert.alert("Error", "Please enter a valid email and password");
      return;
    }
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
            isDisabled={!request}
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
