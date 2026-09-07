import { StyledSafeAreaView as SafeAreaView } from "@/components/styled";
import { usePlayer } from "@/context/PlayerContext";
import { useAnnouncements, type MobileAnnouncement } from "@/hooks/useAnnouncements";
import { fetchAvailableApkUpdate } from "@/lib/mobile-update";
import { getVersionLabel } from "@/lib/app-version";
import { AppColors } from "@/lib/colors";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function AnnouncementCard({ item }: { item: MobileAnnouncement }) {
  const openLink = () => {
    if (!item.linkUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.linkUrl.startsWith("http")) {
      Linking.openURL(item.linkUrl).catch(() => {});
    }
  };
  return (
    <TouchableOpacity
      onPress={openLink}
      disabled={!item.linkUrl}
      activeOpacity={0.7}
      className="bg-card border border-border rounded-2xl p-4 gap-2"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="text-foreground font-semibold text-base flex-1">
          {item.title}
        </Text>
        {!item.read && (
          <View className="bg-primary rounded-full px-2 py-0.5">
            <Text className="text-primary-foreground text-[11px] font-bold">
              New
            </Text>
          </View>
        )}
      </View>
      <Text className="text-muted-foreground text-sm leading-relaxed">
        {item.body}
      </Text>
      <Text className="text-muted-foreground text-xs">
        {new Date(item.startsAt).toLocaleDateString()}
        {item.linkUrl ? "  ·  Tap to open" : ""}
      </Text>
    </TouchableOpacity>
  );
}

export default function Announcements() {
  const router = useRouter();
  const { currentSong } = usePlayer();
  const [refreshing, setRefreshing] = useState(false);
  const { announcements, isLoading, isError, refetch } = useAnnouncements(30);
  const { data: apkUpdate } = useQuery({
    queryKey: ["apk-update-manifest"],
    queryFn: fetchAvailableApkUpdate,
    staleTime: 10 * 60 * 1000,
  });
  const latestNotes =
    apkUpdate?.status === "ok" && apkUpdate.update.available
      ? apkUpdate.update.notes
      : null;
  const latestVersion =
    apkUpdate?.status === "ok" && apkUpdate.update.available
      ? apkUpdate.update.version
      : null;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: currentSong ? 96 : 24 }}
      >
        <View className="px-4 pt-4 pb-8 gap-4">
          <View className="flex-row items-center gap-3 mb-2">
            <TouchableOpacity
              onPress={() => router.back()}
              className="p-2 -ml-2"
              accessibilityLabel="Go back"
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={AppColors.foreground}
              />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">
                What&apos;s New
              </Text>
              <Text className="text-muted-foreground mt-0.5 text-sm">
                Announcements and app updates
              </Text>
            </View>
          </View>

          {isLoading ? (
            <View className="gap-3">
              {[1, 2].map((i) => (
                <View
                  key={i}
                  className="bg-card border border-border rounded-2xl p-4 gap-2"
                >
                  <View className="h-5 w-2/3 bg-muted rounded-lg" />
                  <View className="h-4 w-full bg-muted rounded-lg" />
                  <View className="h-4 w-5/6 bg-muted rounded-lg" />
                </View>
              ))}
            </View>
          ) : isError ? (
            <View className="items-center py-12 gap-2">
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={AppColors.mutedForeground}
              />
              <Text className="text-foreground font-semibold">
                Couldn&apos;t load updates
              </Text>
              <TouchableOpacity
                onPress={() => refetch()}
                className="mt-2 px-6 py-3 bg-primary rounded-lg"
              >
                <Text className="text-primary-foreground font-semibold">
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          ) : announcements.length === 0 && !latestNotes ? (
            <View className="items-center py-12 gap-2">
              <Ionicons
                name="notifications-outline"
                size={48}
                color={AppColors.mutedForeground}
              />
              <Text className="text-foreground font-semibold">
                You&apos;re all caught up
              </Text>
              <Text className="text-muted-foreground text-sm">
                New announcements will appear here.
              </Text>
            </View>
          ) : (
            <>
              {announcements.map((a) => (
                <AnnouncementCard key={a.id} item={a} />
              ))}
            </>
          )}

          {/* App changelog — release notes already fetched for updates */}
          <View className="bg-card border border-border rounded-2xl p-4 gap-1.5 mt-1">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={AppColors.primary}
              />
              <Text className="text-foreground font-semibold">
                App version
              </Text>
            </View>
            <Text className="text-muted-foreground text-sm">
              Installed: {getVersionLabel()}
              {latestVersion ? `  ·  Latest: v${latestVersion}` : ""}
            </Text>
            {latestNotes ? (
              <Text className="text-muted-foreground text-sm leading-relaxed">
                {latestNotes}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
