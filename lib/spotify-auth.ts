import Constants from "expo-constants";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

/**
 * Master switch for "Login with Spotify" in the mobile app.
 * Currently DISABLED — Spotify login requires a Spotify Premium-eligible
 * app setup. Google + email login keep working.
 * To re-enable: set to `true`. No other changes needed (buttons, handlers
 * and the server endpoint all check this flag).
 */
export const SPOTIFY_LOGIN_ENABLED = false;

const discovery = {
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
};

export const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "user-top-read",
];

export function getSpotifyClientId(): string | null {
  const fromProcess = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID?.trim();
  if (fromProcess) return fromProcess;
  const extra = Constants.expoConfig?.extra as
    | { spotifyClientId?: string }
    | undefined;
  return extra?.spotifyClientId?.trim() || null;
}

/** Custom-scheme redirect handled by the native app (`myanify://auth/spotify`).
 * This exact URI must be registered in the Spotify developer dashboard,
 * otherwise Spotify never redirects back and the auth response stays null
 * (or `dismiss`). */
export function getSpotifyRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: "myanify",
    path: "auth/spotify",
  });
}

export function useSpotifyAuthRequest() {
  const clientId = getSpotifyClientId();
  const redirectUri = getSpotifyRedirectUri();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? "",
      scopes: SPOTIFY_SCOPES,
      redirectUri,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery,
  );

  // `request` is null until expo-auth-session finishes generating the PKCE
  // verifier + auth URL. Prompting before then throws and `response` stays
  // null, so callers must gate on `isReady`.
  return {
    request,
    response,
    promptAsync,
    clientId,
    redirectUri,
    discovery,
    isReady: request != null,
  };
}

export type SpotifyAuthSuccess = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
};

/** Extract the PKCE code exchange params from an AuthSession result.
 * Returns null when the result is not a successful code response
 * (dismissed/cancelled/errored, or missing code/verifier). */
export function getSpotifyAuthSuccess(
  result: AuthSession.AuthSessionResult | null | undefined,
  request: AuthSession.AuthRequest | null,
  redirectUri: string,
): SpotifyAuthSuccess | null {
  if (
    result?.type === "success" &&
    "code" in (result.params ?? {})
  ) {
    const code = (result.params as { code?: unknown }).code;
    const codeVerifier = request?.codeVerifier;
    if (typeof code === "string" && code && codeVerifier) {
      return { code, codeVerifier, redirectUri };
    }
  }
  return null;
}
