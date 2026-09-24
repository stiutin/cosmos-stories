import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiCarousel, UiCarouselSlide } from '@cosmos-stories/carousel';
import type { SwipeAxis } from '@cosmos-stories/carousel/core';
import { DEFAULT_SWIPE_OPTIONS } from '@cosmos-stories/carousel/core';

interface DemoSlide {
  readonly id: number;
  readonly name: string;
  readonly hue: number;
}

const NAMES = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

export const EASINGS = {
  'ease-out (default)': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  'spring-ish': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  linear: 'linear',
  'ease-in-out': 'ease-in-out',
} as const;
export type EasingName = keyof typeof EASINGS;

/**
 * Interactive documentation for `@cosmos-stories/carousel`: every input can be changed
 * live, the engine state is shown as it changes, and the matching template is generated.
 */
@Component({
  selector: 'app-playground',
  imports: [UiCarousel, UiCarouselSlide, RouterLink],
  templateUrl: './playground.html',
  styleUrl: './playground.scss',
})
export class Playground {
  protected readonly easingNames = Object.keys(EASINGS) as EasingName[];

  readonly slideCount = signal(5);
  readonly loop = signal(true);
  readonly autoplay = signal(true);
  readonly intervalSeconds = signal(4);
  readonly orientation = signal<SwipeAxis>('horizontal');
  readonly controls = signal(true);
  readonly transitionMs = signal(380);
  readonly easing = signal<EasingName>('ease-out (default)');
  readonly distanceRatio = signal(DEFAULT_SWIPE_OPTIONS.distanceRatio);
  readonly flickVelocity = signal(DEFAULT_SWIPE_OPTIONS.flickVelocity);

  protected readonly slides = computed<DemoSlide[]>(() =>
    Array.from({ length: this.slideCount() }, (_, i) => ({
      id: i,
      name: NAMES[i] ?? `Planet ${i + 1}`,
      hue: Math.round((360 / this.slideCount()) * i + 220) % 360,
    })),
  );

  protected readonly swipeOptions = computed(() => ({
    distanceRatio: this.distanceRatio(),
    flickVelocity: this.flickVelocity(),
  }));

  protected readonly easingValue = computed(() => EASINGS[this.easing()]);
  protected readonly log = signal<readonly string[]>([]);
  protected readonly copied = signal(false);

  protected readonly slideLabel = (slide: DemoSlide): string => slide.name;

  /** The template a consumer would write for the current settings (defaults omitted). */
  readonly code = computed(() => {
    const attrs = ['[items]="planets"', 'label="Planets"'];
    if (!this.loop()) attrs.push('[loop]="false"');
    if (!this.autoplay()) attrs.push('[autoplay]="false"');
    if (this.intervalSeconds() * 1000 !== 10_000)
      attrs.push(`[interval]="${this.intervalSeconds() * 1000}"`);
    if (this.orientation() !== 'horizontal') attrs.push(`orientation="${this.orientation()}"`);
    if (!this.controls()) attrs.push('[controls]="false"');
    if (this.transitionMs() !== 380) attrs.push(`[transitionMs]="${this.transitionMs()}"`);
    if (this.easing() !== 'ease-out (default)') attrs.push(`easing="${this.easingValue()}"`);
    const swipe: string[] = [];
    if (this.distanceRatio() !== DEFAULT_SWIPE_OPTIONS.distanceRatio) {
      swipe.push(`distanceRatio: ${this.distanceRatio()}`);
    }
    if (this.flickVelocity() !== DEFAULT_SWIPE_OPTIONS.flickVelocity) {
      swipe.push(`flickVelocity: ${this.flickVelocity()}`);
    }
    if (swipe.length > 0) attrs.push(`[swipeOptions]="{ ${swipe.join(', ')} }"`);

    return [
      `<ui-carousel`,
      ...attrs.map((attr) => `  ${attr}`),
      `>`,
      `  <ng-template [uiCarouselSlide]="planets" let-planet>`,
      `    <app-planet-card [planet]="planet" />`,
      `  </ng-template>`,
      `</ui-carousel>`,
    ].join('\n');
  });

  protected onIndexChange(index: number): void {
    const name = this.slides()[index]?.name ?? String(index);
    const time = new Date().toLocaleTimeString('en-GB');
    this.log.update((entries) => [`${time}  → ${name} (${index})`, ...entries].slice(0, 6));
  }

  protected async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
      setTimeout(() => {
        this.copied.set(false);
      }, 1500);
    } catch {
      // Clipboard blocked: the code is still selectable on screen.
    }
  }

  protected reset(): void {
    this.slideCount.set(5);
    this.loop.set(true);
    this.autoplay.set(true);
    this.intervalSeconds.set(4);
    this.orientation.set('horizontal');
    this.controls.set(true);
    this.transitionMs.set(380);
    this.easing.set('ease-out (default)');
    this.distanceRatio.set(DEFAULT_SWIPE_OPTIONS.distanceRatio);
    this.flickVelocity.set(DEFAULT_SWIPE_OPTIONS.flickVelocity);
  }

  // Template helpers for native inputs (no Forms module needed).
  protected checked(event: Event): boolean {
    return event.target instanceof HTMLInputElement && event.target.checked;
  }

  protected numeric(event: Event): number {
    return event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
      ? Number(event.target.value)
      : 0;
  }

  protected text(event: Event): string {
    return event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
      ? event.target.value
      : '';
  }

  protected setOrientation(value: string): void {
    if (value === 'horizontal' || value === 'vertical') this.orientation.set(value);
  }

  protected setEasing(value: string): void {
    if (value in EASINGS) this.easing.set(value as EasingName);
  }
}
