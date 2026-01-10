import {
  useAudioPlayerStatus,
  useAudioPlayer as useExpoAudioPlayer,
} from "expo-audio";
import { useState } from "react";

export const useAudioPlayer = () => {
  const [source, setSource] = useState<string | null>(null);
  const player = useExpoAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  async function loadSound(uri: string) {
    setSource(uri);
    player.play();
  }

  function playPause() {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }

  function stop() {
    player.pause();
    player.seekTo(0);
  }

  return {
    loadSound,
    playPause,
    stop,
    isPlaying: status.playing,
    status,
  };
};
