import type { QueueItem, QueueItemSource, Song } from "./types";

export function createQueueItem(
  song: Song,
  source: QueueItemSource = "user-queue",
): QueueItem {
  return {
    qid: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    song,
    source,
  };
}

export function createQueueItems(
  songs: Song[],
  source: QueueItemSource = "playlist",
): QueueItem[] {
  return songs.map((song) => createQueueItem(song, source));
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function shuffleUpNext(items: QueueItem[]): QueueItem[] {
  const pinned = items.filter((i) => i.source === "user-queue");
  const rest = shuffleArray(items.filter((i) => i.source !== "user-queue"));
  return [...pinned, ...rest];
}

export function reorderQueueItems(
  items: QueueItem[],
  fromIndex: number,
  toIndex: number,
): QueueItem[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }
  const next = [...items];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

export const MAX_PLAY_HISTORY = 50;
export const RADIO_REFETCH_THRESHOLD = 3;
export const RADIO_BATCH_SIZE = 10;
export const UP_NEXT_STORAGE_KEY = "myanify_upnext";

export type PersistedQueueEntry = {
  songId: string;
  source: QueueItemSource;
};

export function serializeUserUpNext(items: QueueItem[]): PersistedQueueEntry[] {
  return items
    .filter((i) => i.source !== "radio" && i.source !== "autoplay")
    .map((i) => ({ songId: i.song.id, source: i.source }));
}

export function restoreUserUpNext(
  entries: PersistedQueueEntry[],
  resolveSong: (id: string) => Song | undefined,
): QueueItem[] {
  const restored: QueueItem[] = [];
  for (const entry of entries) {
    const song = resolveSong(entry.songId);
    if (song) restored.push(createQueueItem(song, entry.source));
  }
  return restored;
}

export function pickAutoplaySongs(
  catalog: Song[],
  recentlyPlayed: Song[],
  excludeIds: Iterable<string>,
  seedId: string | null,
  limit: number,
): Song[] {
  const exclude = new Set(excludeIds);
  if (seedId) exclude.add(seedId);

  const pool = new Map<string, Song>();
  for (const s of [...recentlyPlayed, ...catalog]) {
    if (!exclude.has(s.id)) pool.set(s.id, s);
  }

  if (pool.size === 0) {
    for (const s of [...recentlyPlayed, ...catalog]) {
      if (!seedId || s.id !== seedId) pool.set(s.id, s);
    }
  }

  return shuffleArray([...pool.values()]).slice(0, limit);
}
