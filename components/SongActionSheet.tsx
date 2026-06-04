import { usePlayer } from "@/context/PlayerContext";
import type { Song } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const {
    playSong,
    playNextInQueue,
    addToQueue,
    startRadio,
    isSongQueued,
  } = usePlayer();

  if (!song) return null;

  const queued = isSongQueued(song.id);

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
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={onClose}>
        <View className="flex-1" />
      </Pressable>
      <View
        className="bg-background rounded-t-2xl px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="w-10 h-1 bg-muted rounded-full self-center mb-4" />
        <Text className="text-lg font-semibold text-foreground mb-1 px-2">
          {song.title}
        </Text>
        <Text className="text-sm text-muted-foreground mb-4 px-2" numberOfLines={1}>
          {song.artist ||
            song.artists?.map((a) => a.artist.name).join(", ")}
        </Text>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            className="flex-row items-center gap-4 py-3.5 px-2"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              action.onPress();
            }}
          >
            <Ionicons name={action.icon} size={22} color="#d4a574" />
            <Text className="text-base text-foreground">{action.label}</Text>
          </TouchableOpacity>
        ))}
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
