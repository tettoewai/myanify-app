import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { authStorage } from "@/lib/auth-storage";
import { useRouter, useSegments } from "expo-router";

interface AuthContextType {
  token: string | null;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";

    if (!token && inTabsGroup) {
      // Redirect to landing page if not signed in and trying to access protected routes
      router.replace("/");
    } else if (token && inAuthGroup) {
      // Redirect to home if signed in and trying to access auth routes
      router.replace("/(tabs)/home");
    }
  }, [token, segments, isLoading]);

  async function loadToken() {
    try {
      const storedToken = await authStorage.getToken();
      setToken(storedToken);
    } catch (e) {
      console.error("Failed to load token", e);
    } finally {
      setIsLoading(false);
    }
  }

  const signIn = async (newToken: string) => {
    await authStorage.setToken(newToken);
    setToken(newToken);
  };

  const signOut = async () => {
    await authStorage.removeToken();
    setToken(null);
    router.replace("/");
  };

  return (
    <AuthContext.Provider value={{ token, isLoading, signIn, signOut }}>
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
