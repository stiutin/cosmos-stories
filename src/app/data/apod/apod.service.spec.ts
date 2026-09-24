import { provideHttpClient } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import {
  HttpTestingController as Controller,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APOD_RETRY_BASE_MS, APOD_SNAPSHOT_URL, ApodService } from './apod.service';
import { makeSnapshot } from './apod.testing';

describe('ApodService', () => {
  let service: ApodService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApodService);
    http = TestBed.inject(Controller);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function flushEffects(): Promise<void> {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
  }

  it('loads, validates and groups the snapshot', async () => {
    await flushEffects();
    expect(service.isLoading()).toBe(true);

    http.expectOne(APOD_SNAPSHOT_URL).flush(makeSnapshot(8));
    await flushEffects();

    expect(service.isLoading()).toBe(false);
    expect(service.entries()).toHaveLength(8);
    expect(service.entries()[0]?.date).toBe('2026-09-22');
    expect(service.groups()[0]?.id).toBe('latest');
    expect(service.isSample()).toBe(false);
  });

  it('flags sample data', async () => {
    await flushEffects();
    http.expectOne(APOD_SNAPSHOT_URL).flush(makeSnapshot(3, { isSample: true }));
    await flushEffects();

    expect(service.isSample()).toBe(true);
  });

  it('retries network errors with exponential backoff', async () => {
    await flushEffects();
    http.expectOne(APOD_SNAPSHOT_URL).error(new ProgressEvent('offline'));

    await vi.advanceTimersByTimeAsync(APOD_RETRY_BASE_MS);
    http.expectOne(APOD_SNAPSHOT_URL).error(new ProgressEvent('offline'));

    await vi.advanceTimersByTimeAsync(APOD_RETRY_BASE_MS * 2);
    http.expectOne(APOD_SNAPSHOT_URL).flush(makeSnapshot(2));
    await flushEffects();

    expect(service.entries()).toHaveLength(2);
    expect(service.error()).toBeUndefined();
  });

  it('reports an error after the retries run out, and can reload', async () => {
    await flushEffects();
    http.expectOne(APOD_SNAPSHOT_URL).error(new ProgressEvent('offline'));
    await vi.advanceTimersByTimeAsync(APOD_RETRY_BASE_MS);
    http.expectOne(APOD_SNAPSHOT_URL).error(new ProgressEvent('offline'));
    await vi.advanceTimersByTimeAsync(APOD_RETRY_BASE_MS * 2);
    http.expectOne(APOD_SNAPSHOT_URL).error(new ProgressEvent('offline'));
    await flushEffects();

    expect(service.error()).toBeDefined();
    expect(service.entries()).toEqual([]);

    service.reload();
    await flushEffects();
    http.expectOne(APOD_SNAPSHOT_URL).flush(makeSnapshot(1));
    await flushEffects();
    expect(service.entries()).toHaveLength(1);
  });

  it('does not retry invalid data', async () => {
    await flushEffects();
    http.expectOne(APOD_SNAPSHOT_URL).flush({ entries: [] });
    await flushEffects();

    expect(service.error()?.message).toContain('no valid entries');
    http.expectNone(APOD_SNAPSHOT_URL);
  });
});
