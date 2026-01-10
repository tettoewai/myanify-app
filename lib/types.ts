export interface LyricLine {
  time: number;
  text: string;
}

export interface Song {
  id: string;
  title: string;
  coverUrl: string;
  albumCoverUrl?: string | null;
  artists: { artist: { name: string } }[];
  artist?: string; // Comma-separated artist names for display
  album?: {
    id?: string;
    name?: string;
    coverUrl: string;
  };
  duration: number;
  audioUrl: string;
  genre?: string;
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
  name: string;
  imageUrl: string;
  description?: string;
}
