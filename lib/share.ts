import { getAppUrl } from "@/lib/env";
import { Share } from "react-native";

export type ShareableEntity = "song" | "album" | "artist" | "genre" | "playlist";

export interface ShareableEntityData {
  id: string;
  slug?: string | null;
}

/** Web-style path for a shareable entity (mirrors the web app's route structure). */
export function entityPath(type: ShareableEntity, slug: string): string {
  return `/${type}/${slug}`;
}

/** Returns the absolute web URL that can be shared and opened as a deep link. */
export function buildShareUrl(
  type: ShareableEntity,
  slug: string,
  origin?: string,
): string {
  const base = origin ?? getAppUrl();
  return new URL(entityPath(type, slug), base).href;
}

/** The path param used by the web/API is the slug when present, else the id. */
export function shareSlug(entity: ShareableEntityData): string {
  return entity.slug?.trim() || entity.id;
}

/**
 * Builds a shareable deep link for an entity and triggers the native share
 * sheet. Shared links open the web app in a browser and deep-link into the
 * mobile app via universal/app links on installed devices.
 */
export async function shareEntity(
  type: ShareableEntity,
  entity: ShareableEntityData,
  opts?: { title?: string; message?: string },
): Promise<void> {
  const url = buildShareUrl(type, shareSlug(entity));
  await Share.share({
    message: opts?.message ?? url,
    title: opts?.title,
    url,
  });
}
