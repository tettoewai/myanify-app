import { StyledImage as Image } from "@/components/styled";
import { usePlayer } from "@/context/PlayerContext";
import { getSongCoverUrl } from "@/lib/song-cover";
import type { QueueItem } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function getArtistName(song: QueueItem["song"]) {
  if (song.artist) return song.artist;
  if (song.artists?.length) {
    return song.artists.map((a) => a.artist.name).join(", ");
  }
  return "Unknown Artist";
}

interface UpNextSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function UpNextSheet({ visible, onClose }: UpNextSheetProps) {
  const insets = useSafeAreaInsets();
  const {
    currentSong,
    upNext,
    radioMode,
    setRadioMode,
    isFetchingRadio,
    removeFromQueue,
    clearQueue,
  } = usePlayer();

  const userItems = upNext.filter(
    (i) => i.source !== "radio" && i.source !== "autoplay",
  );
  const suggestedItems = upNext.filter(
    (i) => i.source === "radio" || i.source === "autoplay",
  );

  const renderItem = (item: QueueItem, canRemove: boolean) => (
    <View key={item.qid} className="flex-row items-center gap-3 py-2.5 px-2">
      <View className="w-12 h-12 rounded-lg overflow-hidden">
        <Image
          uri={getSongCoverUrl(item.song)}
          variant="album"
          className="w-full h-full"
          contentFit="cover"
        />
      </View>
      <View className="flex-1 min-w-0">
        <Text
          className="text-foreground font-medium leading-loose"
          numberOfLines={1}
        >
          {item.song.title}
        </Text>
        <Text
          className="text-muted-foreground text-sm leading-loose"
          numberOfLines={1}
        >
          {getArtistName(item.song)}
          {(item.source === "radio" || item.source === "autoplay") && (
            <Text className="text-primary"> · Suggested</Text>
          )}
        </Text>
      </View>
      {canRemove && (
        <TouchableOpacity onPress={() => removeFromQueue(item.qid)} hitSlop={8}>
          <Ionicons name="close-circle-outline" size={22} color="#888" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-red/50" onPress={onClose}>
        <View className="flex-1" />
      </Pressable>
      <View
        className="bg-background rounded-t-2xl max-h-[80%]"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        <View className="w-10 h-1 bg-muted rounded-full self-center mt-3 mb-2" />
        <View className="flex-row items-center justify-between px-4 py-2">
          <View className="flex-row items-center gap-2">
            <Ionicons name="list" size={22} color="#d4a574" />
            <Text className="text-xl font-bold text-foreground">Up Next</Text>
          </View>
          <TouchableOpacity
            onPress={() => clearQueue()}
            disabled={upNext.length === 0}
          >
            <Text className="text-sm text-muted-foreground">Clear</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center justify-between px-4 py-2 border-b border-border/50">
          <View className="flex-row items-center gap-2">
            <Ionicons name="radio" size={18} color="#d4a574" />
            <Text className="text-foreground">Smart Radio</Text>
          </View>
          <Switch value={radioMode} onValueChange={setRadioMode} />
        </View>
        {radioMode && isFetchingRadio && (
          <Text className="text-xs text-muted-foreground px-4 pb-2">
            Loading suggestions…
          </Text>
        )}

        <ScrollView className="px-2 max-h-96">
          {currentSong && (
            <View className="px-2 py-2">
              <Text className="text-xs uppercase text-muted-foreground mb-2">
                Now Playing
              </Text>
              <View className="flex-row items-center gap-3 p-2 rounded-xl bg-primary/15">
                <View className="w-12 h-12 rounded-lg overflow-hidden">
                  <Image
                    uri={getSongCoverUrl(currentSong)}
                    variant="album"
                    className="w-full h-full"
                    contentFit="cover"
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="font-medium text-foreground leading-loose"
                    numberOfLines={1}
                  >
                    {currentSong.title}
                  </Text>
                  <Text
                    className="text-sm text-muted-foreground leading-loose"
                    numberOfLines={1}
                  >
                    {getArtistName(currentSong)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {userItems.length > 0 && (
            <View className="px-2 py-2">
              <Text className="text-xs uppercase text-muted-foreground mb-1">
                Your Queue
              </Text>
              {userItems.map((item) => renderItem(item, true))}
            </View>
          )}

          {suggestedItems.length > 0 && (
            <View className="px-2 py-2">
              <Text className="text-xs uppercase text-muted-foreground mb-1">
                Suggested
              </Text>
              {suggestedItems.map((item) => renderItem(item, true))}
            </View>
          )}

          {upNext.length === 0 && (
            <Text className="text-center text-muted-foreground py-8">
              {currentSong
                ? radioMode
                  ? isFetchingRadio
                    ? "Finding similar songs for Smart Radio…"
                    : "Smart Radio is on. Similar songs will play next."
                  : "Nothing queued. Turn on Smart Radio for endless playback."
                : "Queue is empty."}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
