import { Injectable, signal } from '@angular/core';
import type { StoryGroup } from '../data/apod/apod.groups';

export const SEEN_STORAGE_KEY = 'cosmos-stories:seen:v1';
/** APOD dates are unique per story; keeping the newest few hundred is plenty. */
const MAX_REMEMBERED = 400;

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** `localStorage` can throw (Safari private mode, blocked cookies, sandboxed iframes). */
function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Remembers which stories the visitor has seen, in `localStorage`.
 * Never throws: without storage it still works for the current session.
 */
@Injectable({ providedIn: 'root' })
export class SeenStoriesService {
  private readonly storage = browserStorage();
  private readonly seenDates = signal<ReadonlySet<string>>(this.load());

  readonly seen = this.seenDates.asReadonly();

  markSeen(date: string): void {
    if (this.seenDates().has(date)) return;
    const next = [...this.seenDates(), date].sort().slice(-MAX_REMEMBERED);
    this.seenDates.set(new Set(next));
    this.save(next);
  }

  isGroupSeen(group: StoryGroup): boolean {
    const seen = this.seenDates();
    return group.entries.length > 0 && group.entries.every((entry) => seen.has(entry.date));
  }

  /** The first story the visitor hasn't seen yet, or the first story if all are seen. */
  firstUnseenIndex(group: StoryGroup): number {
    const index = group.entries.findIndex((entry) => !this.seenDates().has(entry.date));
    return Math.max(index, 0);
  }

  private load(): ReadonlySet<string> {
    try {
      const parsed: unknown = JSON.parse(this.storage?.getItem(SEEN_STORAGE_KEY) ?? '[]');
      return new Set(
        Array.isArray(parsed)
          ? parsed.filter((item): item is string => typeof item === 'string')
          : [],
      );
    } catch {
      return new Set();
    }
  }

  private save(dates: readonly string[]): void {
    try {
      this.storage?.setItem(SEEN_STORAGE_KEY, JSON.stringify(dates));
    } catch {
      // Quota or privacy mode: keep the in-memory state only.
    }
  }
}
