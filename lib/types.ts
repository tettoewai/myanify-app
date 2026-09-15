export interface LyricLine {
  time: number;
  text: string;
}

export type QueueItemSource = "user-queue" | "playlist" | "radio" | "autoplay";

export interface QueueItem {
  qid: string;
  song: Song;
  source: QueueItemSource;
}

export interface Song {
  id: string;
  title: string;
  coverUrl: string;
  albumCoverUrl?: string | null;
  artistImageUrl?: string | null;
  artists: { artist: { name: string; imageUrl?: string | null } }[];
  artist?: string; // Comma-separated artist names for display
  album?: {
    id?: string;
    name?: string;
    coverUrl: string;
  };
  duration: number;
  audioUrl: string;
  /** Proxied stream URL (`/api/audio/stream`) with byte-range support. */
  playbackUrl?: string;
  genre?: string;
  language?: string | null;
  mood?: string | null;
  tags?: string[];
  _reason?: string | null;
  lyrics?: LyricLine[];
  isPremium?: boolean;
}

export interface Artist {
  id: string;
  name: string;
  imageUrl: string;
  bio?: string;
  monthlyListeners?: number;
  songs?: any[];
}

export interface Album {
  id: string;
  name: string;
  coverUrl: string;
  artistImageUrl?: string | null;
  type?: string | null;
  releaseDate?: string | null;
  description?: string | null;
  songs?: any[];
  _count?: { songs: number };
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl: string;
  songs: Song[];
  createdBy?: string | { id: string; name: string; email: string };
  isPublic?: boolean;
  createdAt?: string | Date;
}

export interface Genre {
  id: string;
  slug?: string;
  name: string;
  imageUrl: string;
  description?: string;
}
