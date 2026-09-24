import { computed, inject, Injectable } from '@angular/core';
import type { ApodEntry } from '../data/apod/apod.model';
import { coverImage, coverSources } from '../data/apod/apod.media';
import { ApodService } from '../data/apod/apod.service';
import type { Slide } from '../models/slide.model';

/** How many recent APOD entries the banner shows between the intro and outro slides. */
export const APOD_SLIDE_COUNT = 5;

const INTRO_SLIDE: Slide = {
  id: 'intro',
  bgImage: 'slides/nebula-bg.svg',
  bgSources: [],
  visualImage: 'slides/nebula-visual.svg',
  theme: 'nebula',
  contentAlign: 'center',
  kicker: null,
  title: 'Cosmos Stories',
  textParts: [
    { text: 'Daily snapshots of the universe from ' },
    { text: "NASA's Astronomy Picture of the Day", accent: true },
    { text: ', told as stories.' },
  ],
  buttonText: 'View on GitHub',
  buttonLink: 'https://github.com/stiutin/cosmos-stories',
  credit: null,
};

const OUTRO_SLIDE: Slide = {
  id: 'playground',
  bgImage: 'slides/orbit-bg.svg',
  bgSources: [],
  visualImage: 'slides/orbit-visual.svg',
  theme: 'orbit',
  contentAlign: 'center',
  kicker: null,
  title: 'Built in the open',
  textParts: [
    { text: 'This banner and the stories cube share ' },
    { text: 'one carousel engine', accent: true },
    { text: '. Try every option live.' },
  ],
  buttonText: 'Open the playground',
  buttonLink: '/playground',
  credit: null,
};

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatApodDate(date: string): string {
  return DATE_FORMAT.format(new Date(`${date}T00:00:00Z`));
}

/** The first sentences of `text` that fit in `maxLength`, or a word-boundary cut with an ellipsis. */
export function excerpt(text: string, maxLength = 150): string {
  if (text.length <= maxLength) return text;

  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [];
  let result = '';
  for (const sentence of sentences) {
    if ((result + sentence).trim().length > maxLength) break;
    result += sentence;
  }
  if (result.trim()) return result.trim();

  const cut = text.slice(0, maxLength - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
}

/** Maps an APOD entry to a banner slide, or `null` when it has nothing to show (video without poster). */
export function apodToSlide(entry: ApodEntry): Slide | null {
  const isVideo = entry.media.kind === 'video';
  const image = coverImage(entry);
  if (!image) return null;

  return {
    id: `apod-${entry.date}`,
    bgImage: image,
    bgSources: coverSources(entry),
    visualImage: null,
    theme: 'photo',
    contentAlign: 'left',
    kicker: `${formatApodDate(entry.date)}${isVideo ? ' · Video' : ''}`,
    title: entry.title,
    textParts: [{ text: excerpt(entry.explanation) }],
    buttonText: isVideo ? 'Watch the story' : 'Open the story',
    // All banner entries are among the latest ones, so they live in the "latest" group.
    buttonLink: `/stories/latest/${entry.date}`,
    credit: entry.copyright ? `Image © ${entry.copyright}` : 'Public domain · NASA APOD',
  };
}

/**
 * The banner carousel's content: an intro slide, the latest APOD entries, and an outro.
 * Loading and error state come straight from `ApodService`.
 */
@Injectable({ providedIn: 'root' })
export class BannerService {
  private readonly apod = inject(ApodService);

  readonly isLoading = this.apod.isLoading;
  readonly error = this.apod.error;
  readonly isSample = this.apod.isSample;

  /**
   * The intro and outro don't depend on data, so they render immediately (fast first
   * paint, no waiting on the network); the APOD slides join as soon as they arrive.
   */
  readonly slides = computed<readonly Slide[]>(() => {
    const apodSlides = this.apod
      .entries()
      .map(apodToSlide)
      .filter((slide): slide is Slide => slide !== null)
      .slice(0, APOD_SLIDE_COUNT);
    return [INTRO_SLIDE, ...apodSlides, OUTRO_SLIDE];
  });

  reload(): void {
    this.apod.reload();
  }
}
