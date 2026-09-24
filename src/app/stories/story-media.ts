import {Component, computed, inject, input, output, signal} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';

import {coverAtLeast, coverSources} from '../data/apod/apod.media';
import type {ApodEntry} from '../data/apod/apod.model';
import {toEmbedUrl} from './video-embed';

@Component({
  selector: 'app-story-media',
  templateUrl: './story-media.html',
  styleUrl: './story-media.scss',
})
export class StoryMedia {
  private readonly sanitizer = inject(DomSanitizer);

  public readonly entry = input.required<ApodEntry>();
  public readonly active = input(false);
  public readonly priority = input(false);
  public readonly ready = output<string>();
  public readonly videoOpenChange = output<boolean>();

  protected readonly videoOpen = signal(false);
  protected readonly failed = signal(false);

  public readonly image = computed(() => {
    const media = this.entry().media;
    return media.kind === 'image' ? media.url : media.thumbnailUrl;
  });

  protected readonly sources = computed(() => coverSources(this.entry()));
  protected readonly backdrop = computed(() => coverAtLeast(this.entry(), 160));
  protected readonly size = computed(() => this.entry().cover);
  protected readonly embedUrl = computed(() => {
    const media = this.entry().media;

    if (media.kind !== 'video') return null;

    const url = toEmbedUrl(media.embedUrl);
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
