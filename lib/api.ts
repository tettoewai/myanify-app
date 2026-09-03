import { authStorage } from "./auth-storage";
import { notifyUnauthorized } from "./auth-session";
import { getApiBaseUrl } from "./env";

const API_URL = getApiBaseUrl();

const NETWORK_ERROR_MESSAGE =
  "Unable to connect to Myanify. Check your internet connection and try again.";

export const apiClient = {
  async fetch(endpoint: string, options: RequestInit = {}) {
    // Use in-memory cache to avoid race where parallel requests fire before SecureStore resolves
    const cached = authStorage.getCachedToken();
    const token =
      cached !== undefined ? cached : await authStorage.getToken();
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    if (!API_URL) {
      console.error("API_URL is not defined in environment variables");
      throw new Error("API configuration missing");
    }

    // Helper to do fetch with one transient retry for Neon cold-start / Vercel warm-up (500/502/503/504)
    const doFetch = async (retry = 0): Promise<Response> => {
      const res = await fetch(`${API_URL}${cleanEndpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
        // Force fresh response for API (avoid stale HTML cache on 403)
        cache: "no-store",
      });
      if (
        retry === 0 &&
        [502, 503, 504].includes(res.status) &&
        !cleanEndpoint.includes("/auth/")
      ) {
        await new Promise((r) => setTimeout(r, 400));
        return doFetch(1);
      }
      return res;
    };

    try {
      const response = await doFetch();

      if (!response.ok) {
        let errorData;
        const responseText = await response.text();
        try {
          errorData = JSON.parse(responseText);
        } catch {
          const isHtml = responseText.trimStart().startsWith("<");
          const lower = responseText.toLowerCase();
          const isVercelProtection =
            lower.includes("authentication required") ||
            lower.includes("deployment protection");
          if (isHtml) {
            if (response.status === 403 && isVercelProtection) {
              errorData = {
                message: `Access denied by deployment protection (403): ${endpoint} – check Vercel protection bypass`,
              };
            } else if (response.status === 403 || response.status === 401) {
              errorData = {
                message:
                  response.status === 403
                    ? `Access denied (403): ${endpoint} – token missing/expired or not admin`
                    : `Unauthorized (401): ${endpoint} – please sign in again`,
              };
            } else {
              errorData = {
                message: `Server returned HTML (status ${response.status}): ${endpoint}`,
              };
            }
            // Attach snippet for diagnostics (truncated)
            (errorData as any).htmlSnippet = responseText.slice(0, 500);
          } else {
            errorData = { message: responseText || response.statusText };
          }
        }

        const isAuthError =
          response.status === 401 || response.status === 403;

        // Only clear token on 401 (expired/invalid). 403 means “forbidden” (role) – keep token.
        if (response.status === 401 && token) {
          await authStorage.removeToken();
          notifyUnauthorized();
        }

        if (errorData.message?.includes("Tunnel")) {
          errorData.message = NETWORK_ERROR_MESSAGE;
        }

        // Only log non-auth or unexpected HTML
        const isHtmlAuth = response.status === 403;
        if (!isAuthError || isHtmlAuth) {
          console.error("API request failed:", {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            endpoint,
            hasToken: !!token,
          });
        }

        throw new Error(
          (errorData.message || errorData.error) ||
            `API request failed with status ${response.status}: ${response.statusText}`,
        );
      }

      const responseText = await response.text();
      try {
        return JSON.parse(responseText);
      } catch (e) {
        return responseText;
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown request error";
      const isNetworkFailure =
        error instanceof TypeError ||
        /network request failed|failed to fetch|network error/i.test(message);

      if (!isNetworkFailure) {
        throw error;
      }

      const helpfulMessage = NETWORK_ERROR_MESSAGE;

      console.error("Network Fetch Error Details:", {
        message,
        url: `${API_URL}${cleanEndpoint}`,
        apiUrl: API_URL,
        hasToken: !!token,
      });
      const enhancedError = new Error(helpfulMessage);
      (enhancedError as { originalError?: unknown }).originalError = error;
      throw enhancedError;
    }
  },

  async get(endpoint: string) {
    return this.fetch(endpoint, { method: "GET" });
  },

  async post(endpoint: string, body: any) {
    return this.fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async put(endpoint: string, body: any) {
    return this.fetch(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  async patch(endpoint: string, body: any) {
    return this.fetch(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  async delete(endpoint: string) {
    return this.fetch(endpoint, { method: "DELETE" });
  },
};
