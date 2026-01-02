import Provider from "@/components/Providers";
import { Stack } from "expo-router";
import { useUniwind } from "uniwind";

function AppStack() {
  return (
    <Stack
      screenOptions={{
        contentStyle: {
          backgroundColor: "transparent",
        },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <Provider>
      <AppStack />
    </Provider>
  );
}
