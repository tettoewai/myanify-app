import { Link } from "expo-router";
import { Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

interface SignInPromptProps {
  title?: string;
  description?: string;
  compact?: boolean;
}

export function SignInPrompt({
  title = "Sign in to continue",
  description = "Create an account or sign in to browse music, save favorites, and sync your library.",
  compact = false,
}: SignInPromptProps) {
  return (
    <View
      className={`flex-1 items-center justify-center px-8 ${compact ? "py-12" : "py-16"}`}
    >
      <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-6">
        <Ionicons name="musical-notes" size={36} color="#ff0000" />
      </View>
      <Text className="text-foreground text-xl font-bold text-center mb-3">
        {title}
      </Text>
      <Text className="text-muted-foreground text-center text-base leading-relaxed mb-8">
        {description}
      </Text>
      <Link href="/(auth)/login" asChild>
        <Button variant="primary" size="lg" className="w-full max-w-xs rounded-sm">
          <Ionicons name="log-in-outline" size={20} color="white" />
          <Button.Label className="font-bold ml-2">Sign In</Button.Label>
        </Button>
      </Link>
      <Link href="/" asChild>
        <Button variant="ghost" size="md" className="mt-4">
          <Button.Label className="text-muted-foreground">Back to home</Button.Label>
        </Button>
      </Link>
    </View>
  );
}
