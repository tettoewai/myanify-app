# Mobile Release & Self-Update (no Play Store)

Side-loaded Android APK + in-app updater backed by **GitHub Releases**
(`tettoewai/myanify-releases`, configurable via `RELEASE_REPO`).

Two channels:

1. **OTA (JS-only)** — `expo-updates` (EAS Update, channel `production`).
   `hooks/useUpdateCheck.ts` + `UpdateModal`. No reinstall.
2. **Binary APK (native changes)** — `hooks/useApkUpdate.ts` fetches
   `GET /api/mobile-update`, compares `versionCode`, downloads the APK from
   `github.com/<repo>/releases/download/...`, verifies, fires the installer.

## Manifest

`GET /api/mobile-update` serves (in order):

1. `MobileRelease` DB row (highest active `versionCode`) — updatable at
   runtime, **no web redeploy needed**.
2. `myanify/mobile-release.json` file fallback (seed / disaster recovery).

Shape (`myanify/lib/mobile-release.ts`):

```json
{
  "version": "1.0.9", "versionCode": 22,
  "apkUrl": "https://github.com/tettoewai/myanify-releases/releases/download/v1.0.9/....apk",
  "notes": "...", "mandatory": false,
  "sha256": "...", "md5": "...", "fileSize": 123456,
  "minVersionCode": 1, "rollout": 100,
  "certSha256": "<apksigner fingerprint>",
  "previousVersion": "1.0.8", "previousVersionCode": 21, "previousApkUrl": "...",
  "signature": "<base64 Ed25519>"
}
```

Security:

- `apkUrl` allowlisted to `https://github.com/<RELEASE_REPO>/releases/download/...`
  on server **and** client (`lib/update-verify.ts`). A compromised manifest
  alone can't redirect downloads elsewhere.
- Ed25519 `signature` over the canonical payload. Generate with
  `cd ../myanify && pnpm gen:release-keys`, put the public key in
  `myanify-app/.env` as `EXPO_PUBLIC_RELEASE_PUBLIC_KEY`. Once baked in,
  unsigned/tampered manifests are rejected fail-closed.
- On-device file check: exact `fileSize` + `md5` (fail-closed).
  OS-level signer check still applies (same keystore required for updates).

## One-command release (normal path)

```bash
cd myanify
./scripts/release-apk.sh 1.0.9 --notes "Fix X" [--mandatory] [--rollout 25]
```

Does: `bump-mobile-version` (app.json + package.json lockstep) → `eas build
--local --profile production-apk` → `aapt`/`apksigner` verify → `upload:apk`
(create GitHub release, sign manifest, update `mobile-release.json`,
`POST /api/mobile-update` with `RELEASE_ADMIN_TOKEN` so production updates
**without redeploy**).

Manual equivalent:

```bash
cd myanify-app
eas build --platform android --profile production-apk --local \
  --output /tmp/myanify_1_0_9.apk --non-interactive
aapt dump badging /tmp/myanify_1_0_9.apk | head -n 1
apksigner verify --print-certs /tmp/myanify_1_0_9.apk
cd ../myanify
pnpm upload:apk /tmp/myanify_1_0_9.apk --cert-sha256 <fp> --notes "..."
# without RELEASE_ADMIN_TOKEN set, deploy web to publish mobile-release.json
```

OTA-only:

```bash
cd myanify-app
eas update --channel production --message "..."
```

## Signing keys (important)

- `credentials.json` currently points at the **debug keystore** — migrate:
  `./scripts/gen-release-keystore.sh`, fill `credentials.json` from
  `credentials.json.example`, back up keystore + passwords off-machine.
  Losing it = users must reinstall (Android rejects signer change as update).
- Manifest signing is separate: `pnpm gen:release-keys` (web repo).
  Private → `myanify/.env.local` (`RELEASE_SIGNING_PRIVATE_KEY`),
  public → `myanify-app/.env` + `.env.production`.
- Record `apksigner` SHA-256 as `RELEASE_CERT_SHA256` for manual verification.

## Rollouts & rollbacks

- `--rollout 25` gates to 25% of devices (deterministic per-device bucket).
- `--min-version-code N` forces everyone below N to update even if
  `mandatory: false`.
- Rollback: republish previous `apkUrl` via `POST /api/mobile-update`
  (or `upload:apk --force` with the old version bumped), or point users at
  `previousApkUrl` stored in the manifest.

## Telemetry

Client reports `check/available/download_start/download_complete/download_error/
install_prompt` to `POST /api/mobile-update/events` (no PII). Query
`MobileUpdateEvent` for adoption by `latestVersionCode`.

## Size

`expo-build-properties` enables Proguard + shrinkResources in release builds.
Keep binary updates rare (OTA-first); full APK is still ~100MB+.
Per-ABI splits would need per-ABI `apkUrl`s — not implemented (complexity).
