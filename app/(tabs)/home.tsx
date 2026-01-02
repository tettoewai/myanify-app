import { Button } from "heroui-native";
import { Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { signOut } = useAuth();

  return (
    <View className="flex-1 justify-center items-center bg-background">
      <Text className="font-bold text-primary text-xl">Home page</Text>
      <Text className="text-muted-foreground mb-4">Welcome back!</Text>
      <Button onPress={signOut} className="bg-danger rounded-sm">
        <Button.Label className="text-danger-foreground">Logout</Button.Label>
      </Button>
    </View>
  );
}
