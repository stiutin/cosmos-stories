import {Component, inject, input} from '@angular/core';
import {UiCarousel, UiCarouselSlide} from '@cosmos-stories/carousel';

import type {Slide} from '../../models/slide.model';
import {BannerService} from '../../services/banner.service';
import {SlideComponent} from '../slide/slide';

@Component({
  selector: 'app-carousel',
  imports: [UiCarousel, UiCarouselSlide, SlideComponent],
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss',
})
export class CarouselComponent {
  protected readonly banner = inject(BannerService);

  public readonly active = input(true);

  protected readonly slideLabel = (slide: Slide, index: number): string => `Slide ${index + 1}: ${slide.title}`;
}
