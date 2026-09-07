import { authStorage } from "@/lib/auth-storage";
import {
  isProtectedRoute,
  notifyUnauthorized,
  setUnauthorizedHandler,
} from "@/lib/auth-session";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSegments } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface AuthContextType {
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();
  const queryClient = useQueryClient();

  const clearSession = useCallback(async () => {
    await authStorage.removeToken();
    // Wipe offline downloads + license on logout (dynamic import avoids
    // a hard dependency cycle with the download manager).
    try {
      const { clearAllOfflineData } = await import("@/lib/vip-offline");
      await clearAllOfflineData();
    } catch (error) {
      console.error("Failed to wipe offline data on logout:", error);
    }
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void (async () => {
        await clearSession();
        router.replace("/");
      })();
    });

    return () => setUnauthorizedHandler(null);
  }, [clearSession, router]);

  useEffect(() => {
    if (isLoading) return;

    const segmentList = segments as string[];
    const inAuthGroup = segmentList[0] === "(auth)";

    if (!token && isProtectedRoute(segmentList)) {
      router.replace("/");
      return;
    }

    if (token && inAuthGroup) {
      router.replace("/(tabs)/home");
    }
  }, [token, segments, isLoading, router]);

  async function loadToken() {
    try {
      const storedToken = await authStorage.getToken();
      setToken(storedToken);
    } catch (e) {
      console.error("Failed to load token", e);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }

  const signIn = async (newToken: string) => {
    await authStorage.setToken(newToken);
    setToken(newToken);
    // Best-effort device registration so first download doesn't fail with
    // "Valid VIP license required". Lazy ensure in initiateDownload covers
    // restarts; failures here must not block login.
    try {
      const { ensureDeviceRegistered } = await import("@/lib/vip-offline");
      await ensureDeviceRegistered();
    } catch (error) {
      console.error("Device registration on sign-in failed:", error);
    }
    router.replace("/(tabs)/home");
  };

  const signOut = async () => {
    await clearSession();
    router.replace("/");
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isLoading,
        isAuthenticated: !!token,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
