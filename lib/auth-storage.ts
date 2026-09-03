import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "myanify_auth_token";

// In-memory cache to avoid race where parallel fetches fire before SecureStore resolves.
// Keeps apiClient from sending unauthenticated requests intermittently.
let cachedToken: string | null | undefined = undefined; // undefined = not yet loaded
let cacheReady: Promise<string | null> | null = null;

async function ensureCache(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  if (cacheReady) return cacheReady;
  cacheReady = SecureStore.getItemAsync(TOKEN_KEY)
    .then((v) => {
      cachedToken = v;
      return v;
    })
    .catch((error) => {
      console.error("Error getting token:", error);
      cachedToken = null;
      return null;
    })
    .finally(() => {
      cacheReady = null;
    });
  return cacheReady;
}

// Warm cache eagerly on import (non-blocking)
void ensureCache();

export const authStorage = {
  async setToken(token: string) {
    cachedToken = token;
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
      console.error("Error saving token:", error);
    }
  },

  async getToken() {
    if (cachedToken !== undefined) return cachedToken;
    return ensureCache();
  },

  /** Sync getter for hot paths – returns cached value without I/O if available */
  getCachedToken(): string | null | undefined {
    return cachedToken;
  },

  async removeToken() {
    cachedToken = null;
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error("Error removing token:", error);
    }
  },

  /** Force refresh from SecureStore (useful after app foreground) */
  async refreshCache(): Promise<string | null> {
    cachedToken = undefined;
    return ensureCache();
  },
};
