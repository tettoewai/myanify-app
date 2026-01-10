import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import * as SecureStore from "expo-secure-store";
import { Song } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "heroui-native";

interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: Song[];
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: "off" | "all" | "one";
  isLoading: boolean;
  setCurrentSong: (song: Song | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setQueue: (songs: Song[]) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsShuffled: (shuffled: boolean) => void;
  setRepeatMode: (mode: "off" | "all" | "one") => void;
  playSong: (song: Song) => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seekTo: (time: number) => void;
  getRecentlyPlayed: () => Song[];
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const LAST_PLAYED_SONG_KEY = "myanify_last_played_song";
const LAST_PLAYBACK_POSITION_KEY = "myanify_last_playback_position";
const POSITION_SAVE_INTERVAL = 5000;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<Song[]>([]);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [isLoading, setIsLoading] = useState(false);

  const player = useAudioPlayer(currentSong?.audioUrl || null);
  const status = useAudioPlayerStatus(player);

  const positionSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const restorePositionRef = useRef<number | null>(null);

  // Configure audio mode
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });
  }, []);

  // Restore last played song on mount (only song ID, not full object)
  useEffect(() => {
    const restoreLastPlayed = async () => {
      try {
        const lastPlayedSongId = await SecureStore.getItemAsync(
          LAST_PLAYED_SONG_KEY
        );
        const lastPositionData = await SecureStore.getItemAsync(
          LAST_PLAYBACK_POSITION_KEY
        );

        if (lastPlayedSongId && queue.length > 0) {
          // Find the song in the queue by ID
          const lastPlayed = queue.find((s) => s.id === lastPlayedSongId);
          if (lastPlayed) {
            setCurrentSong(lastPlayed);

            if (lastPositionData) {
              const savedPosition = JSON.parse(lastPositionData);
              if (
                savedPosition.songId === lastPlayed.id &&
                savedPosition.timestamp >= 0
              ) {
                restorePositionRef.current = savedPosition.timestamp;
              }
            }
          }
        }
      } catch (error) {
        console.error("Error restoring last played song:", error);
      }
    };

    // Only restore if queue is loaded
    if (queue.length > 0) {
      restoreLastPlayed();
    }
  }, [queue]);

  // Save playback position periodically
  useEffect(() => {
    if (isPlaying && currentSong) {
      if (positionSaveIntervalRef.current) {
        clearInterval(positionSaveIntervalRef.current);
      }

      positionSaveIntervalRef.current = setInterval(async () => {
        if (currentSong && currentTime > 0) {
          await savePlaybackPosition(currentSong.id, currentTime);
        }
      }, POSITION_SAVE_INTERVAL);

      return () => {
        if (positionSaveIntervalRef.current) {
          clearInterval(positionSaveIntervalRef.current);
        }
      };
    } else {
      if (currentSong && currentTime > 0) {
        savePlaybackPosition(currentSong.id, currentTime);
      }
      if (positionSaveIntervalRef.current) {
        clearInterval(positionSaveIntervalRef.current);
        positionSaveIntervalRef.current = null;
      }
    }
  }, [isPlaying, currentSong, currentTime]);

  // Sync player with context state
  useEffect(() => {
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, player]);

  useEffect(() => {
    player.volume = isMuted ? 0 : volume;
  }, [volume, isMuted, player]);

  useEffect(() => {
    player.loop = repeatMode === "one";
  }, [repeatMode, player]);

  // Handle position restoration
  useEffect(() => {
    if (status.isLoaded && restorePositionRef.current !== null) {
      const position = restorePositionRef.current;
      if (position >= 0 && position < status.duration) {
        player.seekTo(position);
      }
      restorePositionRef.current = null;
    }
  }, [status.isLoaded, player]);

  // Sync context state with player status
  // This will update whenever any property of status changes
  useEffect(() => {
    if (status.duration > 0) {
      setDuration(status.duration);
    }
    if (status.currentTime !== undefined) {
      setCurrentTime(status.currentTime);
    }
    setIsLoading(status.isBuffering);

    if (status.didJustFinish) {
      handleSongEnd();
    }
  }, [status]);

  const handleSongEnd = () => {
    if (repeatMode === "one") {
      // Song will loop automatically
      return;
    }

    if (
      repeatMode === "all" ||
      (queue.length > 0 &&
        queue.findIndex((s) => s.id === currentSong?.id) < queue.length - 1)
    ) {
      nextSong();
    } else {
      setIsPlaying(false);
    }
  };

  const savePlaybackPosition = async (songId: string, timestamp: number) => {
    try {
      const positionData = {
        songId,
        timestamp,
        savedAt: Date.now(),
      };
      await SecureStore.setItemAsync(
        LAST_PLAYBACK_POSITION_KEY,
        JSON.stringify(positionData)
      );
    } catch (error) {
      console.error("Error saving playback position:", error);
    }
  };

  const saveLastPlayedSong = async (song: Song) => {
    try {
      // Only store song ID to avoid SecureStore size limit
      await SecureStore.setItemAsync(LAST_PLAYED_SONG_KEY, song.id);
    } catch (error) {
      console.error("Error saving last played song:", error);
    }
  };

  const saveToPlayHistory = async (song: Song) => {
    // Only save if user is authenticated
    if (!token) return;

    try {
      await apiClient.post("/play-history", {
        songId: song.id,
        duration: currentTime,
      });
    } catch (error) {
      // Silently fail - not critical
      // Auth errors (401) are expected and already handled by apiClient
      // Only log unexpected errors
      if (
        error instanceof Error &&
        !error.message.includes("401") &&
        !error.message.includes("Unauthorized")
      ) {
        console.error("Error saving to play history:", error);
      }
    }
  };

  const playSong = async (song: Song) => {
    if (song.isPremium) {
      // Handle premium check - you might want to check user premium status
      toast.show({
        label: "Premium song - need to check subscription",
        variant: "danger",
      });
    }

    // If switching to a different song, reset position
    if (currentSong?.id !== song.id) {
      restorePositionRef.current = null;
      setCurrentTime(0);
    }

    setCurrentSong(song);
    setIsPlaying(true);

    await saveLastPlayedSong(song);
    await saveToPlayHistory(song);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const nextSong = () => {
    if (!currentSong || queue.length === 0) return;

    if (isShuffled) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      const randomSong = queue[randomIndex];
      playSong(randomSong);
      return;
    }

    const currentIndex = queue.findIndex((s) => s.id === currentSong.id);

    if (currentIndex === queue.length - 1 && repeatMode === "off") {
      setIsPlaying(false);
      return;
    }

    const nextSong = queue[(currentIndex + 1) % queue.length];
    playSong(nextSong);
  };

  const prevSong = () => {
    if (!currentSong) return;

    // If more than 3 seconds in, restart the song
    if (currentTime > 3) {
      seekTo(0);
      return;
    }

    if (isShuffled) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      const randomSong = queue[randomIndex];
      playSong(randomSong);
      return;
    }

    const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
    const prevSong = queue[(currentIndex - 1 + queue.length) % queue.length];
    playSong(prevSong);
  };

  const seekTo = async (time: number) => {
    try {
      await player.seekTo(time);
      setCurrentTime(time);
    } catch (error) {
      console.error("Error seeking:", error);
    }
  };

  const getRecentlyPlayed = (): Song[] => {
    // This would typically fetch from API
    // For now, return empty array
    return [];
  };

  return (
    <PlayerContext.Provider
      value={{
        currentSong,
        isPlaying,
        currentTime,
        duration,
        queue,
        volume,
        isMuted,
        isShuffled,
        repeatMode,
        isLoading,
        setCurrentSong,
        setIsPlaying,
        setCurrentTime,
        setQueue,
        setVolume,
        setIsMuted,
        setIsShuffled,
        setRepeatMode,
        playSong,
        togglePlay,
        nextSong,
        prevSong,
        seekTo,
        getRecentlyPlayed,
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
