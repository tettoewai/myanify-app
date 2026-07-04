/** Matches web lyrics-scroll-fade mask stops. */
export const LYRICS_MASK_FADE_START = 0.14;
export const LYRICS_MASK_FADE_END = 0.86;

/** Opacity multiplier for a point in the scroll viewport (same curve as web CSS mask). */
export function getLyricsScrollMaskOpacity(
  y: number,
  viewportHeight: number,
): number {
  if (viewportHeight <= 0) return 1;

  const fadeStart = viewportHeight * LYRICS_MASK_FADE_START;
  const fadeEnd = viewportHeight * LYRICS_MASK_FADE_END;

  if (y <= 0 || y >= viewportHeight) return 0;
  if (y < fadeStart) return y / fadeStart;
  if (y > fadeEnd) return (viewportHeight - y) / (viewportHeight - fadeEnd);
  return 1;
}

/** Combine top/bottom edge opacities for a lyric row spanning [top, bottom]. */
export function getLyricsRowMaskOpacity(
  top: number,
  bottom: number,
  viewportHeight: number,
): number {
  const topOpacity = getLyricsScrollMaskOpacity(top, viewportHeight);
  const bottomOpacity = getLyricsScrollMaskOpacity(bottom, viewportHeight);
  return Math.min(topOpacity, bottomOpacity);
}
