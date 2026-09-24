import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';

import type {ApodEntry} from '../data/apod/apod.model';
import {ApodService} from '../data/apod/apod.service';
import {makeEntry} from '../data/apod/apod.testing';
import {APOD_SLIDE_COUNT, apodToSlide, BannerService, excerpt, formatApodDate} from './banner.service';

describe('formatApodDate', () => {
  it('formats the date in UTC, whatever the local time zone', () => {
    expect(formatApodDate('2026-09-01')).toBe('1 September 2026');
  });
});

describe('excerpt', () => {
  it('keeps short text as is', () => {
    expect(excerpt('Short text.')).toBe('Short text.');
  });

  it('keeps whole sentences that fit', () => {
    const text = 'First sentence here. Second one is here too! A third sentence that is too long to fit.';
    expect(excerpt(text, 45)).toBe('First sentence here. Second one is here too!');
  });

  it('cuts a single long sentence at a word boundary', () => {
    const text = 'One very long sentence without any full stop, which keeps going and going';
    expect(excerpt(text, 30)).toBe('One very long sentence…');
  });
});

describe('apodToSlide', () => {
  it('shows an image entry as a full photo slide that opens its story', () => {
    const slide = apodToSlide(makeEntry('2026-09-20', {title: 'The Helix Nebula'}));

    expect(slide).toMatchObject({
      id: 'apod-2026-09-20',
      bgImage: 'https://apod.nasa.gov/apod/image/2026-09-20.jpg',
      visualImage: null,
      theme: 'photo',
      kicker: '20 September 2026',
      title: 'The Helix Nebula',
      buttonText: 'Open the story',
      buttonLink: '/stories/latest/2026-09-20',
      credit: 'Public domain · NASA APOD',
    });
  });

  it('credits copyrighted media', () => {
    expect(apodToSlide(makeEntry('2026-09-20', {copyright: 'Jane Doe'}))?.credit).toBe('Image © Jane Doe');
  });

  it('uses the thumbnail of a video, or skips a video without one', () => {
    const video = (thumbnailUrl: string | null): ApodEntry =>
      makeEntry('2026-09-20', {
        media: {kind: 'video', embedUrl: 'https://www.youtube.com/embed/x', thumbnailUrl},
      });

    expect(apodToSlide(video('https://img.youtube.com/vi/x/0.jpg'))).toMatchObject({
      bgImage: 'https://img.youtube.com/vi/x/0.jpg',
      kicker: '20 September 2026 · Video',
      buttonText: 'Watch the story',
    });
    expect(apodToSlide(video(null))).toBeNull();
  });
});

describe('BannerService', () => {
  const entries = signal<readonly ApodEntry[]>([]);

  beforeEach(() => {
    entries.set([]);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApodService,
          useValue: {
            entries,
            isLoading: signal(false),
            error: signal(undefined),
            isSample: signal(false),
            reload: vi.fn(),
          },
        },
      ],
    });
  });

  it('shows the intro and outro right away, before any data', () => {
    expect(
      TestBed.inject(BannerService)
        .slides()
        .map((slide) => slide.id)
    ).toEqual(['intro', 'playground']);
  });

  it('frames the latest APOD entries with the intro and outro slides', () => {
    entries.set(Array.from({length: 9}, (_, index) => makeEntry(`2026-09-${String(20 - index).padStart(2, '0')}`)));
    const ids = TestBed.inject(BannerService)
      .slides()
      .map((slide) => slide.id);

    expect(ids).toHaveLength(APOD_SLIDE_COUNT + 2);
    expect(ids[0]).toBe('intro');
    expect(ids[1]).toBe('apod-2026-09-20');
    expect(ids.at(-1)).toBe('playground');
  });
});
