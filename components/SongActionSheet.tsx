import { usePlayer } from "@/context/PlayerContext";
import { shareEntity } from "@/lib/share";
import { showDownloadCompleteToast } from "@/lib/download-toast";
import type { Song } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View, ActivityIndicator, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSongDownload } from "@/hooks/useSongDownload";
import { useToast } from "heroui-native";

interface SongActionSheetProps {
  song: Song | null;
  visible: boolean;
  onClose: () => void;
}

export function SongActionSheet({
  song,
  visible,
  onClose,
}: SongActionSheetProps) {
  const insets = useSafeAreaInsets();
  const { playSong, playNextInQueue, addToQueue, startRadio, isSongQueued } =
    usePlayer();
  const { toast } = useToast();
  const router = useRouter();
  const { state, isDownloaded, download, remove } = useSongDownload(
    song?.id ?? "",
    song?.audioUrl || song?.playbackUrl || "",
  );
  const [removing, setRemoving] = useState(false);
  const prevDownloadStatus = useRef(state.status);

  useEffect(() => {
    const prev = prevDownloadStatus.current;
    prevDownloadStatus.current = state.status;
    if (prev === "downloading" && state.status === "completed" && song) {
      showDownloadCompleteToast(toast, router, {
        label: "Song downloaded",
        description: song.title,
      });
    }
  }, [state.status, song, toast, router]);

  if (!song) return null;

  const queued = isSongQueued(song.id);

  const isDownloading = state.status === "downloading";
  const isFailed = state.status === "failed";
  const notAllowed = state.status === "not-allowed";

  const actions = [
    {
      label: "Play Now",
      icon: "play" as const,
      onPress: () => {
        void playSong(song);
        onClose();
      },
    },
    {
      label: "Play Next",
      icon: "play-forward" as const,
      onPress: () => {
        playNextInQueue(song);
        onClose();
      },
    },
    {
      label: queued ? "In Queue" : "Add to Queue",
      icon: "list" as const,
      onPress: () => {
        if (!queued) addToQueue(song);
        onClose();
      },
    },
    {
      label: "Play Similar Radio",
      icon: "radio" as const,
      onPress: () => {
        startRadio(song);
        onClose();
      },
    },
    {
      label: "Share",
      icon: "share-social-outline" as const,
      onPress: () => {
        void shareEntity("song", song, { title: song.title });
        onClose();
      },
    },
    {
      label: isDownloaded
        ? "Downloaded ✓"
        : isDownloading
        ? `Downloading ${state.progress}%`
        : isFailed
        ? `Failed: ${state.error || "Retry"}`
        : notAllowed
        ? state.error || "VIP required"
        : "Download",
      icon: isDownloaded
        ? ("checkmark-circle" as const)
        : isDownloading
        ? ("cloud-download" as const)
        : isFailed
        ? ("alert-circle" as const)
        : notAllowed
        ? ("lock-closed" as const)
        : ("cloud-download-outline" as const),
      onPress: isDownloaded
        ? async () => {
            setRemoving(true);
            await remove();
            setRemoving(false);
            onClose();
          }
        : isDownloading || notAllowed
        ? undefined
        : isFailed
        ? () => {
            void download();
          }
        : () => {
            void download();
          },
    },
  ];

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
        <Text className="text-lg font-semibold text-foreground mb-1 px-2 leading-loose">
          {song.title}
        </Text>
        <Text
          className="text-sm text-muted-foreground mb-4 px-2 leading-loose"
          numberOfLines={1}
        >
          {song.artist || song.artists?.map((a) => a.artist.name).join(", ")}
        </Text>
        {actions.map((action) => {
          const disabled = !action.onPress || removing;
          const isDownloadAction = action.label.startsWith("Download") || 
            action.label.startsWith("Downloading") || 
            action.label.startsWith("Downloaded") ||
            action.label.startsWith("Failed");
          return (
            <TouchableOpacity
              key={action.label}
              className={`flex-row items-center gap-4 py-3.5 px-2 ${disabled ? "opacity-50" : ""}`}
              onPress={() => {
                if (!disabled) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  action.onPress?.();
                }
              }}
              disabled={disabled}
            >
              {isDownloadAction && isDownloading ? (
                <ActivityIndicator size="small" color="#d4a574" />
              ) : (
                <Ionicons name={action.icon} size={22} color="#d4a574" />
              )}
              <Text className="text-base text-foreground">{action.label}</Text>
            </TouchableOpacity>
          );
        })}
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
