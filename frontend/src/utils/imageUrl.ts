

const PLACEHOLDER_300 = 'https://placehold.co/300x300?text=No+Image';
const PLACEHOLDER_400 = 'https://placehold.co/400x300?text=No+Image';
const PLACEHOLDER_150 = 'https://placehold.co/150x150?text=No+Image';

/**
 * Centralized image URL resolver for menu items.
 *
 * Resolution order:
 *   1. item.imageFilename — preferred source
 *   2. item.images[0].image — legacy ImageItem fallback
 *
 * If the resolved filename is a full Cloudinary URL (starts with "http"),
 * it is returned directly. Otherwise the filename is a legacy local reference
 * (e.g. "anh(1).jpg", "tarts_annam_gourmet.jpg") that no longer exists on
 * Railway containers — return the placeholder instead to avoid 404 spam.
 */
export function resolveImageUrl(
  item: { imageFilename?: string | null; images?: { image: string }[] } | null | undefined,
  placeholder: string = PLACEHOLDER_300,
): string {
  if (!item) return placeholder;

  const filename =
    item.imageFilename ||
    (item.images && item.images.length > 0 ? item.images[0].image : null);

  if (!filename) return placeholder;

  // Cloudinary URLs (or any full URL) — use directly
  if (filename.startsWith('http')) return filename;

  // Legacy local filename — show placeholder, never request /uploads/
  return placeholder;
}

/**
 * Shorthand for the "small" placeholder variant (used in CartItem, etc.)
 */
export function resolveImageUrlSmall(
  item: { imageFilename?: string | null; images?: { image: string }[] } | null | undefined,
): string {
  return resolveImageUrl(item, PLACEHOLDER_150);
}

/**
 * Shorthand for the "large" placeholder variant (used in AdminView, etc.)
 */
export function resolveImageUrlLarge(
  item: { imageFilename?: string | null; images?: { image: string }[] } | null | undefined,
): string {
  return resolveImageUrl(item, PLACEHOLDER_400);
}
