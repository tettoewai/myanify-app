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
export type DownloadStatus = "idle" | "downloading" | "complete" | "error";

interface DownloadProgress {
  totalBytes: number;
  writtenBytes: number;
  percent: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

interface UpdateModalProps {
  visible: boolean;
  kind: UpdateKind;
  version?: string;
  notes?: string;
  mandatory?: boolean;
  isDownloading?: boolean;
  downloadStatus?: DownloadStatus;
  downloadProgress?: DownloadProgress;
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
  downloadStatus = "idle",
  downloadProgress,
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

  const isActive = downloadStatus === "downloading" || isDownloading;
  const isComplete = downloadStatus === "complete";
  // expo-updates OTA downloads expose no byte progress — show indeterminate state.
  const isOtaActive = kind === "ota" && isActive;

  const primaryLabel = isComplete
    ? "Install update"
    : isOtaActive
      ? "Updating…"
      : isActive
        ? `${downloadProgress?.percent ?? 0}%`
        : kind === "apk"
          ? "Download & install"
          : "Update now";

  const handleRequestClose = () => {
    if (mandatory) return;
    onLater?.();
  };

  const showProgress =
    kind === "apk" && isActive && downloadProgress && downloadProgress.totalBytes > 0;
  const showOtaSpinner = isOtaActive;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleRequestClose}
    >
      <Pressable
        className="flex-1 bg-black/50"
        onPress={mandatory && !isActive ? undefined : onLater}
      >
        <View className="flex-1" />
      </Pressable>
      <View
        className="bg-background rounded-t-2xl px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="w-10 h-1 bg-muted rounded-full self-center mb-4" />

        <View className="flex-row items-center gap-3 px-2 mb-2">
          <Ionicons
            name={isComplete ? "checkmark-circle-outline" : "cloud-download-outline"}
            size={24}
            color={isComplete ? "#22c55e" : ACCENT}
          />
          <Text className="text-lg font-semibold text-foreground leading-loose flex-1">
            {isComplete ? "Download complete" : title}
          </Text>
        </View>

        {notes && !isActive && !isComplete ? (
          <Text
            className="text-sm text-muted-foreground mb-4 px-2 leading-loose"
            numberOfLines={6}
          >
            {notes}
          </Text>
        ) : (
          <Text className="text-sm text-muted-foreground mb-4 px-2 leading-loose">
            {isComplete
              ? "The update has been downloaded. Tap below to install."
              : isOtaActive
                ? "Downloading the update. The app will restart when ready."
                : isActive
                  ? "Downloading in the background. You can close this dialog and continue using the app."
                  : "A new version is available. Update to get the latest features and fixes."}
          </Text>
        )}

        {mandatory && !isActive && !isComplete ? (
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

        {showProgress ? (
          <View className="px-2 mb-3">
            <View className="h-2 bg-muted rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${downloadProgress!.percent}%`,
                  backgroundColor: ACCENT,
                }}
              />
            </View>
            <View className="flex-row justify-between mt-1.5">
              <Text className="text-xs text-muted-foreground">
                {formatBytes(downloadProgress!.writtenBytes)} / {formatBytes(downloadProgress!.totalBytes)}
              </Text>
              <Text className="text-xs text-muted-foreground font-medium">
                {downloadProgress!.percent}%
              </Text>
            </View>
          </View>
        ) : showOtaSpinner ? (
          <View className="px-2 mb-3">
            <View className="flex-row items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
              <ActivityIndicator size="small" color={ACCENT} />
              <Text className="text-xs text-muted-foreground">
                Downloading update… The app will restart when ready.
              </Text>
            </View>
          </View>
        ) : isComplete ? (
          <View className="px-2 mb-3">
            <View className="flex-row items-center gap-2 bg-green-500/10 rounded-lg px-3 py-2">
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text className="text-xs text-green-600 dark:text-green-400">
                {downloadProgress?.totalBytes
                  ? `${formatBytes(downloadProgress.totalBytes)} downloaded`
                  : "Download ready"}
              </Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          disabled={isActive}
          className={`flex-row items-center justify-center gap-2 rounded-lg py-3.5 px-4 mt-1 ${
            isComplete
              ? "bg-green-600"
              : "bg-primary"
          }`}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onInstall();
          }}
        >
          {isActive ? (
            <ActivityIndicator color="#000" />
          ) : isComplete ? (
            <Ionicons name="checkmark-outline" size={20} color="#000" />
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
            <Text className="text-center text-muted-foreground">
              {isActive ? "Continue in background" : "Later"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Modal>
  );
}
