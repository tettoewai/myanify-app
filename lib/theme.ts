import * as SystemUI from "expo-system-ui";
import { Uniwind } from "uniwind";
import { AppColors } from "./colors";

/** Lock the app to dark mode before any UI renders. */
Uniwind.setTheme("dark");
void SystemUI.setBackgroundColorAsync(AppColors.background);
