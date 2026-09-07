import * as Application from "expo-application";
import Constants from "expo-constants";

/**
 * Single source of truth for the user-visible app version.
 *
 * Reads the real native build values first (`nativeApplicationVersion` /
 * `nativeBuildVersion`), falling back to the Expo config version so Expo Go
 * and dev clients still show something sensible. Never hard-code a version
 * string in UI — import from here instead.
 */
export function getAppVersion(): string {
  return (
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    "0.0.0"
  );
}

/** Android `versionCode` / iOS build number, `0` when unavailable. */
export function getVersionCode(): number {
  return parseInt(Application.nativeBuildVersion ?? "0", 10) || 0;
}

/** e.g. `1.0.9 (22)` — used anywhere the version is displayed. */
export function getVersionLabel(): string {
  const code = getVersionCode();
  const version = getAppVersion();
  return code > 0 ? `${version} (${code})` : version;
}
