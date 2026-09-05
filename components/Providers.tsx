import { HeroUINativeConfig, HeroUINativeProvider } from "heroui-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useCallback, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/context/AuthContext";
import { PlayerProvider } from "@/context/PlayerContext";
import * as SplashScreen from "expo-splash-screen";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const config: HeroUINativeConfig = {
  // Full type safety and autocomplete
  textProps: {
    allowFontScaling: true,
    maxFontSizeMultiplier: 1.5,
  },
  devInfo: {
    stylingPrinciples: false
  },
  toast: {
    defaultProps: {
      variant: "default",
      placement: "top",
    },
    insets: {
      top: 20,
      bottom: 20,
      left: 20,
      right: 20,
    },
  },
};

export default function Provider({ children }: { children: ReactNode }) {
  // Default staleTime prevents refetch storms on every tab switch / remount.
  // Individual hooks can override per-endpoint (e.g. longer for genres).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000,
            gcTime: 15 * 60 * 1000,
            retry: 1,
            refetchOnMount: true,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const [appIsReady, setAppIsReady] = useState(true);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Hide the splash screen once the app is ready
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView className="flex-1">
        <QueryClientProvider client={queryClient}>
          <HeroUINativeProvider config={config}>
            <AuthProvider>
              <PlayerProvider>
                <View className="flex-1 bg-background" onLayout={onLayoutRootView}>
                  {children}
                </View>
              </PlayerProvider>
            </AuthProvider>
          </HeroUINativeProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
