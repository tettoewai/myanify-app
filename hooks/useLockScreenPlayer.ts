import { buildNotificationMetadata } from "@/lib/notification-metadata";
import type { Song } from "@/lib/types";
import type { AudioLockScreenOptions, AudioMetadata } from "expo-audio";
import { useEffect, useRef } from "react";
import { PermissionsAndroid, Platform } from "react-native";

type LockScreenOptions = AudioLockScreenOptions & {
  showNextTrack?: boolean;
  showPreviousTrack?: boolean;
};

const LOCK_SCREEN_OPTIONS: LockScreenOptions = {
  showSeekForward: true,
  showSeekBackward: true,
  showNextTrack: true,
  showPreviousTrack: true,
};

const LOCK_SCREEN_NEXT = "lockScreenNext";
const LOCK_SCREEN_PREVIOUS = "lockScreenPrevious";

async function ensureAndroidNotificationPermission(): Promise<void> {
  if (Platform.OS !== "android" || Platform.Version < 33) return;

  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  if (granted) return;

  await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
}

function safeClearLockScreen(player: LockScreenPlayer): void {
  try {
    player.clearLockScreenControls();
  } catch {
    // Native player may already be released during teardown.
  }
}

function safeUpdateLockScreen(
  player: LockScreenPlayer,
  metadata: AudioMetadata,
  isNewSong: boolean,
): void {
  try {
    if (isNewSong) {
      player.setActiveForLockScreen(
        true,
        metadata,
        LOCK_SCREEN_OPTIONS as AudioLockScreenOptions,
      );
    } else {
      player.updateLockScreenMetadata(metadata);
    }
  } catch (error) {
    console.error("Failed to update lock screen player:", error);
  }
}

interface LockScreenPlayer {
  setActiveForLockScreen: (
    active: boolean,
    metadata?: AudioMetadata,
    options?: AudioLockScreenOptions,
  ) => void;
  updateLockScreenMetadata: (metadata: AudioMetadata) => void;
  clearLockScreenControls: () => void;
  addListener?: (
    event: string,
    listener: () => void,
  ) => { remove: () => void };
}

interface UseLockScreenPlayerOptions {
  player: LockScreenPlayer | null;
  song: Song | null;
  isPlaying: boolean;
  onNext: () => void;
  onPrevious: () => void;
}

/**
 * Mirrors web `useMediaSession` for native lock-screen / notification controls.
 */
export function useLockScreenPlayer({
  player,
  song,
  isPlaying,
  onNext,
  onPrevious,
}: UseLockScreenPlayerOptions) {
  const activeSongIdRef = useRef<string | null>(null);
  const onNextRef = useRef(onNext);
  const onPreviousRef = useRef(onPrevious);

  onNextRef.current = onNext;
  onPreviousRef.current = onPrevious;

  useEffect(() => {
    if (Platform.OS === "web" || !player?.addListener) return;

    const nextSub = player.addListener(LOCK_SCREEN_NEXT, () => {
      onNextRef.current();
    });
    const prevSub = player.addListener(LOCK_SCREEN_PREVIOUS, () => {
      onPreviousRef.current();
    });

    return () => {
      nextSub.remove();
      prevSub.remove();
    };
  }, [player]);

  useEffect(() => {
    if (Platform.OS === "web" || !player) return;

    if (!song) {
      if (activeSongIdRef.current !== null) {
        safeClearLockScreen(player);
        activeSongIdRef.current = null;
      }
      return;
    }

    const metadata = buildNotificationMetadata(song);
    const isNewSong = activeSongIdRef.current !== song.id;

    void ensureAndroidNotificationPermission();
    safeUpdateLockScreen(player, metadata, isNewSong);
    activeSongIdRef.current = song.id;
  }, [
    player,
    song?.id,
    song?.title,
    song?.artist,
    song?.album?.name,
    song?.coverUrl,
    song?.albumCoverUrl,
    song?.artistImageUrl,
    song?.album?.coverUrl,
  ]);

  useEffect(() => {
    if (Platform.OS === "web" || !player || !song) return;
    if (activeSongIdRef.current !== song.id) return;

    const metadata = buildNotificationMetadata(song);
    safeUpdateLockScreen(player, metadata, false);
  }, [player, song?.id, isPlaying]);
}
