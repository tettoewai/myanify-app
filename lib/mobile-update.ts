import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { apiClient } from "@/lib/api";
import { getVersionCode } from "@/lib/app-version";
import { isAllowedApkUrl, verifyManifest } from "@/lib/update-verify";

export interface MobileReleaseManifest {
  version?: string;
  versionCode?: number;
  apkUrl?: string;
  notes?: string;
  mandatory?: boolean;
  sha256?: string;
  md5?: string;
  fileSize?: number;
  minVersionCode?: number;
  rollout?: number;
  certSha256?: string;
  previousVersion?: string;
  previousVersionCode?: number;
  previousApkUrl?: string;
  signature?: string;
}

export interface ApkUpdateInfo {
  version: string;
  versionCode: number;
  apkUrl: string;
  notes: string;
  mandatory: boolean;
  available: boolean;
  sha256?: string;
  md5?: string;
  fileSize?: number;
  minVersionCode?: number;
  rollout?: number;
  certSha256?: string;
  previousVersion?: string;
  previousVersionCode?: number;
  previousApkUrl?: string;
}

export const EMPTY_APK_UPDATE: ApkUpdateInfo = {
  version: "",
  versionCode: 0,
  apkUrl: "",
  notes: "",
  mandatory: false,
  available: false,
};

export type ApkCheckResult =
  | {
      status: "ok";
      update: ApkUpdateInfo;
      currentVersionCode: number;
      latestVersionCode: number;
    }
  | {
      status: "rejected";
      reason: "apkUrl not allowlisted" | "bad manifest signature";
      currentVersionCode: number;
      latestVersionCode: number;
    }
  | { status: "none" };

const ROLLOUT_ID_KEY = "@myanify:rollout-id";

async function getRolloutId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(ROLLOUT_ID_KEY);
    if (existing) return existing;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(ROLLOUT_ID_KEY, id);
    return id;
  } catch {
    return "unknown";
  }
}

function rolloutEligible(
  rolloutId: string,
  versionCode: number,
  rollout: number,
): boolean {
  if (rollout >= 100) return true;
  if (rollout <= 0) return false;
  // FNV-1a 32-bit, deterministic per device+version (no WebCrypto dependency)
  let h = 0x811c9dc5;
  const s = `${rolloutId}:${versionCode}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100 < rollout;
}

export async function fetchUpdateManifest(): Promise<MobileReleaseManifest> {
  return (await apiClient.get("/mobile-update")) as MobileReleaseManifest;
}

/**
 * Shared APK availability check (Android only): fetches the release manifest,
 * enforces the allowlist + Ed25519 signature, applies the staged-rollout gate,
 * and compares `versionCode` against the installed build.
 *
 * Used by `useApkUpdate` (automatic checks) and Settings (manual
 * "Check for updates") so both paths apply identical rules.
 */
export async function fetchAvailableApkUpdate(): Promise<ApkCheckResult> {
  if (Platform.OS !== "android") return { status: "none" };

  const manifest = await fetchUpdateManifest();

  if (!manifest.versionCode || !manifest.apkUrl) {
    return { status: "none" };
  }

  const current = getVersionCode();

  // 1. Allowlist: only GitHub Release assets under our repo.
  if (!isAllowedApkUrl(manifest.apkUrl)) {
    console.warn("[mobile-update] rejected manifest: apkUrl not allowlisted");
    return {
      status: "rejected",
      reason: "apkUrl not allowlisted",
      currentVersionCode: current,
      latestVersionCode: manifest.versionCode,
    };
  }

  // 2. Signature: fail-closed once a public key is baked into the build.
  if (!verifyManifest(manifest)) {
    console.warn("[mobile-update] rejected manifest: bad/missing signature");
    return {
      status: "rejected",
      reason: "bad manifest signature",
      currentVersionCode: current,
      latestVersionCode: manifest.versionCode,
    };
  }

  const latest = manifest.versionCode;
  let available = latest > current;

  // 3. Staged rollout: deterministic per-device gate.
  if (available && manifest.rollout !== undefined && manifest.rollout < 100) {
    const rolloutId = await getRolloutId();
    if (!rolloutEligible(rolloutId, latest, manifest.rollout)) {
      available = false;
    }
  }

  // 4. Minimum supported build: below minVersionCode => forced update.
  const mandatory =
    !!manifest.mandatory ||
    (typeof manifest.minVersionCode === "number" &&
      manifest.minVersionCode > current &&
      latest > current);

  return {
    status: "ok",
    update: {
      version: manifest.version ?? "",
      versionCode: latest,
      apkUrl: manifest.apkUrl,
      notes: manifest.notes ?? "",
      mandatory,
      available,
      sha256: manifest.sha256,
      md5: manifest.md5,
      fileSize: manifest.fileSize,
      minVersionCode: manifest.minVersionCode,
      rollout: manifest.rollout,
      certSha256: manifest.certSha256,
      previousVersion: manifest.previousVersion,
      previousVersionCode: manifest.previousVersionCode,
      previousApkUrl: manifest.previousApkUrl,
    },
    currentVersionCode: current,
    latestVersionCode: latest,
  };
}

/** Current native build identity (for diagnostics / telemetry). */
export function getCurrentBuild(): {
  version: string;
  versionCode: number;
  applicationId: string | null;
} {
  return {
    version: Application.nativeApplicationVersion ?? "unknown",
    versionCode: getVersionCode(),
    applicationId: Application.applicationId,
  };
}
