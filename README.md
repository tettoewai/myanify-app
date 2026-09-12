# Myanify App

Expo (React Native) mobile app for Myanify — a music streaming platform for Myanmar music. Stream songs with synchronized lyrics, browse artists/albums, manage playlists, download for offline, and receive push notifications.

Pairs with the web backend/API: [tettoewai/myanify](https://github.com/tettoewai/myanify).

## Features

- **Playback** — Streaming player with queue, sleep timer, playback-rate, volume persistence
- **Offline downloads** — Device-licensed offline songs with self-update via GitHub Releases
- **Library** — Playlists, liked songs, listening history
- **Auth** — Email/password + Google sign-in, gated player for logged-out users
- **Push notifications** — FCM per-artist targeting with preferences
- **Deep links** — Public song/album/playlist links (`myanify://...`)
- **Spotify import** — PKCE login to import Spotify content (`myanify://auth/spotify`)

## Tech Stack

- [Expo](https://expo.dev/) ~54 / React Native 0.81 / React 19
- [expo-router](https://docs.expo.dev/router/introduction/) (file-based routing)
- [expo-audio](https://docs.expo.dev/versions/latest/sdk/audio/) (patched, see `patches/`)
- TanStack Query, AsyncStorage + SecureStore, Reanimated, Gorhom Bottom Sheet
- Tailwind CSS 4 via Uniwind

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/)
- Android Studio (Android emulator) and/or Xcode (iOS simulator)
- Running web backend (`EXPO_PUBLIC_API_URL`, default `http://localhost:3000/api`)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Yes | Backend API base, e.g. `http://localhost:3000/api` |
| `EXPO_PUBLIC_APP_URL` | Yes | Public site origin for stream proxy URLs |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name for artwork |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | No | Must match web `SPOTIFY_CLIENT_ID`; register `myanify://auth/spotify` redirect |
| `EXPO_PUBLIC_RELEASE_PUBLIC_KEY` | No | Ed25519 public key (`pnpm gen:release-keys` on web) |
| `EXPO_PUBLIC_RELEASE_REPO` | No | Self-update repo (default `tettoewai/myanify-releases`) |

> Android emulator maps `http://localhost:` → `http://10.0.2.2:` automatically (see `lib/env.ts`).

### 3. Firebase (push notifications)

1. Create a Firebase project and Android app.
2. Download `google-services.json` into the project root (gitignored — never commit).
3. Add SHA fingerprints as needed for Google Sign-In.

### 4. Start the dev server

```bash
pnpm start
# or
npx expo start
```

Open in a development build, Android emulator, iOS simulator, or Expo Go (limited sandbox).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm start` | Start Expo dev server |
| `pnpm android` / `pnpm ios` | Run on Android / iOS |
| `pnpm lint` | Run ESLint |
| `pnpm build:android-apk` | EAS internal APK (`production-apk` profile) |
| `pnpm build:android-aab` | EAS production AAB |

## Release signing

Release builds use local credentials (never commit real keys):

```bash
cp credentials.json.example credentials.json
# place keystore at android/app/release.keystore (gitignored)
```

See `RELEASE.md` and `eas.json` for profiles (`development`, `preview`, `production`, `production-apk`).

## Project Structure

```
app/
  (auth)/       # login, register
  (tabs)/       # home, search, library, settings
  album/ artist/ genre/ song/ playlist/  # detail routes
  player.tsx downloads.tsx liked-songs.tsx ...
components/player/  # player UI (MoreOptionsSheet, etc.)
hooks/          # useLockScreenPlayer, etc.
lib/            # API client, env, spotify-auth, storage
```

## License

MIT — see [LICENSE](LICENSE).
