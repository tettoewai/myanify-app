import React from "react";
import { StyledSafeAreaView as SafeAreaView } from "@/components/styled";
import { FullPlayer } from "@/components/player/FullPlayer";

export default function PlayerPage() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <FullPlayer />
    </SafeAreaView>
  );
}
