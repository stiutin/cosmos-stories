import {DestroyRef, Directive, ElementRef, inject, input, output} from '@angular/core';
import type {SwipeDirection, SwipeOptions} from '@cosmos-stories/carousel/core';
import {DEFAULT_SWIPE_OPTIONS, SwipeTracker} from '@cosmos-stories/carousel/core';

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

  public readonly swipeOptions = input<SwipeOptions>(DEFAULT_SWIPE_OPTIONS);

  public readonly swipeStart = output();
  public readonly swipeMove = output<number>();
  public readonly swipeEnd = output<SwipeDirection>();

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

    const size = this.swipeOptions().axis === 'horizontal' ? this.host.clientWidth : this.host.clientHeight;
    const direction = this.tracker.end(event.clientX, event.clientY, event.timeStamp, size);

    if (this.isDragging) {
      this.suppressNextClick = true;
      setTimeout(() => {
        this.suppressNextClick = false;
      });
      this.swipeEnd.emit(direction);
    }
    this.reset();
  }

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
