import { useMemo, useState, useEffect, useRef } from 'react';
import type { LyricLine } from '@/lib/types';

// Lead time to make lyrics feel more on-beat (in seconds)
export const SYNC_LEAD_SECONDS = 0.12;

// Binary search to find the correct lyric index for a given time
export function findLyricIndexByTime(
    lyrics: { text: string; time: number }[],
    time: number,
): number {
    if (!lyrics.length) return -1;

    let lo = 0;
    let hi = lyrics.length - 1;

    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lyrics[mid].time <= time) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    return Math.max(0, lo - 1);
}

export function useSyncedLyrics(
    lyrics: LyricLine[],
    currentTime: number,
    audioRef?: React.RefObject<any>,
    songId?: string,
) {
    const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
    const [seekToken, setSeekToken] = useState(0);
    const previousSongIdRef = useRef<string | undefined>(songId);
    const normalizedLyrics = useMemo(
        () => lyrics.map((line) => ({ ...line, time: Math.max(0, line.time) })),
        [lyrics],
    );

    useEffect(() => {
        if (!lyrics.length) {
            setCurrentLyricIndex(-1);
            return;
        }

        const targetTime = Math.max(0, currentTime + SYNC_LEAD_SECONDS);
        const index = findLyricIndexByTime(normalizedLyrics, targetTime);

        if (index !== currentLyricIndex) {
            setCurrentLyricIndex(index);
        }
    }, [normalizedLyrics, lyrics.length, currentTime, currentLyricIndex]);

    // Reset when song changes
    useEffect(() => {
        if (songId && songId !== previousSongIdRef.current) {
            setCurrentLyricIndex(-1);
            setSeekToken(prev => prev + 1);
            previousSongIdRef.current = songId;
        }
    }, [songId]);

    return { currentLyricIndex, seekToken };
}