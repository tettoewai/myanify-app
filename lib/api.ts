import { authStorage } from "./auth-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const apiClient = {
  async fetch(endpoint: string, options: RequestInit = {}) {
    const token = await authStorage.getToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("API request failed:", error);
      throw new Error(
        error.message || `API request failed with status ${response.status}`
      );
    }

    return response.json();
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
