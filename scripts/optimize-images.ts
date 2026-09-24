/**
 * Downloads each entry's cover picture once and writes responsive AVIF + WebP versions
 * next to the snapshot, so visitors get small, modern images from the same origin
 * instead of multi-megabyte JPEGs from apod.nasa.gov.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { ApodCover, ApodEntry, ApodImageVariant } from '../src/app/data/apod/apod.model.ts';

/** 160 for ring avatars, the rest for slides and stories on phones, tablets and desktops. */
export const WIDTHS = [160, 480, 960, 1600] as const;
const AVIF_QUALITY = 50;
const WEBP_QUALITY = 72;
const CONCURRENCY = 4;
const DOWNLOAD_TIMEOUT_MS = 30_000;
/** APOD occasionally links enormous originals; skip anything bigger. */
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

export interface OptimizeOptions {
  /** Directory the files are written to, e.g. `public/data/img`. */
  readonly outDir: string;
  /** Path prefix used in the snapshot, relative to the app's base href, e.g. `data/img`. */
  readonly publicPath: string;
  readonly fetchImage?: (url: string) => Promise<Uint8Array>;
  readonly log?: (message: string) => void;
}

export interface OptimizeReport {
  readonly entries: ApodEntry[];
  readonly optimized: number;
  readonly failed: number;
  /** Bytes of the originals vs. bytes of the WebP variant closest to 960 px, for the job summary. */
  readonly originalBytes: number;
  readonly optimizedBytes: number;
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_DOWNLOAD_BYTES) throw new Error(`too large (${length} bytes)`);
  return new Uint8Array(await response.arrayBuffer());
}

function sourceUrl(entry: ApodEntry): string | null {
  return entry.media.kind === 'image' ? entry.media.url : entry.media.thumbnailUrl;
}

async function optimizeOne(
  entry: ApodEntry,
  options: OptimizeOptions,
): Promise<{ cover: ApodCover; originalBytes: number; optimizedBytes: number }> {
  const url = sourceUrl(entry);
  if (!url) throw new Error('no picture');

  const original = await (options.fetchImage ?? download)(url);
  const image = sharp(original, { failOn: 'error' }).rotate();
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error('unreadable image');

  // Never upscale: keep the widths the original can serve, plus the original width if smaller.
  const widths = [...new Set(WIDTHS.map((target) => Math.min(target, width)))];
  const variants: ApodImageVariant[] = [];
  let optimizedBytes = 0;

  for (const target of widths) {
    const base = `${entry.date}-${target}`;
    const resized = image.clone().resize({ width: target, withoutEnlargement: true });
    const [avif, webp] = await Promise.all([
      resized.clone().avif({ quality: AVIF_QUALITY, effort: 4 }).toBuffer(),
      resized.clone().webp({ quality: WEBP_QUALITY }).toBuffer(),
    ]);
    await Promise.all([
      writeFile(join(options.outDir, `${base}.avif`), avif),
      writeFile(join(options.outDir, `${base}.webp`), webp),
    ]);
    if (target <= 960) optimizedBytes = webp.byteLength;
    variants.push({
      width: target,
      avif: `${options.publicPath}/${base}.avif`,
      webp: `${options.publicPath}/${base}.webp`,
    });
  }

  return {
    cover: { width, height, variants },
    originalBytes: original.byteLength,
    optimizedBytes,
  };
}

/** Adds `cover` to every entry it can; failures leave `cover: null` (original URL fallback). */
export async function optimizeImages(
  entries: readonly ApodEntry[],
  options: OptimizeOptions,
): Promise<OptimizeReport> {
  await mkdir(options.outDir, { recursive: true });
  const log = options.log ?? (() => undefined);
  const results: ApodEntry[] = [...entries];
  let optimized = 0;
  let failed = 0;
  let originalBytes = 0;
  let optimizedBytes = 0;
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < entries.length) {
      const index = next++;
      const entry = entries[index];
      if (!entry || !sourceUrl(entry)) continue;
      try {
        const result = await optimizeOne(entry, options);
        results[index] = { ...entry, cover: result.cover };
        optimized++;
        originalBytes += result.originalBytes;
        optimizedBytes += result.optimizedBytes;
      } catch (error) {
        failed++;
        log(`${entry.date}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return { entries: results, optimized, failed, originalBytes, optimizedBytes };
}
