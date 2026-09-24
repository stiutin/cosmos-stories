import type { ApodEntry, ApodSnapshot } from './apod.model';

export function makeEntry(date: string, overrides: Partial<ApodEntry> = {}): ApodEntry {
  return {
    date,
    title: `Entry ${date}`,
    explanation: 'A short explanation.',
    media: { kind: 'image', url: `https://apod.nasa.gov/apod/image/${date}.jpg`, hdUrl: null },
    copyright: null,
    pageUrl: `https://apod.nasa.gov/apod/ap${date.slice(2).replaceAll('-', '')}.html`,
    cover: null,
    ...overrides,
  };
}

export function makeSnapshot(count = 8, overrides: Partial<ApodSnapshot> = {}): ApodSnapshot {
  const entries = Array.from({ length: count }, (_, index) =>
    makeEntry(`2026-09-${String(22 - index).padStart(2, '0')}`),
  );
  return { generatedAt: '2026-09-23T06:15:00.000Z', isSample: false, entries, ...overrides };
}
