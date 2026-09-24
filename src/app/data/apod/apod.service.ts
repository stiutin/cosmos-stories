import {HttpClient} from '@angular/common/http';
import {computed, inject, Injectable} from '@angular/core';
import {rxResource} from '@angular/core/rxjs-interop';
import {map, retry, timer} from 'rxjs';

import {groupStories} from './apod.groups';
import type {ApodEntry} from './apod.model';
import {parseSnapshot} from './apod.parse';

export const APOD_SNAPSHOT_URL = 'data/apod.json';
export const APOD_RETRY_COUNT = 2;
export const APOD_RETRY_BASE_MS = 1_000;

@Injectable({providedIn: 'root'})
export class ApodService {
  private readonly http = inject(HttpClient);

  public readonly snapshot = rxResource({
    stream: () =>
      this.http.get<unknown>(APOD_SNAPSHOT_URL).pipe(
        retry({
          count: APOD_RETRY_COUNT,
          delay: (_error, attempt) => timer(APOD_RETRY_BASE_MS * 2 ** (attempt - 1)),
        }),
        map(parseSnapshot)
      ),
  });

  public readonly isLoading = computed(() => this.snapshot.isLoading());
  public readonly error = computed(() => this.snapshot.error());
  private readonly data = computed(() => (this.snapshot.hasValue() ? this.snapshot.value() : undefined));
  public readonly isSample = computed(() => this.data()?.isSample ?? false);
  public readonly entries = computed<readonly ApodEntry[]>(() => this.data()?.entries ?? []);
  public readonly groups = computed(() => groupStories(this.entries()));

  public reload(): void {
    this.snapshot.reload();
  }
}
