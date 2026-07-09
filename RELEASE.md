# Mobile Release & Self-Update

The Expo app (`myanify-app`) is distributed **without the Play Store** (no Google/Apple
developer account). Users side-load the Android APK and update it from **inside the app**.

There are two update channels:

1. **OTA (JS-only changes)** — handled by `expo-updates` (EAS Update). No reinstall needed.
   Wired in `myanify-app/hooks/useUpdateCheck.ts` and surfaced via `UpdateModal`.
2. **Binary APK (native changes)** — handled by `myanify-app/hooks/useApkUpdate.ts`. The app
   fetches a manifest from the web backend and, when a newer `versionCode` is available, prompts
   the user to download and install the new APK. iOS is out of scope (no self-install without
   the App Store).

## How the binary check works

- `GET /api/mobile-update` (web app) returns `mobile-release.json`:
  ```json
  { "version": "1.0.2", "versionCode": 3, "apkUrl": "<cloudinary-url>", "notes": "...", "mandatory": false }
  ```
- On launch, `useApkUpdate` compares `Application.nativeBuildVersion` (the APK's `versionCode`)
  with `manifest.versionCode`. If `latest > current`, the `UpdateModal` appears.
- `Download & install` downloads the APK to the cache, obtains a content URI, and launches the
  Android package installer (`ACTION_INSTALL_PACKAGE`). If the "Install unknown apps" permission
  is missing, the app opens the system settings for it.

## Releasing a JS-only update (OTA)

```bash
cd myanify-app
eas update --channel production --message "Describe the change"
```

Existing installs pick this up automatically via `expo-updates` — no new APK needed.
(Keep `app.json` `version` unchanged so `runtimeVersion` stays the same.)

## Releasing a new APK (binary update)

> Note: `eas.json` uses `"appVersionSource": "remote"`, so EAS controls `version`/`versionCode`.
> Read the built `versionCode` from the EAS build output and use it below.

1. Build the standalone APK:
   ```bash
   cd myanify-app
   pnpm build:android-apk        # eas build --platform android --profile production-apk
   ```
2. Upload the APK to Cloudinary (prints the hosted URL):
   ```bash
   cd ../myanify
   pnpm upload:apk /path/to/myanify-app.apk
   ```
3. Edit `myanify/mobile-release.json`: set `version`, `versionCode` (from the EAS build),
   `apkUrl` (from step 2), `notes`, and `mandatory` if the update is required.
4. Ship the backend (the `/api/mobile-update` route reads this file).

On next app launch, side-loaded installs see the `UpdateModal` and install the new APK in-place.

## Security notes

- Both the manifest (API) and the APK (Cloudinary) are served over HTTPS.
- APKs are signed by EAS credentials, so installs are trusted by the device.
- For extra safety, verify the downloaded file size (or a `sha256` you add to the manifest)
  before launching the installer.
