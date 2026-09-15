import { buildNotificationMetadata } from "@/lib/notification-metadata";
import type { Song } from "@/lib/types";
import type { AudioLockScreenOptions, AudioMetadata } from "expo-audio";
import { useEffect, useRef } from "react";
import { Linking, PermissionsAndroid, Platform } from "react-native";

/**
 * Button layout mirrors the web player-bar: prev / play-pause / next (+ like).
 * Seek stays available through the notification seek bar (Media3 position),
 * which covers the web MediaSession `seekto` handler without crowding the
 * compact notification — Android shows at most ~5 actions, so enabling the
 * ±10s seek buttons together with prev/next/like would push Like (or Next)
 * off-screen on many devices and OS versions.
 */
const LOCK_SCREEN_OPTIONS: AudioLockScreenOptions = {
  showSeekForward: false,
  showSeekBackward: false,
  showNextTrack: true,
  showPreviousTrack: true,
  showLikeAction: true,
  seekIntervalMs: 10000,
};

const LOCK_SCREEN_NEXT = "lockScreenNext";
const LOCK_SCREEN_PREVIOUS = "lockScreenPrevious";
const LOCK_SCREEN_LIKE = "lockScreenLike";

/**
 * POST_NOTIFICATIONS is required from Android 13 (API 33) for the Media3
 * playback notification to be visible at all. Fire-and-forget: playback
 * continues without it, the notification is just suppressed by the OS.
 * Guarded so rapid song changes can't spam the system dialog.
 */
let permissionRequested = false;

async function ensureAndroidNotificationPermission(): Promise<void> {
  if (Platform.OS !== "android") return;
  const apiLevel =
    typeof Platform.Version === "string"
      ? Number.parseInt(Platform.Version, 10)
      : Platform.Version;
  if (!Number.isFinite(apiLevel) || apiLevel < 33) return;
  if (permissionRequested) return;
  permissionRequested = true;

  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (granted) return;

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      // Android 13+: the system won't show the dialog again. Deep-link to
      // app settings so the user can re-enable the playback notification —
      // otherwise it stays suppressed on every OS version going forward.
      try {
        await Linking.openSettings();
      } catch {
        // Settings unavailable — playback continues without notification.
      }
    }
  } catch {
    // Permission request failed — notification stays suppressed, playback continues.
  }
}

function safeClearLockScreen(player: LockScreenPlayer): void {
  try {
    player.clearLockScreenControls();
  } catch {
    // Native player may already be released during teardown.
  }
}

function lockScreenOptions(isLiked: boolean): AudioLockScreenOptions {
  return { ...LOCK_SCREEN_OPTIONS, isLiked };
}

function safeUpdateLockScreen(
  player: LockScreenPlayer,
  metadata: AudioMetadata,
  isNewSong: boolean,
  isLiked: boolean,
): void {
  try {
    if (isNewSong) {
      player.setActiveForLockScreen(true, metadata, lockScreenOptions(isLiked));
    } else {
      // Same track (e.g. liked state flipped): refresh buttons without
      // rebuilding the session, so the notification never flickers.
      player.updateLockScreenMetadata(metadata, lockScreenOptions(isLiked));
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
  updateLockScreenMetadata: (
    metadata: AudioMetadata,
    options?: AudioLockScreenOptions,
  ) => void;
  clearLockScreenControls: () => void;
  addListener?: (
    event: string,
    listener: () => void,
  ) => { remove: () => void };
}

interface UseLockScreenPlayerOptions {
  player: LockScreenPlayer | null;
  song: Song | null;
  /**
   * Retained for API compatibility. Play/pause icon state is driven natively
   * by the MediaSessionService (onIsPlayingChanged), so JS does not need to
   * re-push metadata on every toggle.
   */
  isPlaying?: boolean;
  /** Drives the filled vs outline heart on the lock-screen like button. */
  isLiked: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onLike: () => void;
}

/**
 * Mirrors web `useMediaSession` for native lock-screen / notification controls.
 */
export function useLockScreenPlayer({
  player,
  song,
  isLiked,
  onNext,
  onPrevious,
  onLike,
}: UseLockScreenPlayerOptions) {
  const activeSongIdRef = useRef<string | null>(null);
  const onNextRef = useRef(onNext);
  const onPreviousRef = useRef(onPrevious);
  const onLikeRef = useRef(onLike);

  onNextRef.current = onNext;
  onPreviousRef.current = onPrevious;
  onLikeRef.current = onLike;

  useEffect(() => {
    if (Platform.OS === "web" || !player?.addListener) return;

    let nextSub: { remove: () => void } | undefined;
    let prevSub: { remove: () => void } | undefined;
    let likeSub: { remove: () => void } | undefined;
    try {
      nextSub = player.addListener(LOCK_SCREEN_NEXT, () => {
        onNextRef.current();
      });
      prevSub = player.addListener(LOCK_SCREEN_PREVIOUS, () => {
        onPreviousRef.current();
      });
      likeSub = player.addListener(LOCK_SCREEN_LIKE, () => {
        onLikeRef.current();
      });
    } catch (error) {
      console.error("Failed to subscribe to lock screen controls:", error);
    }

    return () => {
      try {
        nextSub?.remove();
        prevSub?.remove();
        likeSub?.remove();
      } catch {
        // Subscriptions may already be released during teardown.
      }
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

    // Don't await: on Android 13+ the notification is suppressed until the
    // user grants POST_NOTIFICATIONS, but playback must start immediately.
    void ensureAndroidNotificationPermission();
    safeUpdateLockScreen(player, metadata, isNewSong, isLiked);
    activeSongIdRef.current = song.id;
  }, [
    player,
    song,
    isLiked,
    song?.id,
    song?.title,
    song?.artist,
    song?.album?.name,
    song?.coverUrl,
    song?.albumCoverUrl,
    song?.artistImageUrl,
    song?.album?.coverUrl,
  ]);

  // Clear stale controls on unmount (e.g. logout teardown) so the
  // notification never outlives the session on any Android version.
  // NOTE: no metadata refresh on `isPlaying` here — the native
  // MediaSessionService already swaps the play/pause icon via
  // onIsPlayingChanged, and re-pushing full metadata would refetch
  // artwork and flicker the notification every play/pause toggle.
  useEffect(() => {
    if (Platform.OS === "web") return;
    return () => {
      if (activeSongIdRef.current !== null && player) {
        safeClearLockScreen(player);
        activeSongIdRef.current = null;
      }
    };
  }, [player]);
}
