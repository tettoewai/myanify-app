import Constants from "expo-constants";
import { authStorage } from "./auth-storage";

// Try to get API_URL from environment variable first (for development),
// then fall back to app.json config (for builds)
const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl
)?.replace(/\/$/, "");

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
        } catch (e) {
          errorData = { message: responseText };
        }

        // Don't log 401 errors - they're expected when user is not authenticated
        const isAuthError = response.status === 401;

        if (
          errorData.message?.includes("Tunnel") ||
          errorData.message?.includes("not found")
        ) {
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
            `API request failed with status ${response.status}: ${response.statusText}`
        );
      }

      const responseText = await response.text();
      try {
        return JSON.parse(responseText);
      } catch (e) {
        return responseText;
      }
    } catch (networkError: any) {
      const helpfulMessage =
        "The API server is unreachable. Please ensure your backend is running and the API_URL in your .env file is correct.";

      // Don't log network errors for 401 responses (auth errors)
      const isAuthError =
        networkError.message?.includes("401") ||
        networkError.message?.includes("Unauthorized");

      if (!isAuthError) {
        console.error("Network Fetch Error Details:", {
          message: networkError.message,
          helpfulMessage: helpfulMessage,
          stack: networkError.stack,
          originalError: networkError.message,
        });
        const enhancedError = new Error(helpfulMessage);
        (enhancedError as any).originalError = networkError;
        throw enhancedError;
      }
      throw networkError;
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
