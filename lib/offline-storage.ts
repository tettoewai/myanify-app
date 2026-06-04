import * as FileSystem from "expo-file-system/legacy";

export const TRACKS_DIRECTORY = `${FileSystem.documentDirectory}offline_tracks/`;

export const offlineStorage = {
  async ensureDirectoryExists() {
    const dirInfo = await FileSystem.getInfoAsync(TRACKS_DIRECTORY);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(TRACKS_DIRECTORY, {
        intermediates: true,
      });
    }
  },

  async downloadTrack(trackId: string, url: string) {
    await this.ensureDirectoryExists();
    const fileUri = `${TRACKS_DIRECTORY}${trackId}.mp3`;

    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      fileUri,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
      },
    );

    try {
      const result = await downloadResumable.downloadAsync();
      return result?.uri;
    } catch (error) {
      console.error("Error downloading track:", error);
      return null;
    }
  },

  async getTrackUri(trackId: string) {
    const fileUri = `${TRACKS_DIRECTORY}${trackId}.mp3`;
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    return fileInfo.exists ? fileUri : null;
  },

  async deleteTrack(trackId: string) {
    const fileUri = `${TRACKS_DIRECTORY}${trackId}.mp3`;
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error("Error deleting track:", error);
    }
  },

  async clearAllTracks() {
    try {
      await FileSystem.deleteAsync(TRACKS_DIRECTORY, { idempotent: true });
    } catch (error) {
      console.error("Error clearing tracks:", error);
    }
  },
};
