import type {ApodEntry} from './apod.model';

export interface ImageSource {
  readonly type: 'image/avif' | 'image/webp';
  readonly srcset: string;
}

export function coverImage(entry: ApodEntry): string | null {
  return entry.media.kind === 'image' ? entry.media.url : entry.media.thumbnailUrl;
}

export function coverSources(entry: ApodEntry): ImageSource[] {
  const variants = entry.cover?.variants ?? [];
  if (variants.length === 0) return [];
  const srcset = (format: 'avif' | 'webp'): string =>
    variants.map((variant) => `${variant[format]} ${variant.width}w`).join(', ');
  return [
    {type: 'image/avif', srcset: srcset('avif')},
    {type: 'image/webp', srcset: srcset('webp')},
  ];
}

export function coverAtLeast(entry: ApodEntry, minWidth: number): string | null {
  const variant = entry.cover?.variants.find((candidate) => candidate.width >= minWidth);
  return variant?.webp ?? coverImage(entry);
}
