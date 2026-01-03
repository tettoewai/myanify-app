import { Text, View } from "react-native";

export default function Search() {
  return (
    <View className="flex-1 justify-center items-center bg-background">
      <Text className="font-bold text-primary text-xl">Search</Text>
      <Text className="text-muted-foreground mb-4">Find your favorite music</Text>
    </View>
  );
}
