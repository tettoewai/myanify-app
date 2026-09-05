import Constants from "expo-constants";
import * as nacl from "tweetnacl";

/**
 * Manifest signature verification (Ed25519, tweetnacl — pure JS, RN-safe).
 * Public key is baked at build time via EXPO_PUBLIC_RELEASE_PUBLIC_KEY.
 * - If no public key is configured: warn, accept manifest (upgrade path).
 * - If configured: reject manifests with missing/invalid signatures.
 */

export interface VerifiableManifest {
  version?: string;
  versionCode?: number;
  apkUrl?: string;
  mandatory?: boolean;
  fileSize?: number;
  md5?: string;
  sha256?: string;
  minVersionCode?: number;
  rollout?: number;
  certSha256?: string;
  signature?: string;
}

export function getReleasePublicKey(): string | null {
  const fromProcess = process.env.EXPO_PUBLIC_RELEASE_PUBLIC_KEY?.trim();
  if (fromProcess) return fromProcess;
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    releasePublicKey?: string;
  };
  return extra.releasePublicKey?.trim() ? extra.releasePublicKey.trim() : null;
}

export function getReleaseRepo(): string {
  const fromProcess = process.env.EXPO_PUBLIC_RELEASE_REPO?.trim();
  if (fromProcess) return fromProcess;
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    releaseRepo?: string;
  };
  return extra.releaseRepo?.trim() || "tettoewai/myanify-releases";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isAllowedApkUrl(apkUrl: string): boolean {
  try {
    const u = new URL(apkUrl);
    if (u.protocol !== "https:" || u.hostname !== "github.com") return false;
    const repo = getReleaseRepo();
    const pattern = new RegExp(
      `^/${escapeRegExp(repo)}/releases/download/[^/]+/[^/]+\\.apk(\\?.*)?$`,
    );
    return pattern.test(u.pathname);
  } catch {
    return false;
  }
}

function b64ToBytes(b64: string): Uint8Array {
  const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let clean = b64.trim();
  // Use global atob when available (RN Hermes has it); fallback to Buffer.
  try {
    if (typeof atob !== "undefined") {
      const bin = atob(clean);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      void base64Chars;
      return out;
    }
  } catch {
    // fall through
  }
  const Buf = (globalThis as { Buffer?: { from(s: string, e: string): Uint8Array } }).Buffer;
  if (Buf) return new Uint8Array(Buf.from(clean, "base64"));
  throw new Error("No base64 decoder available");
}

export function canonicalPayload(m: VerifiableManifest): string {
  return [
    m.version ?? "",
    String(m.versionCode ?? ""),
    m.apkUrl ?? "",
    m.fileSize ? String(m.fileSize) : "",
    (m.md5 ?? "").toLowerCase(),
    (m.sha256 ?? "").toLowerCase(),
    m.mandatory ? "1" : "0",
    m.minVersionCode ? String(m.minVersionCode) : "",
    m.rollout !== undefined ? String(m.rollout) : "",
    (m.certSha256 ?? "").toLowerCase().replace(/[^0-9a-f]/g, ""),
  ].join("\n");
}

/** Returns true if manifest is trusted (or no key configured yet). */
export function verifyManifest(m: VerifiableManifest): boolean {
  const pub = getReleasePublicKey();
  if (!pub) {
    console.warn("[update-verify] no EXPO_PUBLIC_RELEASE_PUBLIC_KEY — skipping signature check");
    return true;
  }
  if (!m.signature) {
    console.warn("[update-verify] manifest unsigned but public key configured — rejecting");
    return false;
  }
  try {
    const msg = new TextEncoder().encode(canonicalPayload(m));
    return nacl.sign.detached.verify(b64ToBytes(m.signature), msg, b64ToBytes(pub));
  } catch (e) {
    console.warn("[update-verify] verify failed:", e);
    return false;
  }
}

/** Deterministic 0-99 bucket for staged rollouts (stable per device+version). */
export async function rolloutBucket(deviceId: string, versionCode: number): Promise<number> {
  const msg = `${deviceId}:${versionCode}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return new Uint8Array(hash)[0] % 100;
}
