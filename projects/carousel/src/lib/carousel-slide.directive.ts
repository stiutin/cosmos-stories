import {Directive, inject, input, TemplateRef} from '@angular/core';

export interface UiCarouselSlideContext<T> {
  readonly $implicit: T;
  readonly index: number;
  readonly active: boolean;
  readonly clone: boolean;
}

@Directive({selector: 'ng-template[uiCarouselSlide]'})
export class UiCarouselSlide<T> {
  public readonly template = inject<TemplateRef<UiCarouselSlideContext<T>>>(TemplateRef);
  public readonly items = input<readonly T[] | ''>('', {alias: 'uiCarouselSlide'});

  public static ngTemplateContextGuard<T>(
    _directive: UiCarouselSlide<T>,
    _context: unknown
  ): _context is UiCarouselSlideContext<T> {
    return true;
  }
}
