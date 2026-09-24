export type ApodMedia =
  | {
      readonly kind: 'image';
      readonly url: string;
      readonly hdUrl: string | null;
    }
  | {
      readonly kind: 'video';
      readonly embedUrl: string;
      readonly thumbnailUrl: string | null;
    };

export interface ApodImageVariant {
  readonly width: number;
  readonly avif: string;
  readonly webp: string;
}

export interface ApodCover {
  readonly width: number;
  readonly height: number;
  readonly variants: readonly ApodImageVariant[];
}

export interface ApodEntry {
  readonly date: string;
  readonly title: string;
  readonly explanation: string;
  readonly media: ApodMedia;
  readonly copyright: string | null;
  readonly pageUrl: string;
  readonly cover: ApodCover | null;
}

export interface ApodSnapshot {
  readonly generatedAt: string;
  readonly isSample: boolean;
  readonly entries: readonly ApodEntry[];
}
