import {Component, computed, input} from '@angular/core';
import {RouterLink} from '@angular/router';

import type {Slide} from '../../models/slide.model';

@Component({
  selector: 'app-slide',
  imports: [RouterLink],
  templateUrl: './slide.html',
  styleUrl: './slide.scss',
})
export class SlideComponent {
  public readonly slide = input.required<Slide>();
  public readonly priority = input(false);

  protected readonly linkKind = computed<'external' | 'route' | 'plain'>(() => {
    const link = this.slide().buttonLink ?? '';
    if (/^https?:\/\//.test(link)) return 'external';
    return link.startsWith('/') ? 'route' : 'plain';
  });
}
