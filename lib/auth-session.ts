/** Called when the API returns 401 — token cleared, user should sign in again. */
type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized() {
  unauthorizedHandler?.();
}

export function isProtectedRoute(segments: string[]): boolean {
  if (segments[0] === "(tabs)") {
    return true;
  }

  const protectedRoots = new Set([
    "player",
    "artist",
    "playlist",
    "liked-songs",
  ]);

  return segments.some((segment) => protectedRoots.has(segment));
}
