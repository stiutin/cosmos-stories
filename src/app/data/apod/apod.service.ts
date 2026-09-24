import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map, retry, timer } from 'rxjs';
import { groupStories } from './apod.groups';
import type { ApodEntry } from './apod.model';
import { parseSnapshot } from './apod.parse';

/** Relative to the document's base href, so it works under a GitHub Pages sub-path. */
export const APOD_SNAPSHOT_URL = 'data/apod.json';
export const APOD_RETRY_COUNT = 2;
export const APOD_RETRY_BASE_MS = 1_000;

/**
 * Loads the APOD snapshot once per session and exposes it as signals.
 *
 * - Network errors are retried with exponential backoff (1 s, 2 s).
 * - The response is validated by `parseSnapshot`; invalid data is never retried.
 * - Being a root singleton, every consumer shares one request and one cache.
 */
@Injectable({ providedIn: 'root' })
export class ApodService {
  private readonly http = inject(HttpClient);

  readonly snapshot = rxResource({
    stream: () =>
      this.http.get<unknown>(APOD_SNAPSHOT_URL).pipe(
        retry({
          count: APOD_RETRY_COUNT,
          delay: (_error, attempt) => timer(APOD_RETRY_BASE_MS * 2 ** (attempt - 1)),
        }),
        map(parseSnapshot),
      ),
  });

  readonly isLoading = computed(() => this.snapshot.isLoading());
  readonly error = computed(() => this.snapshot.error());
  // `value()` throws while the resource is in an error state, so read it through `hasValue()`.
  private readonly data = computed(() =>
    this.snapshot.hasValue() ? this.snapshot.value() : undefined,
  );
  readonly isSample = computed(() => this.data()?.isSample ?? false);
  readonly entries = computed<readonly ApodEntry[]>(() => this.data()?.entries ?? []);
  readonly groups = computed(() => groupStories(this.entries()));

  reload(): void {
    this.snapshot.reload();
  }
}
