import { DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';
import type { SwipeDirection, SwipeOptions } from '@cosmos-stories/carousel/core';
import { DEFAULT_SWIPE_OPTIONS, SwipeTracker } from '@cosmos-stories/carousel/core';

/**
 * Swipe gestures for any element, via Pointer Events: touch, mouse and pen.
 * The gesture maths lives in `SwipeTracker` (core); this directive only adapts DOM events.
 *
 * - The host gets `touch-action: pan-y` (or `pan-x` for vertical swipes), so the
 *   browser keeps scrolling along the other axis and no non-passive listener is needed.
 * - The pointer is captured only once the gesture locks onto the navigation axis,
 *   so a plain tap still reaches buttons and links inside the host.
 * - The click that browsers fire after a mouse drag is swallowed, so dragging
 *   across a link doesn't open it.
 */
@Directive({
  selector: '[uiSwipe]',
  host: {
    '[style.touch-action]': 'swipeOptions().axis === "horizontal" ? "pan-y" : "pan-x"',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerCancel($event)',
    '(dragstart)': '$event.preventDefault()',
  },
})
export class UiSwipe {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly swipeOptions = input<SwipeOptions>(DEFAULT_SWIPE_OPTIONS);

  /** A drag along the navigation axis started. */
  readonly swipeStart = output();
  /** Offset in px along the navigation axis while dragging. */
  readonly swipeMove = output<number>();
  /** The drag ended: `1` = next, `-1` = previous, `0` = not a swipe (snap back). */
  readonly swipeEnd = output<SwipeDirection>();

  private tracker = new SwipeTracker(DEFAULT_SWIPE_OPTIONS);
  private pointerId: number | null = null;
  private isDragging = false;
  private suppressNextClick = false;

  constructor() {
    const swallowClick = (event: MouseEvent): void => {
      if (!this.suppressNextClick) return;
      this.suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    // Capture phase: runs before any click handler inside the host.
    this.host.addEventListener('click', swallowClick, true);
    inject(DestroyRef).onDestroy(() => {
      this.host.removeEventListener('click', swallowClick, true);
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;

    this.tracker = new SwipeTracker(this.swipeOptions());
    this.tracker.start(event.clientX, event.clientY, event.timeStamp);
    this.pointerId = event.pointerId;
    this.suppressNextClick = false;
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId || !this.tracker.isTracking) return;

    const offset = this.tracker.move(event.clientX, event.clientY, event.timeStamp);
    if (!this.tracker.isNavigating) return;

    if (!this.isDragging) {
      this.isDragging = true;
      this.capture(event.pointerId);
      this.swipeStart.emit();
    }
    this.swipeMove.emit(offset);
  }

  protected onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;

    const size =
      this.swipeOptions().axis === 'horizontal' ? this.host.clientWidth : this.host.clientHeight;
    const direction = this.tracker.end(event.clientX, event.clientY, event.timeStamp, size);

    if (this.isDragging) {
      // A drag is not a click, whatever the browser thinks.
      this.suppressNextClick = true;
      setTimeout(() => {
        this.suppressNextClick = false;
      });
      this.swipeEnd.emit(direction);
    }
    this.reset();
  }

  /** The system took the pointer away (scroll, call, notification): snap back, no swipe. */
  protected onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    this.tracker.reset();
    if (this.isDragging) this.swipeEnd.emit(0);
    this.reset();
  }

  private reset(): void {
    this.isDragging = false;
    this.pointerId = null;
  }

  private capture(pointerId: number): void {
    try {
      this.host.setPointerCapture(pointerId);
    } catch {
      // The pointer may already be gone (released between events): nothing to capture.
    }
  }
}
