import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  extractPathnameFromUrl,
  parseDeepLinkPath,
  type DeepLinkTarget,
} from "@/lib/deep-link";

/**
 * Handles incoming deep links (universal/app links and the "myanify://" scheme).
 *
 * - Captures the initial URL on cold start and subsequent URLs while running.
 * - When the user is authenticated, navigates immediately.
 * - Otherwise stores the target as `pending` so the auth flow can restore it
 *   after a successful sign-in instead of dropping the link.
 */
export function useDeepLink(isAuthenticated: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<DeepLinkTarget | null>(null);
  const authRef = useRef(isAuthenticated);
  const pendingRef = useRef<DeepLinkTarget | null>(null);

  authRef.current = isAuthenticated;

  const handleUrl = useCallback(
    (rawUrl?: string) => {
      if (!rawUrl) return;
      const pathname = extractPathnameFromUrl(rawUrl);
      const target = parseDeepLinkPath(pathname);
      if (!target) return;

      // Pre-auth flows (verify email / reset password) don't need a session —
      // open them immediately so email links work on a fresh install.
      if (target.publicAuth) {
        router.push(target.href);
        return;
      }

      pendingRef.current = target;
      setPending(target);

      if (authRef.current) {
        router.push(target.href);
      }
    },
    [router],
  );

  useEffect(() => {
    // Cold start: the URL that launched the app.
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Warm start: app already running when the link fires.
    const sub = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => sub.remove();
  }, [handleUrl]);

  // Navigate to a pending deep link as soon as the user becomes authenticated.
  useEffect(() => {
    if (isAuthenticated && pendingRef.current) {
      const target = pendingRef.current;
      pendingRef.current = null;
      setPending(null);
      router.push(target.href);
    }
  }, [isAuthenticated, router]);

  return { pending };
}
