import { HeroUINativeConfig, HeroUINativeProvider } from "heroui-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";
import { AuthProvider } from "@/context/AuthContext";

const config: HeroUINativeConfig = {
  // Full type safety and autocomplete
  textProps: {
    allowFontScaling: true,
    maxFontSizeMultiplier: 1.5,
  },
  toast: {
    defaultProps: {
      variant: "default",
      placement: "top",
    },
    insets: {
      top: 0,
      bottom: 6,
      left: 12,
      right: 12,
    },
  },
};

export default function Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    Uniwind.setTheme("dark");
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView className="flex-1">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <HeroUINativeProvider config={config}>
              <View className="flex-1 bg-background">{children}</View>
            </HeroUINativeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
