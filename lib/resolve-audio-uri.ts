import { downloadManager } from "./vip-offline";

/**
 * Resolves the URI passed to expo-audio.
 * Prefers the offline file when present AND offline playback is still
 * allowed (VIP active, or admin disabled the VIP requirement).
 * Falls back to the backend stream proxy otherwise.
 */
export async function resolvePlayableAudioUri(
  streamUrl: string,
  songId?: string,
): Promise<string> {
  if (!streamUrl) {
    throw new Error("No audio URL provided");
  }

  if (songId) {
    try {
      const local = await downloadManager.getDownloadedFile(songId);
      if (local) return local;
    } catch {
      // Fall through to streaming.
    }
  }

  return streamUrl;
}
