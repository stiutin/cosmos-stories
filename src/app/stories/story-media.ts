import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { ApodEntry } from '../data/apod/apod.model';
import { coverAtLeast, coverSources } from '../data/apod/apod.media';
import { toEmbedUrl } from './video-embed';

/**
 * The visual part of one story: a photo (with a blurred backdrop so any aspect ratio
 * fills the frame) or a video poster that turns into an embedded player on demand.
 */
@Component({
  selector: 'app-story-media',
  templateUrl: './story-media.html',
  styleUrl: './story-media.scss',
})
export class StoryMedia {
  private readonly sanitizer = inject(DomSanitizer);

  readonly entry = input.required<ApodEntry>();
  /** Only the active story may start a video. */
  readonly active = input(false);
  readonly priority = input(false);

  /**
   * The image finished loading (or failed): the story timer may run.
   * Stories without any image never emit; the player doesn't wait for them.
   */
  readonly ready = output<string>();
  readonly videoOpenChange = output<boolean>();

  protected readonly videoOpen = signal(false);
  protected readonly failed = signal(false);

  readonly image = computed(() => {
    const media = this.entry().media;
    return media.kind === 'image' ? media.url : media.thumbnailUrl;
  });
  protected readonly sources = computed(() => coverSources(this.entry()));
  /** The blurred backdrop only needs the tiniest version. */
  protected readonly backdrop = computed(() => coverAtLeast(this.entry(), 160));
  protected readonly size = computed(() => this.entry().cover);

  /** Embeddable, allow-listed player URL. Everything else is linked to on APOD. */
  protected readonly embedUrl = computed(() => {
    const media = this.entry().media;
    if (media.kind !== 'video') return null;
    const url = toEmbedUrl(media.embedUrl);
    // Safe: `toEmbedUrl` only returns https URLs on an allow-list of video hosts.
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  protected onLoad(): void {
    this.ready.emit(this.entry().date);
  }

  protected onError(): void {
    this.failed.set(true);
    this.ready.emit(this.entry().date);
  }

  protected setVideoOpen(open: boolean): void {
    this.videoOpen.set(open);
    this.videoOpenChange.emit(open);
  }
}
