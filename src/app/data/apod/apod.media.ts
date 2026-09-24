import type { ApodEntry } from './apod.model';

/** A `<source>` of a `<picture>` element. */
export interface ImageSource {
  readonly type: 'image/avif' | 'image/webp';
  readonly srcset: string;
}

/** The picture that represents an entry: the photo itself or a video's poster (if any). */
export function coverImage(entry: ApodEntry): string | null {
  return entry.media.kind === 'image' ? entry.media.url : entry.media.thumbnailUrl;
}

/**
 * `<source>` sets for the optimised cover, best format first. Empty when the snapshot has
 * no optimised versions; the `<img>` fallback then loads `coverImage()` as before.
 */
export function coverSources(entry: ApodEntry): ImageSource[] {
  const variants = entry.cover?.variants ?? [];
  if (variants.length === 0) return [];
  const srcset = (format: 'avif' | 'webp'): string =>
    variants.map((variant) => `${variant[format]} ${variant.width}w`).join(', ');
  return [
    { type: 'image/avif', srcset: srcset('avif') },
    { type: 'image/webp', srcset: srcset('webp') },
  ];
}

/** The smallest optimised variant at least `minWidth` wide (for tiny avatars), or the original. */
export function coverAtLeast(entry: ApodEntry, minWidth: number): string | null {
  const variant = entry.cover?.variants.find((candidate) => candidate.width >= minWidth);
  return variant?.webp ?? coverImage(entry);
}
