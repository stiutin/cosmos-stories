import type { ImageSource } from '../data/apod/apod.media';

export type SlideTheme = 'nebula' | 'galaxy' | 'orbit' | 'photo';
export type SlideContentAlign = 'left' | 'center' | 'right';

export interface SlideTextPart {
  readonly text: string;
  readonly accent?: boolean;
}

export interface Slide {
  /** Unique and stable, used for tracking. */
  readonly id: string;
  readonly bgImage: string;
  /** Optimised AVIF/WebP sources for the background (empty: just `bgImage`). */
  readonly bgSources: readonly ImageSource[];
  /** Floating illustration over the background. `null` shows the background as a full photo. */
  readonly visualImage: string | null;
  readonly theme: SlideTheme;
  /** Small line above the title, e.g. a date. */
  readonly kicker: string | null;
  readonly title: string;
  readonly textParts: readonly SlideTextPart[];
  readonly buttonText: string;
  readonly buttonLink: string | null;
  /** Image credit shown under the content. */
  readonly credit: string | null;
  readonly contentAlign: SlideContentAlign;
}
