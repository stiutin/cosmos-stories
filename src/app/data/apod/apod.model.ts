/**
 * Domain model for Astronomy Picture of the Day entries.
 * Everything the UI needs is here, already validated; nothing refers to the raw API shape.
 */

export type ApodMedia =
  | {
      readonly kind: 'image';
      /** Standard-resolution image (the API's `url`). */
      readonly url: string;
      /** Full-resolution image, when available. Usually several megabytes. */
      readonly hdUrl: string | null;
    }
  | {
      readonly kind: 'video';
      /** Embeddable player URL (YouTube, Vimeo…). */
      readonly embedUrl: string;
      /** Poster image, when the API could provide one. */
      readonly thumbnailUrl: string | null;
    };

/** One optimised size of an entry's cover picture, self-hosted with the snapshot. */
export interface ApodImageVariant {
  readonly width: number;
  /** Same-origin paths, relative to the base href. */
  readonly avif: string;
  readonly webp: string;
}

/** Optimised versions of the cover picture, built by the snapshot script. */
export interface ApodCover {
  /** Intrinsic size of the source picture, for `width`/`height` attributes (no layout shift). */
  readonly width: number;
  readonly height: number;
  /** Ascending by width. */
  readonly variants: readonly ApodImageVariant[];
}

export interface ApodEntry {
  /** `YYYY-MM-DD`, unique per entry. */
  readonly date: string;
  readonly title: string;
  readonly explanation: string;
  readonly media: ApodMedia;
  /** Copyright holder, or `null` for public-domain (typically NASA) media. */
  readonly copyright: string | null;
  /** The entry's page on apod.nasa.gov. */
  readonly pageUrl: string;
  /**
   * Optimised AVIF/WebP versions of the cover picture, or `null` when they couldn't be
   * built (the UI then falls back to the original URL on apod.nasa.gov).
   */
  readonly cover: ApodCover | null;
}

export interface ApodSnapshot {
  /** ISO timestamp of when the snapshot was built. */
  readonly generatedAt: string;
  /** `true` for the bundled development sample, `false` for real NASA data. */
  readonly isSample: boolean;
  /** Newest first. */
  readonly entries: readonly ApodEntry[];
}
