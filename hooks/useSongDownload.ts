import { useCallback, useEffect, useState } from "react";
import { downloadManager, DownloadProgress } from "@/lib/vip-offline";
import { getDownloadSettings, isOfflinePlaybackAllowed } from "@/lib/download-settings";
import { useAuth } from "@/context/AuthContext";

type Status = "idle" | "downloading" | "completed" | "failed" | "not-allowed";

function mapStatus(s: DownloadProgress["status"]): Status {
  if (s === "pending" || s === "paused") return "downloading";
  return s;
}

export interface DownloadState {
  status: Status;
  progress: number;
  error?: string;
}

export function useSongDownload(songId: string, audioUrl: string) {
  const { token } = useAuth();
  const [state, setState] = useState<DownloadState>({ status: "idle", progress: 0 });
  const [isDownloaded, setIsDownloaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!songId || !token) {
      setIsDownloaded(false);
      return false;
    }
    const allowed = await isOfflinePlaybackAllowed().catch(() => false);
    if (!allowed) {
      setIsDownloaded(false);
      setState((s) =>
        s.status === "downloading" ? s : { status: "not-allowed", progress: 0 },
      );
      return false;
    }
    const file = await downloadManager.getDownloadedFile(songId);
    const downloaded = !!file;
    setIsDownloaded(downloaded);
    if (downloaded) {
      setState({ status: "completed", progress: 100 });
    }
    return downloaded;
  }, [songId, token]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!token) {
        setState({ status: "not-allowed", progress: 0 });
        return;
      }
      const allowed = await isOfflinePlaybackAllowed().catch(() => false);
      if (!allowed) {
        if (mounted) setState({ status: "not-allowed", progress: 0 });
        return;
      }
      const file = await downloadManager.getDownloadedFile(songId);
      if (mounted) {
        setIsDownloaded(!!file);
        if (file) setState({ status: "completed", progress: 100 });
      }
    };
    check();
    return () => { mounted = false; };
  }, [songId, token]);

  const download = useCallback(async () => {
    if (!token) {
      setState({ status: "not-allowed", progress: 0, error: "Sign in required" });
      return;
    }
    const allowed = await isOfflinePlaybackAllowed().catch(() => false);
    if (!allowed) {
      const settings = await getDownloadSettings().catch(() => null);
      setState({
        status: "not-allowed",
        progress: 0,
        error: settings?.requireVip ? "VIP required for downloads" : "Downloads not allowed",
      });
      return;
    }
    if (isDownloaded) return;
    setState({ status: "downloading", progress: 0 });
    try {
      await downloadManager.initiateDownload(songId, audioUrl, (p) => {
        setState({ status: mapStatus(p.status), progress: p.progress, error: p.error });
        if (p.status === "completed") setIsDownloaded(true);
      });
    } catch (e: any) {
      setState({ status: "failed", progress: 0, error: e.message });
    }
  }, [songId, audioUrl, token, isDownloaded]);

  const remove = useCallback(async () => {
    await downloadManager.deleteDownload(songId);
    setIsDownloaded(false);
    setState({ status: "idle", progress: 0 });
  }, [songId]);

  return { state, isDownloaded, download, remove, refresh };
}