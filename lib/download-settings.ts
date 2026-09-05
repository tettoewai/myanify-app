import { apiClient } from "./api";

export interface DownloadSettings {
  maxSongs: number;
  requireVip: boolean;
}

export const DEFAULT_DOWNLOAD_SETTINGS: DownloadSettings = {
  maxSongs: 100,
  requireVip: true,
};

let cached: { settings: DownloadSettings; at: number } | null = null;
const CACHE_TTL_MS = 60_000;

function normalize(raw: any): DownloadSettings {
  const n = Math.floor(Number(raw?.maxSongs));
  const maxSongs =
    Number.isFinite(n) && n > 0
      ? Math.min(n, 10000)
      : DEFAULT_DOWNLOAD_SETTINGS.maxSongs;
  return {
    maxSongs,
    requireVip:
      typeof raw?.requireVip === "boolean"
        ? raw.requireVip
        : DEFAULT_DOWNLOAD_SETTINGS.requireVip,
  };
}

/** Public endpoint — works without auth. Falls back to defaults offline. */
export async function getDownloadSettings(): Promise<DownloadSettings> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.settings;
  }
  try {
    const data = await apiClient.get("/download-settings");
    const settings = normalize(data);
    cached = { settings, at: Date.now() };
    return settings;
  } catch {
    return cached?.settings ?? { ...DEFAULT_DOWNLOAD_SETTINGS };
  }
}

export function invalidateDownloadSettingsCache(): void {
  cached = null;
}

export interface SubscriptionStatus {
  isVIP: boolean;
  downloadSettings?: DownloadSettings;
}

/** Authenticated — truthful VIP flag (server expires immediately on endDate). */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    const data = await apiClient.get("/vip/subscription");
    const settings = data?.downloadSettings
      ? normalize(data.downloadSettings)
      : await getDownloadSettings().catch(() => ({
          ...DEFAULT_DOWNLOAD_SETTINGS,
        }));
    return { isVIP: data?.isVIP === true, downloadSettings: settings };
  } catch {
    return { isVIP: false };
  }
}

/** Whether this user may play already-downloaded files right now. */
export async function isOfflinePlaybackAllowed(): Promise<boolean> {
  const [settings, sub] = await Promise.all([
    getDownloadSettings(),
    getSubscriptionStatus().catch(() => ({ isVIP: false })),
  ]);
  if (!settings.requireVip) return true;
  return sub.isVIP;
}
