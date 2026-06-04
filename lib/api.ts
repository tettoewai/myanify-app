import { authStorage } from "./auth-storage";
import { notifyUnauthorized } from "./auth-session";
import { getApiBaseUrl } from "./env";

const API_URL = getApiBaseUrl();

export const apiClient = {
  async fetch(endpoint: string, options: RequestInit = {}) {
    const token = await authStorage.getToken();
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    if (!API_URL) {
      console.error("API_URL is not defined in environment variables");
      throw new Error("API configuration missing");
    }

    try {
      const response = await fetch(`${API_URL}${cleanEndpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      if (!response.ok) {
        let errorData;
        const responseText = await response.text();
        try {
          errorData = JSON.parse(responseText);
        } catch {
          const isHtml = responseText.trimStart().startsWith("<");
          errorData = {
            message: isHtml
              ? `API route not found (${response.status}): ${endpoint}`
              : responseText,
          };
        }

        const isAuthError = response.status === 401;

        if (isAuthError && token) {
          await authStorage.removeToken();
          notifyUnauthorized();
        }

        if (errorData.message?.includes("Tunnel")) {
          errorData.message =
            "The API server is unreachable. Please ensure your backend is running and the API_URL in your .env file is correct.";
        }

        // Only log non-auth errors
        if (!isAuthError) {
          console.error("API request failed:", {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            endpoint,
          });
        }

        throw new Error(
          errorData.message ||
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

      const helpfulMessage =
        "The API server is unreachable. Please ensure your backend is running and the API_URL in your .env file is correct.";

      console.error("Network Fetch Error Details:", {
        message,
        url: `${API_URL}${cleanEndpoint}`,
        apiUrl: API_URL,
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
