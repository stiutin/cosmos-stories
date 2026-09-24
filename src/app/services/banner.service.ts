import {computed, inject, Injectable} from '@angular/core';

import {coverImage, coverSources} from '../data/apod/apod.media';
import type {ApodEntry} from '../data/apod/apod.model';
import {ApodService} from '../data/apod/apod.service';
import type {Slide} from '../models/slide.model';

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
    {text: 'Daily snapshots of the universe from '},
    {text: "NASA's Astronomy Picture of the Day", accent: true},
    {text: ', told as stories.'},
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
    {text: 'This banner and the stories cube share '},
    {text: 'one carousel engine', accent: true},
    {text: '. Try every option live.'},
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
    textParts: [{text: excerpt(entry.explanation)}],
    buttonText: isVideo ? 'Watch the story' : 'Open the story',
    buttonLink: `/stories/latest/${entry.date}`,
    credit: entry.copyright ? `Image © ${entry.copyright}` : 'Public domain · NASA APOD',
  };
}

@Injectable({providedIn: 'root'})
export class BannerService {
  private readonly apod = inject(ApodService);

  public readonly isLoading = this.apod.isLoading;
  public readonly error = this.apod.error;
  public readonly isSample = this.apod.isSample;

  public readonly slides = computed<readonly Slide[]>(() => {
    const apodSlides = this.apod
      .entries()
      .map(apodToSlide)
      .filter((slide): slide is Slide => slide !== null)
      .slice(0, APOD_SLIDE_COUNT);
    return [INTRO_SLIDE, ...apodSlides, OUTRO_SLIDE];
  });

  public reload(): void {
    this.apod.reload();
  }
}
