import { LoadingView } from "@/components/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";
import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { SignInPrompt } from "./SignInPrompt";

interface RequireAuthProps {
  children: ReactNode;
  /** When true, show inline sign-in UI instead of redirecting to landing. */
  inline?: boolean;
}

export function RequireAuth({ children, inline = false }: RequireAuthProps) {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingView />;
  }

  if (!token) {
    if (inline) {
      return <SignInPrompt />;
    }
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}
