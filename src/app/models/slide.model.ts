import type {ImageSource} from '../data/apod/apod.media';

export type SlideTheme = 'nebula' | 'galaxy' | 'orbit' | 'photo';
export type SlideContentAlign = 'left' | 'center' | 'right';

export interface SlideTextPart {
  readonly text: string;
  readonly accent?: boolean;
}

export interface Slide {
  readonly id: string;
  readonly bgImage: string;
  readonly bgSources: readonly ImageSource[];
  readonly visualImage: string | null;
  readonly theme: SlideTheme;
  readonly kicker: string | null;
  readonly title: string;
  readonly textParts: readonly SlideTextPart[];
  readonly buttonText: string;
  readonly buttonLink: string | null;
  readonly credit: string | null;
  readonly contentAlign: SlideContentAlign;
}
