import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

export const DISCLAIMER_NOTICE_TEXT =
  "Non-commercial project. Myanify is an independent, non-commercial project built solely for learning and portfolio purposes. It is completely free to use and not officially affiliated with any artists or record labels.";

interface DisclaimerNoticeProps {
  className?: string;
}

/**
 * High-visibility non-commercial disclaimer notice.
 * Amber border + tinted background + bold lead so it reads instantly,
 * while staying compact enough not to disrupt the listening experience.
 */
export function DisclaimerNotice({ className }: DisclaimerNoticeProps) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Non-commercial disclaimer"
      className={`flex-row items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 ${className ?? ""}`}
    >
      <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
        <Ionicons name="information-circle" size={18} color="#f59e0b" />
      </View>
      <Text className="flex-1 text-[13px] leading-5 text-muted-foreground">
        <Text className="font-semibold text-foreground">
          Non-commercial project.{" "}
        </Text>
        Myanify is an independent, non-commercial project built solely for
        learning and portfolio purposes. It is completely free to use and not
        officially affiliated with any artists or record labels.
      </Text>
    </View>
  );
}
