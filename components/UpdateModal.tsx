import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACCENT = "#d4a574";

export type UpdateKind = "apk" | "ota";

interface UpdateModalProps {
  visible: boolean;
  kind: UpdateKind;
  version?: string;
  notes?: string;
  mandatory?: boolean;
  isDownloading?: boolean;
  error?: string | null;
  onInstall: () => void;
  onLater?: () => void;
  onDismissError?: () => void;
}

export function UpdateModal({
  visible,
  kind,
  version,
  notes,
  mandatory = false,
  isDownloading = false,
  error,
  onInstall,
  onLater,
  onDismissError,
}: UpdateModalProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const title =
    kind === "apk"
      ? `Update available (v${version ?? ""})`
      : "Update available";

  const primaryLabel = isDownloading
    ? "Preparing update..."
    : kind === "apk"
      ? "Download & install"
      : "Update now";

  const handleRequestClose = () => {
    if (mandatory) return;
    onLater?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleRequestClose}
    >
      <Pressable
        className="flex-1 bg-black/50"
        onPress={mandatory ? undefined : onLater}
      >
        <View className="flex-1" />
      </Pressable>
      <View
        className="bg-background rounded-t-2xl px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="w-10 h-1 bg-muted rounded-full self-center mb-4" />

        <View className="flex-row items-center gap-3 px-2 mb-2">
          <Ionicons name="cloud-download-outline" size={24} color={ACCENT} />
          <Text className="text-lg font-semibold text-foreground leading-loose flex-1">
            {title}
          </Text>
        </View>

        {notes ? (
          <Text
            className="text-sm text-muted-foreground mb-4 px-2 leading-loose"
            numberOfLines={6}
          >
            {notes}
          </Text>
        ) : (
          <Text className="text-sm text-muted-foreground mb-4 px-2 leading-loose">
            A new version is available. Update to get the latest features and
            fixes.
          </Text>
        )}

        {mandatory ? (
          <Text className="text-xs text-primary px-2 mb-3 leading-loose">
            This update is required to continue.
          </Text>
        ) : null}

        {error ? (
          <View className="flex-row items-start gap-2 bg-destructive/10 rounded-lg px-3 py-2.5 mb-3">
            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" style={{ marginTop: 2 }} />
            <Text className="flex-1 text-xs text-destructive leading-relaxed">{error}</Text>
            {onDismissError ? (
              <Pressable onPress={onDismissError} className="p-1 -mr-1">
                <Ionicons name="close" size={16} color="#ef4444" />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          disabled={isDownloading}
          className="flex-row items-center justify-center gap-2 bg-primary rounded-lg py-3.5 px-4 mt-1"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onInstall();
          }}
        >
          {isDownloading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Ionicons name="download-outline" size={20} color="#000" />
          )}
          <Text className="text-primary-foreground font-semibold text-sm">
            {primaryLabel}
          </Text>
        </TouchableOpacity>

        {!mandatory ? (
          <TouchableOpacity
            className="py-3.5 px-2 mt-2"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onLater?.();
            }}
          >
            <Text className="text-center text-muted-foreground">Later</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Modal>
  );
}
