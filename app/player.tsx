import { RequireAuth } from "@/components/auth/RequireAuth";
import { FullPlayer } from "@/components/player/FullPlayer";
import { StyledSafeAreaView as SafeAreaView } from "@/components/styled";

export default function PlayerPage() {
  return (
    <RequireAuth>
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <FullPlayer />
      </SafeAreaView>
    </RequireAuth>
  );
}
