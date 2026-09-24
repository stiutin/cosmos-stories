import {
  booleanAttribute,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  numberAttribute,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { CarouselState, SwipeAxis, SwipeOptions } from '@cosmos-stories/carousel/core';
import { CarouselEngine, DEFAULT_SWIPE_OPTIONS, withClones } from '@cosmos-stories/carousel/core';
import { UiCarouselSlide } from './carousel-slide.directive';
import { UiSwipe } from './swipe.directive';

/** How often the public `progress` signal follows the engine (the bar itself is per frame). */
const PROGRESS_SIGNAL_INTERVAL_MS = 250;

/** If `transitionend` never arrives (hidden tab, interrupted transition), settle anyway. */
const SETTLE_FALLBACK_EXTRA_MS = 100;

/**
 * Accessible carousel with a seamless infinite loop, pointer and keyboard
 * navigation, and a pausable autoplay (WAI-ARIA carousel pattern).
 *
 * All behaviour lives in the framework-agnostic `CarouselEngine`; this component
 * only renders its state and translates DOM events into engine commands.
 *
 * ```html
 * <ui-carousel [items]="slides" label="Highlights" [interval]="8000">
 *   <ng-template [uiCarouselSlide]="slides" let-slide>{{ slide.title }}</ng-template>
 * </ui-carousel>
 * ```
 *
 * Theming: `--ui-carousel-control-color`, `--ui-carousel-control-muted`,
 * `--ui-carousel-control-bg`, `--ui-carousel-focus-color`.
 */
@Component({
  selector: 'ui-carousel',
  exportAs: 'uiCarousel',
  imports: [NgTemplateOutlet, UiSwipe],
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss',
})
export class UiCarousel<T> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  // ─── Inputs & outputs ───────────────────────────────────────────────────

  readonly items = input.required<readonly T[]>();
  /** Accessible name of the carousel region. */
  readonly label = input('Carousel');
  /** Accessible name of an item, used by the indicators. */
  readonly itemLabel = input<(item: T, index: number) => string>(
    (_item, index) => `Slide ${index + 1}`,
  );
  readonly loop = input(true, { transform: booleanAttribute });
  /** Whether autoplay starts playing. Ignored (off) when the user prefers reduced motion. */
  readonly autoplay = input(true, { transform: booleanAttribute });
  readonly interval = input(10_000, { transform: numberAttribute });
  readonly orientation = input<SwipeAxis>('horizontal');
  /** Built-in pause button and indicators. Turn off to build custom controls via `exportAs`. */
  readonly controls = input(true, { transform: booleanAttribute });
  readonly transitionMs = input(380, { transform: numberAttribute });
  readonly easing = input('cubic-bezier(0.25, 0.46, 0.45, 0.94)');
  readonly swipeOptions = input<Partial<Omit<SwipeOptions, 'axis'>>>({});

  /** Emits the real index whenever the current slide changes. */
  readonly indexChange = output<number>();

  protected readonly slideTemplate = contentChild.required<UiCarouselSlide<T>>(UiCarouselSlide);

  // ─── Engine ─────────────────────────────────────────────────────────────

  protected readonly prefersReducedMotion = matchesMedia('(prefers-reduced-motion: reduce)');

  private readonly engine = new CarouselEngine({
    autoplay: !this.prefersReducedMotion,
    animated: !this.prefersReducedMotion,
  });

  /** Engine state as a signal. Read-only for consumers building custom controls. */
  readonly state = signal<CarouselState>(this.engine.getState());

  readonly index = computed(() => this.state().index);
  readonly count = computed(() => this.state().count);
  readonly playing = computed(() => this.state().playing);
  /**
   * Autoplay progress of the current slide (0..1). Updated a few times per second:
   * the built-in progress bar is painted straight from the frame loop instead,
   * so autoplay doesn't cost a change-detection pass on every frame.
   */
  readonly progress = signal(0);
  private readonly progressFill = viewChild<ElementRef<HTMLElement>>('progressFill');

  protected readonly rendered = computed(() => withClones(this.items(), this.loop()));

  protected readonly resolvedSwipeOptions = computed<SwipeOptions>(() => ({
    ...DEFAULT_SWIPE_OPTIONS,
    ...this.swipeOptions(),
    axis: this.orientation(),
  }));

  protected readonly trackTransform = computed(() => {
    const { position, dragOffset } = this.state();
    const offset = `calc(${-position * 100}% + ${dragOffset}px)`;
    return this.orientation() === 'horizontal'
      ? `translate3d(${offset}, 0, 0)`
      : `translate3d(0, ${offset}, 0)`;
  });

  protected readonly trackTransition = computed(() => {
    const { animate, phase } = this.state();
    return animate && phase !== 'dragging' && !this.prefersReducedMotion
      ? `transform ${this.transitionMs()}ms ${this.easing()}`
      : 'none';
  });

  private frameId: number | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.engine.subscribe((state) => {
      const previous = this.state();
      // `tick()` reports progress on every frame. Progress alone doesn't need a render.
      if (onlyProgressChanged(previous, state)) return;
      this.state.set(state);
      this.onStateChange(previous, state);
    });

    effect(() => {
      const options = { loop: this.loop(), interval: this.interval() };
      untracked(() => {
        this.engine.setOptions(options);
      });
    });

    effect(() => {
      const count = this.items().length;
      untracked(() => {
        this.engine.setCount(count);
      });
    });

    effect(() => {
      const autoplay = this.autoplay() && !this.prefersReducedMotion;
      untracked(() => {
        if (autoplay) this.engine.play();
        else this.engine.pause();
      });
    });

    const onVisibilityChange = (): void => {
      this.engine.setPaused('hidden', document.hidden);
    };
    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.startFrames();

    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (this.frameId !== null) cancelAnimationFrame(this.frameId);
      if (this.settleTimer !== null) clearTimeout(this.settleTimer);
      this.engine.destroy();
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  next(): void {
    this.engine.next();
  }

  prev(): void {
    this.engine.prev();
  }

  goTo(index: number): void {
    this.engine.goTo(index);
  }

  toggleAutoplay(): void {
    this.engine.toggle();
  }

  /** Whether autoplay is frozen for a given reason (hover, focus, drag, hidden, user). */
  isPausedBy(reason: 'user' | 'hover' | 'focus' | 'drag' | 'hidden'): boolean {
    return this.engine.isPausedBy(reason);
  }

  // ─── Rendering glue ─────────────────────────────────────────────────────

  private onStateChange(previous: CarouselState, state: CarouselState): void {
    if (state.index !== previous.index) this.indexChange.emit(state.index);

    if (state.phase === 'animating' && state.position !== previous.position) {
      this.scheduleSettleFallback();
    }
    if (state.hasPending && !previous.hasPending) {
      afterPaint(() => {
        this.engine.resolvePending();
      });
    }
  }

  protected onTransitionEnd(event: TransitionEvent): void {
    if (event.target === event.currentTarget && event.propertyName === 'transform') {
      this.engine.settle();
    }
  }

  private scheduleSettleFallback(): void {
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.engine.settle();
    }, this.transitionMs() + SETTLE_FALLBACK_EXTRA_MS);
  }

  private startFrames(): void {
    let lastSignalUpdate = 0;
    const frame = (now: number): void => {
      this.engine.tick(now);
      const { progress } = this.engine.getState();
      // Compositor-only style write: no change detection involved.
      this.progressFill()?.nativeElement.style.setProperty('transform', `scaleX(${progress})`);
      if (now - lastSignalUpdate >= PROGRESS_SIGNAL_INTERVAL_MS || progress === 0) {
        lastSignalUpdate = now;
        this.progress.set(progress);
      }
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  // ─── Input ──────────────────────────────────────────────────────────────

  protected onSwipeStart(): void {
    this.engine.dragStart();
  }

  protected onSwipeMove(offset: number): void {
    this.engine.dragMove(offset);
  }

  protected onSwipeEnd(direction: -1 | 0 | 1): void {
    this.engine.dragEnd(direction);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const horizontal = this.orientation() === 'horizontal';
    const actions: Partial<Record<string, () => void>> = {
      [horizontal ? 'ArrowLeft' : 'ArrowUp']: () => {
        this.prev();
      },
      [horizontal ? 'ArrowRight' : 'ArrowDown']: () => {
        this.next();
      },
      Home: () => {
        this.goTo(0);
      },
      End: () => {
        this.goTo(this.count() - 1);
      },
    };
    const action = actions[event.key];
    if (!action) return;

    event.preventDefault();
    const focusWasInSlide = this.activeSlideElement()?.contains(document.activeElement) ?? false;
    action();
    // The slide that had focus is now inert: hand focus to the new slide so it isn't lost.
    if (focusWasInSlide) {
      afterPaint(() => {
        this.activeSlideElement()?.focus();
      });
    }
  }

  protected onPointerEnter(event: PointerEvent): void {
    if (event.pointerType === 'mouse') this.engine.setPaused('hover', true);
  }

  protected onPointerLeave(event: PointerEvent): void {
    if (event.pointerType === 'mouse') this.engine.setPaused('hover', false);
  }

  protected onFocusIn(): void {
    this.engine.setPaused('focus', true);
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !this.host.contains(next)) {
      this.engine.setPaused('focus', false);
    }
  }

  private activeSlideElement(): HTMLElement | null {
    return this.host.querySelector<HTMLElement>('.ui-carousel__slide--active');
  }
}

function matchesMedia(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/** Runs after the browser has painted the current state (two animation frames). */
function afterPaint(callback: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

function onlyProgressChanged(previous: CarouselState, next: CarouselState): boolean {
  return (Object.keys(next) as (keyof CarouselState)[]).every(
    (key) => key === 'progress' || previous[key] === next[key],
  );
}
