import type {ApodCover, ApodEntry, ApodMedia, ApodSnapshot} from './apod.model';

export interface ApodApiItem {
  readonly date?: unknown;
  readonly title?: unknown;
  readonly explanation?: unknown;
  readonly media_type?: unknown;
  readonly url?: unknown;
  readonly hdurl?: unknown;
  readonly thumbnail_url?: unknown;
  readonly copyright?: unknown;
}

export interface NormalizeOptions {
  readonly includeCopyrighted?: boolean;
}

export interface SkippedItem {
  readonly date: string | null;
  readonly reason: string;
}

export interface NormalizeResult {
  readonly entries: ApodEntry[];
  readonly skipped: SkippedItem[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function apodPageUrl(date: string): string {
  return `https://apod.nasa.gov/apod/ap${date.slice(2).replaceAll('-', '')}.html`;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return null;
  }
}

function credit(value: unknown): string | null {
  const cleaned = text(value);
  return cleaned ? cleaned.replace(/^©\s*/, '') : null;
}

function media(item: ApodApiItem): ApodMedia | string {
  const url = httpsUrl(item.url);
  if (item.media_type === 'image') {
    if (!url) return 'image without a valid url';
    return {kind: 'image', url, hdUrl: httpsUrl(item.hdurl)};
  }
  if (item.media_type === 'video') {
    if (!url) return 'video without a valid url';
    return {kind: 'video', embedUrl: url, thumbnailUrl: httpsUrl(item.thumbnail_url)};
  }
  return `unsupported media type: ${String(item.media_type)}`;
}

export function normalizeApodItem(item: ApodApiItem, options: NormalizeOptions = {}): ApodEntry | SkippedItem {
  const date = isIsoDate(item.date) ? item.date : null;
  const skip = (reason: string): SkippedItem => ({date, reason});

  if (!date) return skip('missing or invalid date');

  const title = text(item.title);

  if (!title) return skip('missing title');

  const explanation = text(item.explanation);

  if (!explanation) return skip('missing explanation');

  const copyright = credit(item.copyright);

  if (copyright && !options.includeCopyrighted) return skip('copyrighted media');

  const parsedMedia = media(item);

  if (typeof parsedMedia === 'string') return skip(parsedMedia);

  return {
    date,
    title,
    explanation,
    media: parsedMedia,
    copyright,
    pageUrl: apodPageUrl(date),
    cover: null,
  };
}

function isEntry(value: ApodEntry | SkippedItem): value is ApodEntry {
  return 'media' in value;
}

export function normalizeApodResponse(raw: unknown, options: NormalizeOptions = {}): NormalizeResult {
  const items: unknown[] = Array.isArray(raw) ? raw : [raw];
  const byDate = new Map<string, ApodEntry>();
  const skipped: SkippedItem[] = [];

  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      skipped.push({date: null, reason: 'not an object'});
      continue;
    }
    const result = normalizeApodItem(item, options);
    if (isEntry(result)) byDate.set(result.date, result);
    else skipped.push(result);
  }

  const entries = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  return {entries, skipped};
}

const RELATIVE_PATH = /^(?!.*\.\.)[\w-]+(\/[\w.-]+)*$/;

export function isSafeMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return httpsUrl(value) === value || RELATIVE_PATH.test(value);
}

function isMedia(value: unknown): value is ApodMedia {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;
  const optionalUrl = (field: unknown): boolean => field === null || isSafeMediaUrl(field);

  if (candidate['kind'] === 'image') {
    return isSafeMediaUrl(candidate['url']) && optionalUrl(candidate['hdUrl']);
  }

  if (candidate['kind'] === 'video') {
    return isSafeMediaUrl(candidate['embedUrl']) && optionalUrl(candidate['thumbnailUrl']);
  }

  return false;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function parseCover(value: unknown): ApodCover | null {
  if (typeof value !== 'object' || value === null) return null;

  const candidate = value as Record<string, unknown>;
  const variants = candidate['variants'];

  if (!isPositiveInteger(candidate['width']) || !isPositiveInteger(candidate['height'])) return null;

  if (!Array.isArray(variants) || variants.length === 0) return null;

  const valid = variants.every((variant: unknown) => {
    if (typeof variant !== 'object' || variant === null) return false;

    const v = variant as Record<string, unknown>;

    return isPositiveInteger(v['width']) && isSafeMediaUrl(v['avif']) && isSafeMediaUrl(v['webp']);
  });

  if (!valid) return null;

  return {
    width: candidate['width'],
    height: candidate['height'],
    variants: [...(variants as ApodCover['variants'])].sort((a, b) => a.width - b.width),
  };
}

function isSnapshotEntry(value: unknown): value is Omit<ApodEntry, 'cover'> & {cover?: unknown} {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    isIsoDate(candidate['date']) &&
    text(candidate['title']) !== null &&
    text(candidate['explanation']) !== null &&
    (candidate['copyright'] === null || text(candidate['copyright']) !== null) &&
    typeof candidate['pageUrl'] === 'string' &&
    isMedia(candidate['media'])
  );
}

export function parseSnapshot(raw: unknown): ApodSnapshot {
  if (typeof raw !== 'object' || raw === null) throw new Error('Snapshot is not an object');
  const candidate = raw as Record<string, unknown>;
  const rawEntries = candidate['entries'];
  if (!Array.isArray(rawEntries)) throw new Error('Snapshot has no entries array');

  const entries: ApodEntry[] = rawEntries
    .filter(isSnapshotEntry)
    .map((entry) => ({...entry, cover: parseCover(entry.cover)}))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (entries.length === 0) throw new Error('Snapshot has no valid entries');

  return {
    generatedAt: typeof candidate['generatedAt'] === 'string' ? candidate['generatedAt'] : '',
    isSample: candidate['isSample'] === true,
    entries,
  };
}
