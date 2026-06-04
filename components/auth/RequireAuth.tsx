import { useAuth } from "@/context/AuthContext";
import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { SignInPrompt } from "./SignInPrompt";

interface RequireAuthProps {
  children: ReactNode;
  /** When true, show inline sign-in UI instead of redirecting to landing. */
  inline?: boolean;
}

export function RequireAuth({ children, inline = false }: RequireAuthProps) {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#ff0000" />
      </View>
    );
  }

  if (!token) {
    if (inline) {
      return <SignInPrompt />;
    }
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}
