import type { ConfigContext, ExpoConfig } from "expo/config";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Mirror .env into expo.extra for native builds and Constants access. */
export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = requireEnv("EXPO_PUBLIC_API_URL").replace(/\/$/, "");
  const appUrl = requireEnv("EXPO_PUBLIC_APP_URL").replace(/\/$/, "");
  const cloudinaryCloudName = requireEnv("EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME");

  return {
    ...config,
    extra: {
      ...config.extra,
      apiUrl,
      appUrl,
      cloudinaryCloudName,
    },
  } as ExpoConfig;
};
