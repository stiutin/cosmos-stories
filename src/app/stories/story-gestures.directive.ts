import { DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';
import type { SwipeDirection } from '@cosmos-stories/carousel/core';
import { SwipeTracker } from '@cosmos-stories/carousel/core';

/** Press this long without moving to pause (Instagram-style hold). */
export const HOLD_DELAY_MS = 220;
/** Swipe down at least this far (px), or flick down, to close the player. */
export const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.6;

/**
 * All pointer input of the stories player, on one element:
 *
 * | Gesture                        | Output                                 |
 * | ------------------------------ | -------------------------------------- |
 * | tap on the left third / rest   | `tapPrev` / `tapNext`                  |
 * | press and hold                 | `holdChange(true)` … `holdChange(false)` |
 * | horizontal drag                | `dragStart`, `dragMove(px)`, `dragEnd(direction)` |
 * | drag down                      | `dismissMove(px)`, then `dismiss` or `dismissMove(0)` |
 *
 * Horizontal recognition reuses `SwipeTracker` from the carousel core. The host
 * gets `touch-action: none`, because the player handles both axes itself.
 * Gestures that start on a button or link are left alone.
 */
@Directive({
  selector: '[appStoryGestures]',
  host: {
    '[style.touch-action]': '"none"',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerCancel($event)',
    // A long press would otherwise open the image context menu on mobile.
    '(contextmenu)': '$event.preventDefault()',
    '(dragstart)': '$event.preventDefault()',
  },
})
export class StoryGesturesDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly tapPrev = output();
  readonly tapNext = output();
  readonly holdChange = output<boolean>();
  readonly dragStart = output();
  readonly dragMove = output<number>();
  readonly dragEnd = output<SwipeDirection>();
  readonly dismissMove = output<number>();
  readonly dismiss = output();

  private tracker = new SwipeTracker();
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private holding = false;
  private dragging = false;
  private dismissing = false;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.clearHoldTimer();
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (event.target instanceof Element && event.target.closest('button, a, iframe')) return;

    this.reset();
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startTime = event.timeStamp;
    this.tracker = new SwipeTracker();
    this.tracker.start(event.clientX, event.clientY, event.timeStamp);
    this.capture(event.pointerId);

    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      if (this.tracker.axis !== null) return;
      this.holding = true;
      this.holdChange.emit(true);
    }, HOLD_DELAY_MS);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;

    const offset = this.tracker.move(event.clientX, event.clientY, event.timeStamp);
    const axis = this.tracker.axis;
    if (axis === null) return;
    this.clearHoldTimer();

    if (axis === 'horizontal') {
      if (!this.dragging) {
        this.dragging = true;
        this.releaseHold();
        this.dragStart.emit();
      }
      this.dragMove.emit(offset);
      return;
    }

    this.dismissing = true;
    this.releaseHold();
    this.dismissMove.emit(Math.max(0, event.clientY - this.startY));
  }

  protected onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    this.clearHoldTimer();

    if (this.dragging) {
      this.dragEnd.emit(
        this.tracker.end(event.clientX, event.clientY, event.timeStamp, this.host.clientWidth),
      );
    } else if (this.dismissing) {
      const distance = event.clientY - this.startY;
      const velocity = distance / Math.max(1, event.timeStamp - this.startTime);
      if (distance >= DISMISS_DISTANCE || velocity >= DISMISS_VELOCITY) this.dismiss.emit();
      else this.dismissMove.emit(0);
    } else if (this.holding) {
      this.releaseHold();
    } else {
      const rect = this.host.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      if (x < 1 / 3) this.tapPrev.emit();
      else this.tapNext.emit();
    }
    this.reset();
  }

  protected onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    this.clearHoldTimer();
    if (this.dragging) this.dragEnd.emit(0);
    if (this.dismissing) this.dismissMove.emit(0);
    this.releaseHold();
    this.reset();
  }

  private releaseHold(): void {
    if (!this.holding) return;
    this.holding = false;
    this.holdChange.emit(false);
  }

  private reset(): void {
    this.tracker.reset();
    this.pointerId = null;
    this.dragging = false;
    this.dismissing = false;
  }

  private clearHoldTimer(): void {
    if (this.holdTimer !== null) clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }

  private capture(pointerId: number): void {
    try {
      this.host.setPointerCapture(pointerId);
    } catch {
      // The pointer may already be gone: nothing to capture.
    }
  }
}
