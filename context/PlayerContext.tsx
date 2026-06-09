import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api";
import { formatSongFromApi } from "@/lib/song-format";
import { resolvePlayableAudioUri } from "@/lib/resolve-audio-uri";
import { getSongStreamUrl } from "@/lib/playback-url";
import {
  createQueueItem,
  createQueueItems,
  MAX_PLAY_HISTORY,
  RADIO_BATCH_SIZE,
  RADIO_REFETCH_THRESHOLD,
  pickAutoplaySongs,
  reorderQueueItems,
  restoreUserUpNext,
  serializeUserUpNext,
  shuffleUpNext,
  UP_NEXT_STORAGE_KEY,
  type PersistedQueueEntry,
} from "@/lib/queue";
import { fetchSongLyrics } from "@/lib/song-lyrics";
import type { LyricLine, QueueItem, QueueItemSource, Song } from "@/lib/types";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import * as SecureStore from "expo-secure-store";
import { useToast } from "heroui-native";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface PlaySongOptions {
  source?: QueueItemSource;
  upNext?: Song[];
  enableRadio?: boolean;
  skipAuth?: boolean;
}

interface PlayerContextType {
  currentSong: Song | null;
  currentSongLyrics: LyricLine[] | undefined;
  isLoadingLyrics: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: Song[];
  upNext: QueueItem[];
  history: QueueItem[];
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: "off" | "all" | "one";
  radioMode: boolean;
  radioSeedSongId: string | null;
  isFetchingRadio: boolean;
  showQueue: boolean;
  isLoading: boolean;
  error: string | null;
  setCurrentSong: (song: Song | null) => void;
  requestCurrentSongLyrics: () => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setQueue: (songs: Song[]) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsShuffled: (shuffled: boolean) => void;
  setRepeatMode: (mode: "off" | "all" | "one") => void;
  setRadioMode: (enabled: boolean) => void;
  setShowQueue: (show: boolean) => void;
  playSong: (song: Song, options?: PlaySongOptions) => Promise<void>;
  playFromContext: (
    song: Song,
    contextSongs: Song[],
    source?: QueueItemSource,
  ) => Promise<void>;
  addToQueue: (song: Song) => void;
  playNextInQueue: (song: Song) => void;
  removeFromQueue: (qid: string) => void;
  reorderUpNext: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  startRadio: (seedSong: Song) => void;
  isSongQueued: (songId: string) => boolean;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seekTo: (time: number) => void;
  getRecentlyPlayed: () => Song[];
  clearError: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const LAST_PLAYED_SONG_KEY = "myanify_last_played_song";
const LAST_PLAYBACK_POSITION_KEY = "myanify_last_playback_position";
const POSITION_SAVE_INTERVAL = 5000;
const PRELOAD_SECONDS_BEFORE_END = 15;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentSongLyrics, setCurrentSongLyrics] = useState<
    LyricLine[] | undefined
  >(undefined);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [lyricsRequested, setLyricsRequested] = useState(false);
  const lyricsCacheRef = useRef<Map<string, LyricLine[]>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<Song[]>([]);
  const [upNext, setUpNext] = useState<QueueItem[]>([]);
  const [history, setHistory] = useState<QueueItem[]>([]);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [radioMode, setRadioMode] = useState(true);
  const [radioSeedSongId, setRadioSeedSongId] = useState<string | null>(null);
  const [isFetchingRadio, setIsFetchingRadio] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playableUri, setPlayableUri] = useState<string | undefined>(undefined);
  const [isResolvingSource, setIsResolvingSource] = useState(false);
  const [recentlyPlayedCache, setRecentlyPlayedCache] = useState<Song[]>([]);

  const player = useAudioPlayer(playableUri);
  const status = useAudioPlayerStatus(player);

  const positionSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const restorePositionRef = useRef<number | null>(null);
  const hasRestoredRef = useRef(false);
  const isSeekingRef = useRef(false);
  const playerReadyRef = useRef(false);
  const shouldAutoPlayRef = useRef(false);
  const hasValidSourceRef = useRef(false);
  const seenSongIdsRef = useRef<Set<string>>(new Set());
  const radioRetryAtRef = useRef(0);
  const shuffleOrderRef = useRef<QueueItem[] | null>(null);
  const upNextBaselineRef = useRef<QueueItem[]>([]);
  const preloadUriRef = useRef<string | null>(null);
  const preloadedQidRef = useRef<string | null>(null);
  const preloadedSongIdRef = useRef<string | null>(null);
  const userDisabledRadioRef = useRef(false);
  const currentSongRef = useRef<Song | null>(null);
  const upNextRef = useRef<QueueItem[]>([]);

  useEffect(() => {
    upNextRef.current = upNext;
  }, [upNext]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  const persistUserUpNext = useCallback(async (items: QueueItem[]) => {
    try {
      await SecureStore.setItemAsync(
        UP_NEXT_STORAGE_KEY,
        JSON.stringify(serializeUserUpNext(items)),
      );
    } catch (e) {
      console.error("Error saving up next:", e);
    }
  }, []);

  const syncLegacyQueue = useCallback((items: QueueItem[]) => {
    const songList = items.map((i) => i.song);
    if (currentSongRef.current) {
      const hasCurrent = songList.some(
        (s) => s.id === currentSongRef.current?.id,
      );
      if (!hasCurrent) {
        setQueue([currentSongRef.current, ...songList]);
        return;
      }
    }
    setQueue(songList);
  }, []);

  const applyUpNext = useCallback(
    (items: QueueItem[]) => {
      setUpNext(items);
      upNextBaselineRef.current = items;
      if (!isShuffled) shuffleOrderRef.current = null;
      void persistUserUpNext(items);
      syncLegacyQueue(items);
    },
    [isShuffled, persistUserUpNext, syncLegacyQueue],
  );

  const markSongSeen = useCallback((songId: string) => {
    seenSongIdsRef.current.add(songId);
  }, []);

  const fetchCatalogSongs = useCallback(
    async (limit: number): Promise<Song[]> => {
      try {
        const data = await apiClient.get(
          `/songs?isPublished=true&limit=${limit}`,
        );
        const raw = data?.data || data || [];
        return (Array.isArray(raw) ? raw : []).map(formatSongFromApi);
      } catch {
        return [];
      }
    },
    [],
  );

  const appendRadioSongs = useCallback(
    (newSongs: Song[], source: QueueItemSource, append: boolean) => {
      if (newSongs.length === 0) return;
      setUpNext((prev) => {
        const radioItems = createQueueItems(newSongs, source);
        for (const s of newSongs) markSongSeen(s.id);
        const merged = append ? [...prev, ...radioItems] : radioItems;
        upNextBaselineRef.current = merged;
        syncLegacyQueue(merged);
        return merged;
      });
    },
    [markSongSeen, syncLegacyQueue],
  );

  const fetchSimilarSongs = useCallback(
    async (seedId: string, append = true): Promise<Song[]> => {
      if (Date.now() < radioRetryAtRef.current) return [];
      setIsFetchingRadio(true);
      let source: QueueItemSource = "radio";
      try {
        const exclude = Array.from(seenSongIdsRef.current).join(",");
        const data = await apiClient.get(
          `/songs/similar?seedSongId=${encodeURIComponent(seedId)}&excludeIds=${encodeURIComponent(exclude)}&limit=${RADIO_BATCH_SIZE}`,
        );
        const raw = data?.data || data || [];
        let newSongs = (Array.isArray(raw) ? raw : []).map(formatSongFromApi);
        if (newSongs.length === 0) {
          source = "autoplay";
          newSongs = pickAutoplaySongs(
            queue,
            recentlyPlayedCache,
            seenSongIdsRef.current,
            seedId,
            RADIO_BATCH_SIZE,
          );
          if (newSongs.length === 0) {
            const catalog = await fetchCatalogSongs(RADIO_BATCH_SIZE);
            newSongs = pickAutoplaySongs(
              catalog,
              recentlyPlayedCache,
              seenSongIdsRef.current,
              seedId,
              RADIO_BATCH_SIZE,
            );
          }
        }
        appendRadioSongs(newSongs, source, append);
        return newSongs;
      } catch (e) {
        console.error("Radio fetch error:", e);
        radioRetryAtRef.current = Date.now() + 30_000;
        let fallback = pickAutoplaySongs(
          queue,
          recentlyPlayedCache,
          seenSongIdsRef.current,
          seedId,
          RADIO_BATCH_SIZE,
        );
        if (fallback.length === 0) {
          const catalog = await fetchCatalogSongs(RADIO_BATCH_SIZE);
          fallback = pickAutoplaySongs(
            catalog,
            recentlyPlayedCache,
            seenSongIdsRef.current,
            seedId,
            RADIO_BATCH_SIZE,
          );
        }
        appendRadioSongs(fallback, "autoplay", true);
        return fallback;
      } finally {
        setIsFetchingRadio(false);
      }
    },
    [appendRadioSongs, fetchCatalogSongs, queue, recentlyPlayedCache],
  );

  const maybeRefillRadio = useCallback(
    (items: QueueItem[]) => {
      if (!radioMode || !radioSeedSongId) return;
      const radioCount = items.filter(
        (i) => i.source === "radio" || i.source === "autoplay",
      ).length;
      if (radioCount < RADIO_REFETCH_THRESHOLD) {
        void fetchSimilarSongs(radioSeedSongId, true);
      }
    },
    [radioMode, radioSeedSongId, fetchSimilarSongs],
  );

  const enableSmartRadio = useCallback(
    (seedSong: Song, append = true) => {
      userDisabledRadioRef.current = false;
      setRadioMode(true);
      setRadioSeedSongId(seedSong.id);
      markSongSeen(seedSong.id);
      void fetchSimilarSongs(seedSong.id, append);
    },
    [fetchSimilarSongs, markSongSeen],
  );

  const ensureSmartRadioForEmptyQueue = useCallback(() => {
    const song = currentSongRef.current;
    if (!song || upNextRef.current.length > 0 || userDisabledRadioRef.current) {
      return;
    }

    if (!radioMode || radioSeedSongId !== song.id) {
      enableSmartRadio(song, true);
      return;
    }

    const hasSuggested = upNextRef.current.some(
      (i) => i.source === "radio" || i.source === "autoplay",
    );
    if (!hasSuggested && !isFetchingRadio) {
      void fetchSimilarSongs(song.id, true);
    }
  }, [
    radioMode,
    radioSeedSongId,
    isFetchingRadio,
    enableSmartRadio,
    fetchSimilarSongs,
  ]);

  useEffect(() => {
    ensureSmartRadioForEmptyQueue();
  }, [upNext.length, currentSong?.id, ensureSmartRadioForEmptyQueue]);

  useEffect(() => {
    setLyricsRequested(false);

    if (!currentSong) {
      setCurrentSongLyrics(undefined);
      setIsLoadingLyrics(false);
      return;
    }

    if (currentSong.lyrics !== undefined) {
      lyricsCacheRef.current.set(currentSong.id, currentSong.lyrics);
      setCurrentSongLyrics(currentSong.lyrics);
      setIsLoadingLyrics(false);
      return;
    }

    const cached = lyricsCacheRef.current.get(currentSong.id);
    if (cached !== undefined) {
      setCurrentSongLyrics(cached);
      setIsLoadingLyrics(false);
      return;
    }

    setCurrentSongLyrics(undefined);
    setIsLoadingLyrics(false);
  }, [currentSong?.id, currentSong?.lyrics]);

  const requestCurrentSongLyrics = useCallback(() => {
    setLyricsRequested(true);
  }, []);

  useEffect(() => {
    if (!currentSong || !lyricsRequested) return;
    if (currentSongLyrics !== undefined) return;

    const cached = lyricsCacheRef.current.get(currentSong.id);
    if (cached !== undefined) {
      setCurrentSongLyrics(cached);
      return;
    }

    let cancelled = false;
    setIsLoadingLyrics(true);

    fetchSongLyrics(currentSong.id)
      .then((lyrics) => {
        if (cancelled) return;
        lyricsCacheRef.current.set(currentSong.id, lyrics);
        setCurrentSongLyrics(lyrics);
      })
      .catch(() => {
        if (cancelled) return;
        lyricsCacheRef.current.set(currentSong.id, []);
        setCurrentSongLyrics([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLyrics(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentSong?.id, currentSongLyrics, lyricsRequested]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    }).catch(console.error);
  }, []);

  useEffect(() => {
    hasValidSourceRef.current = !!playableUri;
  }, [playableUri]);

  useEffect(() => {
    if (!token) return;
    apiClient
      .get("/play-history?limit=50")
      .then((data) => {
        const raw = data?.data || data || [];
        setRecentlyPlayedCache(
          (Array.isArray(raw) ? raw : []).map(formatSongFromApi),
        );
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const streamUrl = currentSong ? getSongStreamUrl(currentSong) : "";

    if (!streamUrl) {
      setPlayableUri(undefined);
      return;
    }

    if (
      preloadedSongIdRef.current === currentSong?.id &&
      preloadUriRef.current
    ) {
      setPlayableUri(preloadUriRef.current);
      preloadUriRef.current = null;
      preloadedQidRef.current = null;
      preloadedSongIdRef.current = null;
      playerReadyRef.current = false;
      setIsResolvingSource(false);
      return;
    }

    setPlayableUri(undefined);
    playerReadyRef.current = false;
    setIsResolvingSource(true);
    setError(null);

    resolvePlayableAudioUri(streamUrl)
      .then((uri) => {
        if (!cancelled) setPlayableUri(uri);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to resolve audio URI:", err);
          setError("Failed to load audio");
          setIsPlaying(false);
          shouldAutoPlayRef.current = false;
          toast.show({
            label: "Couldn't play track. Skipping…",
            variant: "danger",
          });
          setTimeout(() => advanceToNextRef.current(), 300);
        }
      })
      .finally(() => {
        if (!cancelled) setIsResolvingSource(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentSong?.id, currentSong?.audioUrl, currentSong?.playbackUrl]);

  const advanceToNextRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (status.isLoaded && hasValidSourceRef.current) {
      if (!playerReadyRef.current) {
        playerReadyRef.current = true;
        if (restorePositionRef.current !== null) {
          const position = restorePositionRef.current;
          if (
            position >= 0 &&
            status.duration > 0 &&
            position < status.duration
          ) {
            player.seekTo(position);
          }
          restorePositionRef.current = null;
        }
        player.volume = isMuted ? 0 : volume;
        player.loop = repeatMode === "one";
        if (shouldAutoPlayRef.current) {
          try {
            player.play();
            setIsPlaying(true);
          } catch {
            setIsPlaying(false);
          }
          shouldAutoPlayRef.current = false;
        }
      }
    } else if (!hasValidSourceRef.current) {
      playerReadyRef.current = false;
    }
  }, [status.isLoaded, status.duration, player, volume, isMuted, repeatMode]);

  useEffect(() => {
    if (currentSong && getSongStreamUrl(currentSong)) {
      playerReadyRef.current = false;
    }
  }, [currentSong?.id]);

  useEffect(() => {
    const restore = async () => {
      if (currentSong || hasRestoredRef.current) return;
      hasRestoredRef.current = true;
      try {
        const raw = await SecureStore.getItemAsync(UP_NEXT_STORAGE_KEY);
        if (raw && queue.length > 0) {
          const entries = JSON.parse(raw) as PersistedQueueEntry[];
          const map = new Map(queue.map((s) => [s.id, s]));
          const restored = restoreUserUpNext(
            entries,
            (id) => map.get(id) ?? queue.find((s) => s.id === id),
          );
          if (restored.length > 0) applyUpNext(restored);
        }
        const lastId = await SecureStore.getItemAsync(LAST_PLAYED_SONG_KEY);
        const lastPos = await SecureStore.getItemAsync(
          LAST_PLAYBACK_POSITION_KEY,
        );
        if (lastId && queue.length > 0) {
          const last = queue.find((s) => s.id === lastId);
          if (last) {
            setCurrentSong(last);
            if (lastPos) {
              const saved = JSON.parse(lastPos);
              if (saved.songId === last.id) {
                restorePositionRef.current = saved.timestamp;
              }
            }
          }
        }
      } catch (e) {
        console.error("Restore error:", e);
      }
    };
    if (queue.length > 0) void restore();
  }, [queue, currentSong, applyUpNext]);

  useEffect(() => {
    if (!currentSong || !upNext[0] || duration <= 0) return;
    const remaining = duration - currentTime;
    if (remaining > PRELOAD_SECONDS_BEFORE_END) return;
    const next = upNext[0];
    if (preloadedQidRef.current === next.qid) return;
    const url = getSongStreamUrl(next.song);
    if (!url) return;
    resolvePlayableAudioUri(url)
      .then((uri) => {
        preloadUriRef.current = uri;
        preloadedQidRef.current = next.qid;
        preloadedSongIdRef.current = next.song.id;
      })
      .catch(() => {});
  }, [currentTime, duration, currentSong, upNext]);

  useEffect(() => {
    if (isPlaying && currentSong && currentTime > 0) {
      if (positionSaveIntervalRef.current) {
        clearInterval(positionSaveIntervalRef.current);
      }
      positionSaveIntervalRef.current = setInterval(() => {
        if (currentSong && currentTime > 0) {
          void savePlaybackPosition(currentSong.id, currentTime);
        }
      }, POSITION_SAVE_INTERVAL);
      return () => {
        if (positionSaveIntervalRef.current) {
          clearInterval(positionSaveIntervalRef.current);
        }
      };
    }
    if (currentSong && currentTime > 0) {
      void savePlaybackPosition(currentSong.id, currentTime);
    }
    if (positionSaveIntervalRef.current) {
      clearInterval(positionSaveIntervalRef.current);
      positionSaveIntervalRef.current = null;
    }
  }, [isPlaying, currentSong, currentTime]);

  useEffect(() => {
    if (!playerReadyRef.current || !hasValidSourceRef.current) return;
    if (isPlaying && !player.playing) {
      try {
        player.play();
      } catch {
        setIsPlaying(false);
      }
    } else if (!isPlaying && player.playing) {
      player.pause();
    }
  }, [isPlaying, player]);

  useEffect(() => {
    if (playerReadyRef.current && hasValidSourceRef.current) {
      player.loop = repeatMode === "one";
    }
  }, [repeatMode, player]);

  useEffect(() => {
    if (status.duration > 0 && !isSeekingRef.current) {
      setDuration(status.duration);
    }
    if (status.currentTime !== undefined && !isSeekingRef.current) {
      setCurrentTime(status.currentTime);
    }
    setIsLoading(isResolvingSource || status.isBuffering);
    if (status.didJustFinish) {
      // Use refs to avoid stale closures — advanceToNextRef always holds the latest fn
      if (currentSongRef.current) {
        void savePlaybackPosition(currentSongRef.current.id, 0);
      }
      advanceToNextRef.current();
    }
  }, [
    status.duration,
    status.currentTime,
    status.isBuffering,
    status.didJustFinish,
    isResolvingSource,
  ]);

  const savePlaybackPosition = async (songId: string, timestamp: number) => {
    try {
      await SecureStore.setItemAsync(
        LAST_PLAYBACK_POSITION_KEY,
        JSON.stringify({ songId, timestamp, savedAt: Date.now() }),
      );
    } catch (e) {
      console.error("Error saving position:", e);
    }
  };

  const saveLastPlayedSong = async (song: Song) => {
    try {
      await SecureStore.setItemAsync(LAST_PLAYED_SONG_KEY, song.id);
    } catch (e) {
      console.error("Error saving last played:", e);
    }
  };

  const saveToPlayHistory = async (song: Song) => {
    if (!token) return;
    try {
      await apiClient.post("/play-history", {
        songId: song.id,
        duration: currentTime,
      });
    } catch (e) {
      if (e instanceof Error && !e.message.includes("401")) {
        console.error("Play history error:", e);
      }
    }
  };

  const pushToHistory = useCallback((song: Song, source: QueueItemSource) => {
    setHistory((prev) => {
      const item = createQueueItem(song, source);
      const next = [...prev, item];
      return next.length > MAX_PLAY_HISTORY
        ? next.slice(-MAX_PLAY_HISTORY)
        : next;
    });
  }, []);

  const getActiveUpNext = useCallback((): QueueItem[] => {
    if (isShuffled && shuffleOrderRef.current) {
      return shuffleOrderRef.current;
    }
    return upNextRef.current;
  }, [isShuffled]);

  const playSongInternal = useCallback(
    async (song: Song, options?: PlaySongOptions) => {
      if (!song) return;
      if (!getSongStreamUrl(song)) {
        setError("No audio source available");
        toast.show({ label: "No audio source available", variant: "danger" });
        return;
      }

      if (currentSong?.id !== song.id) {
        restorePositionRef.current = null;
        setCurrentTime(0);
        setDuration(0);
        setError(null);
        playerReadyRef.current = false;
        shouldAutoPlayRef.current = false;
      }

      markSongSeen(song.id);
      setCurrentSong(song);
      shouldAutoPlayRef.current = true;
      setIsPlaying(true);

      // Apply queue and radio mode synchronously — before any await — so the
      // user can press next immediately without waiting for network calls.
      if (options?.upNext !== undefined) {
        applyUpNext(
          createQueueItems(options.upNext, options.source ?? "playlist"),
        );
      }

      const hasUpNext =
        options?.upNext !== undefined
          ? options.upNext.length > 0
          : upNextRef.current.length > 0;

      const shouldRadio =
        options?.enableRadio ?? (!hasUpNext && options?.source !== "playlist");

      if (shouldRadio) {
        enableSmartRadio(song, true);
      } else if (
        options?.source === "playlist" &&
        !userDisabledRadioRef.current
      ) {
        // Keep Smart Radio on during playlists; suggestions load once the queue empties.
        setRadioMode(true);
        setRadioSeedSongId(song.id);
        markSongSeen(song.id);
      }

      // Fire-and-forget persistence — these must not block queue availability
      void saveLastPlayedSong(song);
      void saveToPlayHistory(song);
    },
    [currentSong?.id, markSongSeen, applyUpNext, enableSmartRadio, toast],
  );

  const playSong = useCallback(
    async (song: Song, options?: PlaySongOptions) => {
      await playSongInternal(song, options);
    },
    [playSongInternal],
  );

  const playFromContext = useCallback(
    async (
      song: Song,
      contextSongs: Song[],
      source: QueueItemSource = "playlist",
    ) => {
      const index = contextSongs.findIndex((s) => s.id === song.id);
      const remaining =
        index >= 0 ? contextSongs.slice(index + 1) : contextSongs;
      await playSongInternal(song, {
        source,
        upNext: remaining,
        enableRadio: false,
      });
    },
    [playSongInternal],
  );

  const addToQueue = useCallback(
    (song: Song) => {
      setUpNext((prev) => {
        const next = [...prev, createQueueItem(song, "user-queue")];
        upNextBaselineRef.current = next;
        void persistUserUpNext(next);
        syncLegacyQueue(next);
        return next;
      });
      toast.show({ label: "Added to queue", variant: "success" });
    },
    [persistUserUpNext, syncLegacyQueue, toast],
  );

  const playNextInQueue = useCallback(
    (song: Song) => {
      setUpNext((prev) => {
        const next = [createQueueItem(song, "user-queue"), ...prev];
        upNextBaselineRef.current = next;
        void persistUserUpNext(next);
        syncLegacyQueue(next);
        return next;
      });
      toast.show({ label: "Playing next", variant: "success" });
    },
    [persistUserUpNext, syncLegacyQueue, toast],
  );

  const removeFromQueue = useCallback(
    (qid: string) => {
      setUpNext((prev) => {
        const next = prev.filter((i) => i.qid !== qid);
        upNextBaselineRef.current = next;
        void persistUserUpNext(next);
        syncLegacyQueue(next);
        return next;
      });
    },
    [persistUserUpNext, syncLegacyQueue],
  );

  const reorderUpNext = useCallback(
    (fromIndex: number, toIndex: number) => {
      setUpNext((prev) => {
        const next = reorderQueueItems(prev, fromIndex, toIndex);
        upNextBaselineRef.current = next;
        void persistUserUpNext(next);
        syncLegacyQueue(next);
        return next;
      });
    },
    [persistUserUpNext, syncLegacyQueue],
  );

  const clearQueue = useCallback(() => {
    applyUpNext([]);
    toast.show({ label: "Queue cleared", variant: "success" });
  }, [applyUpNext, toast]);

  const startRadio = useCallback(
    (seedSong: Song) => {
      applyUpNext([]);
      void playSongInternal(seedSong, { enableRadio: true, skipAuth: true });
    },
    [applyUpNext, playSongInternal],
  );

  const playNextFromSmartRadio = useCallback(() => {
    const song = currentSongRef.current;
    if (!song) return false;

    const seedId = radioSeedSongId ?? song.id;
    let fallbacks = pickAutoplaySongs(
      queue,
      recentlyPlayedCache,
      seenSongIdsRef.current,
      seedId,
      1,
    );

    const playFallback = (items: Song[]) => {
      const queueItems = createQueueItems(items, "autoplay");
      for (const s of items) markSongSeen(s.id);
      applyUpNext(queueItems);
      void playSongInternal(items[0], { skipAuth: true });
      void fetchSimilarSongs(seedId, true);
    };

    if (fallbacks.length > 0) {
      playFallback(fallbacks);
      return true;
    }

    void (async () => {
      const catalog = await fetchCatalogSongs(RADIO_BATCH_SIZE);
      fallbacks = pickAutoplaySongs(
        catalog,
        recentlyPlayedCache,
        seenSongIdsRef.current,
        seedId,
        1,
      );
      if (fallbacks.length > 0) {
        playFallback(fallbacks);
        return;
      }
      const added = await fetchSimilarSongs(seedId, true);
      if (added.length > 0) {
        await playSongInternal(added[0], { skipAuth: true });
      } else {
        setIsPlaying(false);
      }
    })();
    return true;
  }, [
    radioSeedSongId,
    queue,
    recentlyPlayedCache,
    markSongSeen,
    applyUpNext,
    playSongInternal,
    fetchSimilarSongs,
    fetchCatalogSongs,
  ]);

  const isSongQueued = useCallback(
    (songId: string) => {
      if (currentSong?.id === songId) return true;
      return upNext.some((i) => i.song.id === songId);
    },
    [currentSong?.id, upNext],
  );

  const advanceToNext = useCallback(
    (force = false) => {
      const song = currentSongRef.current;
      if (!song) return;

      // Repeat-one only blocks natural song-end advances, not manual skips
      if (repeatMode === "one" && !force) return;

      pushToHistory(song, radioMode ? "radio" : "playlist");
      const active = getActiveUpNext();

      if (active.length > 0) {
        const [nextItem, ...rest] = active;
        if (isShuffled && shuffleOrderRef.current) {
          shuffleOrderRef.current = rest;
          // Keep baseline in original order — just drop the played item by qid
          const newBaseline = upNextBaselineRef.current.filter(
            (i) => i.qid !== nextItem.qid,
          );
          upNextBaselineRef.current = newBaseline;
          setUpNext(rest);
          void persistUserUpNext(newBaseline);
          syncLegacyQueue(rest);
        } else {
          setUpNext(rest);
          upNextBaselineRef.current = rest;
          void persistUserUpNext(rest);
          syncLegacyQueue(rest);
        }
        void playSongInternal(nextItem.song, { skipAuth: true });
        maybeRefillRadio(rest);
        return;
      }

      if (repeatMode === "all" && history.length > 0) {
        const replay = [...history]
          .reverse()
          .map((h) => createQueueItem(h.song, h.source));
        setHistory([]);
        applyUpNext(replay);
        void playSongInternal(replay[0].song, { skipAuth: true });
        return;
      }

      if (radioMode && radioSeedSongId) {
        playNextFromSmartRadio();
        return;
      }

      if (!userDisabledRadioRef.current && song) {
        enableSmartRadio(song, true);
        playNextFromSmartRadio();
        return;
      }

      setIsPlaying(false);
    },
    [
      repeatMode,
      radioMode,
      radioSeedSongId,
      pushToHistory,
      getActiveUpNext,
      isShuffled,
      history,
      playSongInternal,
      maybeRefillRadio,
      persistUserUpNext,
      syncLegacyQueue,
      enableSmartRadio,
      playNextFromSmartRadio,
    ],
  );

  useEffect(() => {
    advanceToNextRef.current = advanceToNext;
  }, [advanceToNext]);

  const seekTo = useCallback(
    (time: number) => {
      if (!playerReadyRef.current) return;
      isSeekingRef.current = true;
      player.seekTo(time);
      setCurrentTime(time);
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 100);
    },
    [player],
  );

  const nextSong = useCallback(() => {
    advanceToNext(true);
  }, [advanceToNext]);

  const prevSong = useCallback(() => {
    if (!currentSong) return;
    if (currentTime > 3) {
      seekTo(0);
      return;
    }
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((prev) => prev.slice(0, -1));
    setUpNext((prev) => {
      const currentItem = createQueueItem(currentSong, "playlist");
      const next = [currentItem, ...prev];
      upNextBaselineRef.current = next;
      if (isShuffled && shuffleOrderRef.current) {
        shuffleOrderRef.current = [currentItem, ...shuffleOrderRef.current];
      }
      void persistUserUpNext(next);
      syncLegacyQueue(next);
      return next;
    });
    void playSongInternal(last.song, { skipAuth: true });
  }, [
    currentSong,
    currentTime,
    history,
    isShuffled,
    playSongInternal,
    persistUserUpNext,
    syncLegacyQueue,
    seekTo,
  ]);

  const handleSetIsShuffled = useCallback(
    (shuffled: boolean) => {
      setIsShuffled(shuffled);
      if (shuffled) {
        shuffleOrderRef.current = shuffleUpNext(upNextBaselineRef.current);
      } else {
        shuffleOrderRef.current = null;
        setUpNext(upNextBaselineRef.current);
        syncLegacyQueue(upNextBaselineRef.current);
      }
    },
    [syncLegacyQueue],
  );

  const handleSetRadioMode = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        const seed = currentSongRef.current;
        if (!seed) {
          setRadioMode(true);
          return;
        }
        enableSmartRadio(seed, true);
        return;
      }

      userDisabledRadioRef.current = true;
      setRadioMode(false);
      setUpNext((prev) => {
        const filtered = prev.filter(
          (i) => i.source !== "radio" && i.source !== "autoplay",
        );
        if (filtered.length === prev.length) return prev;
        upNextBaselineRef.current = filtered;
        void persistUserUpNext(filtered);
        syncLegacyQueue(filtered);
        return filtered;
      });
    },
    [enableSmartRadio, persistUserUpNext, syncLegacyQueue],
  );

  const togglePlay = useCallback(() => {
    if (!hasValidSourceRef.current) return;
    setIsPlaying((prev) => !prev);
  }, []);

  const getRecentlyPlayed = useCallback((): Song[] => {
    return recentlyPlayedCache;
  }, [recentlyPlayedCache]);

  const clearError = useCallback(() => setError(null), []);

  const setQueueLegacy = useCallback(
    (songs: Song[]) => {
      setQueue(songs);
      applyUpNext(createQueueItems(songs, "playlist"));
    },
    [applyUpNext],
  );

  return (
    <PlayerContext.Provider
      value={{
        currentSong,
        currentSongLyrics,
        isLoadingLyrics,
        isPlaying,
        currentTime,
        duration,
        queue,
        upNext,
        history,
        volume,
        isMuted,
        isShuffled,
        repeatMode,
        radioMode,
        radioSeedSongId,
        isFetchingRadio,
        showQueue,
        isLoading,
        error,
        setCurrentSong,
        requestCurrentSongLyrics,
        setIsPlaying,
        setCurrentTime,
        setQueue: setQueueLegacy,
        setVolume,
        setIsMuted,
        setIsShuffled: handleSetIsShuffled,
        setRepeatMode,
        setRadioMode: handleSetRadioMode,
        setShowQueue,
        playSong,
        playFromContext,
        addToQueue,
        playNextInQueue,
        removeFromQueue,
        reorderUpNext,
        clearQueue,
        startRadio,
        isSongQueued,
        togglePlay,
        nextSong,
        prevSong,
        seekTo,
        getRecentlyPlayed,
        clearError,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
