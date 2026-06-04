import {
  useAudioPlayerStatus,
  useAudioPlayer as useExpoAudioPlayer,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

export const useAudioPlayer = () => {
  const [source, setSource] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const player = useExpoAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const playAttemptRef = useRef(false);

  // Reset readiness when source changes
  useEffect(() => {
    setIsReady(false);
    playAttemptRef.current = false;
  }, [source]);

  // Monitor player ready state
  useEffect(() => {
    if (status.isLoaded) {
      setIsReady(true);

      // Auto-play if we were waiting for player to be ready
      if (playAttemptRef.current && source) {
        try {
          player.play();
        } catch (err) {
          console.error("Failed to auto-play after load:", err);
        }
        playAttemptRef.current = false;
      }
    }
  }, [status.isLoaded, player, source]);

  const loadSound = useCallback(async (uri: string) => {
    if (!uri) {
      console.error("Invalid audio URI provided");
      return;
    }

    setSource(uri);
    playAttemptRef.current = true;
  }, []);

  const playPause = useCallback(() => {
    if (!isReady || !source) {
      console.warn("Player not ready or no source loaded");
      return;
    }

    if (player.playing) {
      player.pause();
    } else {
      try {
        player.play();
      } catch (err) {
        console.error("Playback error:", err);
      }
    }
  }, [player, isReady, source]);

  const stop = useCallback(() => {
    if (!isReady) return;

    player.pause();
    player.seekTo(0);
  }, [player, isReady]);

  return {
    loadSound,
    playPause,
    stop,
    isPlaying: status.playing && isReady,
    isReady,
    status,
  };
};
