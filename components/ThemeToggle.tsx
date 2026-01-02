import { Button } from "heroui-native";
import { Uniwind, useUniwind } from "uniwind";

export default function ThemeToggle() {
  const { theme } = useUniwind();

  return (
    <Button
      onPress={() => Uniwind.setTheme(theme === "light" ? "dark" : "light")}
    >
      <Button.Label>
        Toggle {theme === "light" ? "Dark" : "Light"} Mode
      </Button.Label>
    </Button>
  );
}
