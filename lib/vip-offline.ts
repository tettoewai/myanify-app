/**
 * VIP Offline Download Manager
 * 
 * Handles offline downloads for VIP users on mobile devices.
 * Uses expo-file-system for downloads and expo-secure-store for license storage.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { apiClient } from "./api";
import { authStorage } from "./auth-storage";
import {
  getDownloadSettings,
  getSubscriptionStatus,
  isOfflinePlaybackAllowed,
} from "./download-settings";
import { TRACKS_DIRECTORY } from "./offline-storage";

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}offline_downloads/`;
const LICENSE_KEY = "vip_license_key";
const DEVICE_ID_KEY = "device_id";

// Generate or retrieve device ID
export async function getDeviceId(): Promise<string> {
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate a unique device ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    deviceId = `${timestamp}-${random}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

// Get stored license key
export async function getLicenseKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(LICENSE_KEY);
}

// Store license key
export async function setLicenseKey(licenseKey: string): Promise<void> {
  await SecureStore.setItemAsync(LICENSE_KEY, licenseKey);
}

// Register device and get license
export async function registerDevice(deviceName?: string): Promise<{ deviceId: string; licenseKey: string }> {
  try {
    const deviceId = await getDeviceId();
    const deviceType = "MOBILE";
    
    const response = await apiClient.post("/vip/devices", {
      deviceId,
      deviceName: deviceName || "Mobile Device",
      deviceType,
    });
    
    if (response.device && response.licenseKey) {
      await setLicenseKey(response.licenseKey);
      return { deviceId, licenseKey: response.licenseKey };
    }
    
    throw new Error("Failed to register device");
  } catch (error) {
    console.error("Device registration error:", error);
    throw error;
  }
}

// Validate license for offline playback.
// When admin disables the VIP requirement, any signed-in user may download.
export async function validateLicense(): Promise<boolean> {
  try {
    const settings = await getDownloadSettings().catch(() => null);
    if (settings && !settings.requireVip) return true;

    const deviceId = await getDeviceId();
    const licenseKey = await getLicenseKey();
    
    if (!licenseKey) {
      return false;
    }
    
    const response = await apiClient.post("/vip/devices/validate", {
      deviceId,
      licenseKey,
    });
    
    return response.valid === true;
  } catch (error) {
    console.error("License validation error:", error);
    return false;
  }
}

// Ensure downloads directory exists
async function ensureDownloadsDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, {
      intermediates: true,
    });
  }
}

export interface DownloadProgress {
  songId: string;
  progress: number; // 0-100
  status: "pending" | "downloading" | "completed" | "failed" | "paused";
  fileUri?: string;
  error?: string;
}

// Download manager with progress tracking
export class OfflineDownloadManager {
  private downloads = new Map<string, FileSystem.DownloadResumable>();
  private progressCallbacks = new Map<string, (progress: DownloadProgress) => void>();

  async initiateDownload(songId: string, audioUrl: string, onProgress?: (progress: DownloadProgress) => void): Promise<string> {
    await ensureDownloadsDirectory();
    
    const fileUri = `${DOWNLOADS_DIR}${songId}.mp3`;
    
    // Check if already downloaded
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      return fileUri;
    }

    // Validate license before downloading (skipped when VIP not required)
    const isValid = await validateLicense();
    if (!isValid) {
      const settings = await getDownloadSettings().catch(() => null);
      if (settings && !settings.requireVip) {
        // Fall through — server still enforces the per-user cap.
      } else {
        throw new Error("Valid VIP license required for downloads");
      }
    }

    // Create API request to initiate download on server
    try {
      await apiClient.post("/vip/downloads", { songId });
    } catch (error) {
      console.error("Failed to initiate download on server:", error);
    }

    // Store progress callback
    if (onProgress) {
      this.progressCallbacks.set(songId, onProgress);
    }

    // Create download
    const downloadResumable = FileSystem.createDownloadResumable(
      audioUrl,
      fileUri,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        const progressPercent = Math.round(progress * 100);
        
        // Update server with progress
        this.updateDownloadProgress(songId, progressPercent).catch(console.error);
        
        // Notify callback
        const callback = this.progressCallbacks.get(songId);
        if (callback) {
          callback({
            songId,
            progress: progressPercent,
            status: "downloading",
          });
        }
      }
    );

    this.downloads.set(songId, downloadResumable);

    try {
      const result = await downloadResumable.downloadAsync();
      
      if (result?.uri) {
        // Update server - download completed
        await this.updateDownloadProgress(songId, 100);

        // Notify callback
        const callback = this.progressCallbacks.get(songId);
        if (callback) {
          callback({
            songId,
            progress: 100,
            status: "completed",
            fileUri: result.uri,
          });
        }

        this.downloads.delete(songId);
        this.progressCallbacks.delete(songId);
        
        return result.uri;
      } else {
        throw new Error("Download failed: No URI returned");
      }
    } catch (error: any) {
      // Update server - download failed
      await apiClient.patch(`/vip/downloads/${songId}`, {
        status: "FAILED",
      }).catch(console.error);

      const callback = this.progressCallbacks.get(songId);
      if (callback) {
        callback({
          songId,
          progress: 0,
          status: "failed",
          error: error.message || "Download failed",
        });
      }

      this.downloads.delete(songId);
      this.progressCallbacks.delete(songId);
      
      throw error;
    }
  }

  async pauseDownload(songId: string): Promise<void> {
    const download = this.downloads.get(songId);
    if (download) {
      await download.pauseAsync();
    }
  }

  async resumeDownload(songId: string): Promise<void> {
    const download = this.downloads.get(songId);
    if (download) {
      await download.resumeAsync();
    }
  }

  async cancelDownload(songId: string): Promise<void> {
    const download = this.downloads.get(songId);
    if (download) {
      await download.cancelAsync();
    }
    this.downloads.delete(songId);
    this.progressCallbacks.delete(songId);
  }

  async deleteDownload(songId: string): Promise<void> {
    const fileUri = `${DOWNLOADS_DIR}${songId}.mp3`;
    
    // Cancel if downloading
    await this.cancelDownload(songId);
    
    // Delete file
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }

    // Delete from server
    try {
      await apiClient.delete(`/vip/downloads/${songId}`);
    } catch (error) {
      console.error("Failed to delete download on server:", error);
    }
  }

  async getDownloadedFile(songId: string): Promise<string | null> {
    // Immediate block on VIP expiry: never hand out a local file when the
    // user is no longer entitled to offline playback.
    const allowed = await isOfflinePlaybackAllowed().catch(() => false);
    if (!allowed) return null;

    const fileUri = `${DOWNLOADS_DIR}${songId}.mp3`;
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    return fileInfo.exists ? fileUri : null;
  }

  getPendingIds(): string[] {
    return Array.from(this.downloads.keys());
  }

  async getAllDownloads(): Promise<string[]> {
    await ensureDownloadsDirectory();
    
    const files = await FileSystem.readDirectoryAsync(DOWNLOADS_DIR);
    return files.filter(file => file.endsWith('.mp3'));
  }

  private async updateDownloadProgress(songId: string, progress: number): Promise<void> {
    // Find download record ID from server (simplified - in production, store download IDs)
    try {
      const downloads = await apiClient.get("/vip/downloads");
      const download = downloads.downloads?.find((d: any) => d.songId === songId);
      if (download?.id) {
        await apiClient.patch(`/vip/downloads/${download.id}`, {
          progress,
          status: progress < 100 ? "DOWNLOADING" : "COMPLETED",
        });
      }
    } catch (error) {
      // Silently fail - progress updates are best effort
    }
  }
}

// Singleton instance
export const downloadManager = new OfflineDownloadManager();

/**
 * Wipe all offline data on logout: both download dirs (legacy
 * offline_tracks/ + offline_downloads/), per-song metadata sidecars,
 * and the device license key. Device ID is kept so re-login reuses it.
 */
export async function clearAllOfflineData(): Promise<void> {
  // Cancel in-flight downloads first.
  const pending = downloadManager.getPendingIds?.() ?? [];
  for (const songId of pending) {
    try {
      await downloadManager.cancelDownload(songId);
    } catch {
      // Best effort.
    }
  }

  for (const dir of [DOWNLOADS_DIR, TRACKS_DIRECTORY]) {
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      }
    } catch (error) {
      console.error("Error wiping offline directory:", dir, error);
    }
  }

  try {
    await SecureStore.deleteItemAsync(LICENSE_KEY);
  } catch {
    // No license stored — fine.
  }
}

export { getSubscriptionStatus, isOfflinePlaybackAllowed };
