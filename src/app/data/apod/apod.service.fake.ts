import {computed, signal} from '@angular/core';

import {groupStories} from './apod.groups';
import type {ApodEntry} from './apod.model';
import type {ApodService} from './apod.service';

export function fakeApodService(initial: readonly ApodEntry[] = []) {
  const entries = signal<readonly ApodEntry[]>(initial);
  const fake = {
    entries,
    isLoading: signal(false),
    error: signal<Error | undefined>(undefined),
    isSample: signal(false),
    groups: computed(() => groupStories(entries())),
    reload: () => undefined,
  };
  return fake as typeof fake & Pick<ApodService, 'entries' | 'groups' | 'isLoading'>;
}
