import {computed, type Signal, signal, type WritableSignal} from '@angular/core';

import {groupStories} from './apod.groups';
import type {ApodEntry} from './apod.model';
import type {ApodService} from './apod.service';

/** A stand-in for ApodService whose signals a test sets directly. */
export interface FakeApodService extends Pick<ApodService, 'entries' | 'groups' | 'isLoading'> {
  entries: WritableSignal<readonly ApodEntry[]>;
  isLoading: WritableSignal<boolean>;
  error: WritableSignal<Error | undefined>;
  isSample: WritableSignal<boolean>;
  groups: Signal<ReturnType<typeof groupStories>>;
  reload: () => void;
}

export function fakeApodService(initial: readonly ApodEntry[] = []): FakeApodService {
  const entries = signal<readonly ApodEntry[]>(initial);
  return {
    entries,
    isLoading: signal(false),
    error: signal<Error | undefined>(undefined),
    isSample: signal(false),
    groups: computed(() => groupStories(entries())),
    reload: () => undefined,
  };
}
