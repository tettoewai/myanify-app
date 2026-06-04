import Constants from "expo-constants";

type AppExtra = {
  apiUrl?: string;
  appUrl?: string;
  cloudinaryCloudName?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as AppExtra;

function requireConfig(
  envKey:
    | "EXPO_PUBLIC_API_URL"
    | "EXPO_PUBLIC_APP_URL"
    | "EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME",
  extraKey: keyof AppExtra,
): string {
  const value = process.env[envKey] || extra[extraKey];
  if (!value?.trim()) {
    throw new Error(`${envKey} is not configured. Add it to .env`);
  }
  return value.trim();
}

/** API base including `/api` suffix. */
export function getApiBaseUrl(): string {
  return requireConfig("EXPO_PUBLIC_API_URL", "apiUrl").replace(/\/$/, "");
}

/** Public site origin (no `/api` suffix). Used for audio stream proxy URLs. */
export function getAppUrl(): string {
  return requireConfig("EXPO_PUBLIC_APP_URL", "appUrl").replace(/\/$/, "");
}

export function getCloudinaryCloudName(): string {
  return requireConfig(
    "EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME",
    "cloudinaryCloudName",
  );
}
