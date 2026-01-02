import { Audio, AVPlaybackStatus } from 'expo-av';
import { useEffect, useState } from 'react';

export const useAudioPlayer = () => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);

  async function loadSound(uri: string) {
    if (sound) {
      await sound.unloadAsync();
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true },
      onPlaybackStatusUpdate
    );
    setSound(newSound);
    setIsPlaying(true);
  }

  const onPlaybackStatusUpdate = (newStatus: AVPlaybackStatus) => {
    setStatus(newStatus);
    if (newStatus.isLoaded) {
      setIsPlaying(newStatus.isPlaying);
    }
  };

  async function playPause() {
    if (!sound) return;

    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  }

  async function stop() {
    if (!sound) return;
    await sound.stopAsync();
    setIsPlaying(false);
  }

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  return {
    loadSound,
    playPause,
    stop,
    isPlaying,
    status,
  };
};
