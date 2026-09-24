import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Slide } from '../../models/slide.model';

@Component({
  selector: 'app-slide',
  imports: [RouterLink],
  templateUrl: './slide.html',
  styleUrl: './slide.scss',
})
export class SlideComponent {
  readonly slide = input.required<Slide>();
  /** The first visible slide is the page's largest paint: fetch its images first. */
  readonly priority = input(false);

  /** Links that leave the app open in a new tab; `/…` links are in-app routes. */
  protected readonly linkKind = computed<'external' | 'route' | 'plain'>(() => {
    const link = this.slide().buttonLink ?? '';
    if (/^https?:\/\//.test(link)) return 'external';
    return link.startsWith('/') ? 'route' : 'plain';
  });
}
