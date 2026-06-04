/**
 * Resolves the URI passed to expo-audio. Uses the backend stream proxy so both
 * native and Expo web get correct MIME types and HTTP range streaming.
 */
export async function resolvePlayableAudioUri(
  streamUrl: string,
): Promise<string> {
  if (!streamUrl) {
    throw new Error("No audio URL provided");
  }

  return streamUrl;
}
