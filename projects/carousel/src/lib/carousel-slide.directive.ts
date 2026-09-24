import { Directive, inject, input, TemplateRef } from '@angular/core';

export interface UiCarouselSlideContext<T> {
  /** The item, also available as `let-item`. */
  readonly $implicit: T;
  /** Index of the real item (clones report the index of the item they copy). */
  readonly index: number;
  /** Whether this is the slide currently shown. */
  readonly active: boolean;
  /** Whether this rendered slide is a loop clone (useful to skip eager work). */
  readonly clone: boolean;
}

/**
 * Marks the template used to render each slide:
 *
 * ```html
 * <ui-carousel [items]="photos">
 *   <ng-template [uiCarouselSlide]="photos" let-photo let-active="active">…</ng-template>
 * </ui-carousel>
 * ```
 *
 * Passing the items to `[uiCarouselSlide]` is optional; it only types `let-photo`.
 */
@Directive({ selector: 'ng-template[uiCarouselSlide]' })
export class UiCarouselSlide<T> {
  readonly template = inject<TemplateRef<UiCarouselSlideContext<T>>>(TemplateRef);
  /** Type hint only: lets the compiler infer `T` for the template context. */
  readonly items = input<readonly T[] | ''>('', { alias: 'uiCarouselSlide' });

  /** Gives templates a typed context (`let-item` is `T`, not `any`). */
  static ngTemplateContextGuard<T>(
    _directive: UiCarouselSlide<T>,
    _context: unknown,
  ): _context is UiCarouselSlideContext<T> {
    return true;
  }
}
