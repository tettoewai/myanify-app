import { Text, View } from "react-native";

export default function Setting() {
  return (
    <View className="flex-1 justify-center items-center bg-background">
      <Text className="font-bold text-primary text-xl">Setting</Text>
      <Text className="text-muted-foreground mb-4">
        Manage your account settings and preferences
      </Text>
    </View>
  );
}
