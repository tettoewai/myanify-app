import { Text, View } from "react-native";

export default function Library() {
  return (
    <View className="flex-1 justify-center items-center bg-background">
      <Text className="font-bold text-primary text-xl">Library</Text>
      <Text className="text-muted-foreground mb-4">Your collection</Text>
    </View>
  );
}
