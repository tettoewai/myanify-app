import { usePlayer } from "@/context/PlayerContext";
import { useSongDownload } from "@/hooks/useSongDownload";
import { showDownloadCompleteToast } from "@/lib/download-toast";
import { shareEntity } from "@/lib/share";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useToast } from "heroui-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SLEEP_PRESETS = [5, 10, 15, 30, 45, 60];

function formatRemaining(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins <= 0) return `${secs}s left`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s left`;
}

interface MoreOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function MoreOptionsSheet({ visible, onClose }: MoreOptionsSheetProps) {
  const insets = useSafeAreaInsets();
  const { currentSong, sleepTimerRemaining, setSleepTimer } = usePlayer();
  const { state, isDownloaded, download, remove } = useSongDownload(
    currentSong?.id ?? "",
    currentSong?.audioUrl || currentSong?.playbackUrl || "",
  );
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const prevDownloadStatus = useRef(state.status);

  useEffect(() => {
    const prev = prevDownloadStatus.current;
    prevDownloadStatus.current = state.status;
    if (
      prev === "downloading" &&
      state.status === "completed" &&
      currentSong
    ) {
      showDownloadCompleteToast(toast, router, {
        label: "Song downloaded",
        description: currentSong.title,
      });
    }
  }, [state.status, currentSong, toast, router]);

  if (!currentSong) return null;

  const sleepActive = sleepTimerRemaining > 0;
  const isDownloading = state.status === "downloading";
  const isFailed = state.status === "failed";
  const notAllowed = state.status === "not-allowed";

  const downloadLabel = isDownloaded
    ? "Downloaded"
    : isDownloading
      ? `Downloading ${state.progress}%`
      : isFailed
        ? `Failed: ${state.error || "Tap to retry"}`
        : notAllowed
          ? state.error || "VIP required"
          : "Download";
  const downloadIcon = isDownloaded
    ? ("checkmark-circle" as const)
    : isDownloading
      ? ("cloud-download" as const)
      : isFailed
        ? ("alert-circle" as const)
        : notAllowed
          ? ("lock-closed" as const)
          : ("cloud-download-outline" as const);
  const downloadDisabled =
    removing || isDownloading || notAllowed || state.status === "completed";

  const handleDownloadPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isDownloaded) {
      void (async () => {
        setRemoving(true);
        await remove();
        setRemoving(false);
      })();
      onClose();
    } else if (!downloadDisabled) {
      void download();
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/50" onPress={onClose}>
        <View className="flex-1" />
      </Pressable>
      <View
        className="bg-background rounded-t-2xl px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="w-10 h-1 bg-muted rounded-full self-center mb-4" />
        <Text
          className="text-lg font-semibold text-foreground mb-1 px-2 leading-loose"
          numberOfLines={1}
        >
          {currentSong.title}
        </Text>
        <Text
          className="text-sm text-muted-foreground mb-2 px-2 leading-loose"
          numberOfLines={1}
        >
          {currentSong.artist ||
            currentSong.artists?.map((a) => a.artist.name).join(", ")}
        </Text>

        {/* Sleep timer */}
        <View className="flex-row items-center gap-4 py-3.5 px-2">
          <Ionicons name="timer-outline" size={22} color="#d4a574" />
          <Text className="text-base text-foreground flex-1">Sleep timer</Text>
          <Text className="text-sm text-muted-foreground">
            {sleepActive ? formatRemaining(sleepTimerRemaining) : "Off"}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2 px-2 pb-2">
          {SLEEP_PRESETS.map((minutes) => {
            const active =
              sleepActive &&
              Math.ceil(sleepTimerRemaining / 60) === minutes;
            return (
              <TouchableOpacity
                key={minutes}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSleepTimer(minutes);
                  onClose();
                }}
                className={`px-3.5 py-2 rounded-full border ${
                  active ? "bg-primary border-primary" : "border-border"
                }`}
              >
                <Text
                  className={`text-sm ${
                    active ? "text-white font-semibold" : "text-foreground"
                  }`}
                >
                  {minutes}m
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSleepTimer(null);
              onClose();
            }}
            className={`px-3.5 py-2 rounded-full border ${
              !sleepActive ? "bg-primary border-primary" : "border-border"
            }`}
          >
            <Text
              className={`text-sm ${
                !sleepActive ? "text-white font-semibold" : "text-foreground"
              }`}
            >
              Off
            </Text>
          </TouchableOpacity>
        </View>

        <View className="h-px bg-border/50 my-2" />

        {/* Share */}
        <TouchableOpacity
          className="flex-row items-center gap-4 py-3.5 px-2"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            void shareEntity("song", currentSong, {
              title: currentSong.title,
            });
            onClose();
          }}
        >
          <Ionicons name="share-social-outline" size={22} color="#d4a574" />
          <Text className="text-base text-foreground">Share</Text>
        </TouchableOpacity>

        {/* Download */}
        <TouchableOpacity
          className={`flex-row items-center gap-4 py-3.5 px-2 ${
            downloadDisabled && !isDownloaded ? "opacity-50" : ""
          }`}
          onPress={handleDownloadPress}
          disabled={downloadDisabled && !isDownloaded}
        >
          {isDownloading || removing ? (
            <ActivityIndicator size="small" color="#d4a574" />
          ) : (
            <Ionicons name={downloadIcon} size={22} color="#d4a574" />
          )}
          <Text className="text-base text-foreground flex-1">
            {downloadLabel}
          </Text>
          {isDownloaded && (
            <Text className="text-sm text-muted-foreground">Remove</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="py-3.5 px-2 mt-2 border-t border-border"
          onPress={onClose}
        >
          <Text className="text-center text-muted-foreground">Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
