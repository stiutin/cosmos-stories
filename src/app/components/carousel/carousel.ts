import { Component, inject, input } from '@angular/core';
import { UiCarousel, UiCarouselSlide } from '@cosmos-stories/carousel';
import type { Slide } from '../../models/slide.model';
import { BannerService } from '../../services/banner.service';
import { SlideComponent } from '../slide/slide';

/**
 * The banner carousel of the app: data state plus presentation.
 * All carousel behaviour comes from the `@cosmos-stories/carousel` library.
 */
@Component({
  selector: 'app-carousel',
  imports: [UiCarousel, UiCarouselSlide, SlideComponent],
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss',
})
export class CarouselComponent {
  protected readonly banner = inject(BannerService);
  /** Autoplay runs only while the carousel is on screen (not behind the stories player). */
  readonly active = input(true);

  protected readonly slideLabel = (slide: Slide, index: number): string =>
    `Slide ${index + 1}: ${slide.title}`;
}
