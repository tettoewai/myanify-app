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
  const pendingSeekRef = useRef<number | null>(null);

  // Reset readiness when source changes
  useEffect(() => {
    setIsReady(false);
    playAttemptRef.current = false;
    pendingSeekRef.current = null;
  }, [source]);

  // Monitor player ready state
  useEffect(() => {
    if (status.isLoaded) {
      setIsReady(true);

      // Handle pending seek if any
      if (pendingSeekRef.current !== null) {
        const seekPosition = pendingSeekRef.current;
        pendingSeekRef.current = null;
        try {
          // Force a small delay to ensure player is fully ready
          setTimeout(() => {
            player.seekTo(seekPosition);
            // If we were playing, ensure playback continues after seek
            if (playAttemptRef.current) {
              setTimeout(() => {
                try {
                  player.play();
                } catch (err) {
                  console.error("Failed to resume playback after seek:", err);
                }
              }, 100);
            }
          }, 50);
        } catch (err) {
          console.error("Failed to seek after load:", err);
        }
      }

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

  // Enhanced seek function with better error handling and retry logic
  const seekTo = useCallback(
    (position: number) => {
      if (!isReady || !source) {
        console.warn("Player not ready or no source loaded for seek");
        // Store pending seek for when player becomes ready
        pendingSeekRef.current = position;
        return;
      }

      try {
        // Ensure position is valid
        const validPosition = Math.max(
          0,
          Math.min(position, status.duration || position),
        );

        // If not currently playing, just seek without extra logic
        if (!player.playing) {
          player.seekTo(validPosition);
          return;
        }

        // If playing, seek and ensure playback continues
        // For far seeks, we might need to pause and resume to force buffer
        const isFarSeek = Math.abs(validPosition - status.currentTime) > 30;

        if (isFarSeek) {
          // For far seeks, pause briefly to allow buffering
          const wasPlaying = player.playing;
          player.pause();

          // Seek after a small delay
          setTimeout(() => {
            try {
              player.seekTo(validPosition);

              // Resume playback after another small delay
              if (wasPlaying) {
                setTimeout(() => {
                  try {
                    player.play();
                  } catch (err) {
                    console.error("Failed to resume after far seek:", err);
                  }
                }, 150);
              }
            } catch (err) {
              console.error("Failed to seek to position:", err);
              // Try a simpler approach: seek without pause
              try {
                player.seekTo(validPosition);
                if (wasPlaying) {
                  setTimeout(() => player.play(), 50);
                }
              } catch (retryErr) {
                console.error("Retry seek also failed:", retryErr);
              }
            }
          }, 100);
        } else {
          // For near seeks, just seek directly
          player.seekTo(validPosition);
        }
      } catch (err) {
        console.error("Seek error:", err);
        // Fallback: try simple seek
        try {
          player.seekTo(position);
        } catch (fallbackErr) {
          console.error("Fallback seek failed:", fallbackErr);
        }
      }
    },
    [player, isReady, source, status],
  );

  return {
    loadSound,
    playPause,
    stop,
    seekTo,
    isPlaying: status.playing && isReady,
    isReady,
    status,
  };
};
