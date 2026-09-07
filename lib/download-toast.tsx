import { Ionicons } from "@expo/vector-icons";
import type { Router } from "expo-router";
import type { ToastManager } from "heroui-native";
import React from "react";

/**
 * Shared "download finished" toast with a View action that navigates to
 * the offline Downloads screen.
 */
export function showDownloadCompleteToast(
  toast: ToastManager,
  router: Router,
  opts: { label: string; description?: string } = {
    label: "Download complete",
  },
) {
  toast.show({
    label: opts.label,
    description: opts.description,
    variant: "success",
    icon: <Ionicons name="checkmark-circle" size={24} color="white" />,
    actionLabel: "View",
    onActionPress: ({ hide }) => {
      hide();
      router.push("/downloads");
    },
  });
}
