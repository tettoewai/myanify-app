import type { ConfigContext, ExpoConfig } from "expo/config";
import { config as dotenvConfig } from "dotenv";

// Load .env file
dotenvConfig();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/** Mirror .env into expo.extra for native builds and Constants access. */
export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = requireEnv("EXPO_PUBLIC_API_URL").replace(/\/$/, "");
  const appUrl = requireEnv("EXPO_PUBLIC_APP_URL").replace(/\/$/, "");
  const cloudinaryCloudName = requireEnv("EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME");
  const spotifyClientId = optionalEnv("EXPO_PUBLIC_SPOTIFY_CLIENT_ID");
  const vercelBypassToken = optionalEnv("EXPO_PUBLIC_VERCEL_BYPASS_TOKEN");
  const releasePublicKey = optionalEnv("EXPO_PUBLIC_RELEASE_PUBLIC_KEY");
  const releaseRepo =
    optionalEnv("EXPO_PUBLIC_RELEASE_REPO") ?? "tettoewai/myanify-releases";

  return {
    ...config,
    runtimeVersion: config.version,
    extra: {
      ...config.extra,
      apiUrl,
      appUrl,
      cloudinaryCloudName,
      ...(spotifyClientId ? { spotifyClientId } : {}),
      ...(vercelBypassToken ? { vercelBypassToken } : {}),
      ...(releasePublicKey ? { releasePublicKey } : {}),
      releaseRepo,
    },
  } as ExpoConfig;
};
