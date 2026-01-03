import { Text, View } from "react-native";

export default function Home() {
  return (
    <View className="flex-1 justify-center items-center bg-background">
      <Text className="font-bold text-primary text-xl">Home page</Text>
      <Text className="text-muted-foreground mb-4">Welcome back!</Text>
      <View className="gap-2 flex flex-row"></View>
    </View>
  );
}
