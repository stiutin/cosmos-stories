export type SwipeAxis = 'horizontal' | 'vertical';
/** `1` = go to the next slide (content dragged towards the start), `-1` = previous, `0` = stay. */
export type SwipeDirection = -1 | 0 | 1;

export interface SwipeOptions {
  /** The axis that navigates. Movement along the other axis is left to the browser (scrolling). */
  readonly axis: SwipeAxis;
  /** Movement (px) before the gesture commits to an axis. */
  readonly deadzone: number;
  /** Share of the container size a slow drag must cover to count as a swipe. */
  readonly distanceRatio: number;
  /** Release speed (px/ms) that counts as a flick regardless of distance. */
  readonly flickVelocity: number;
  /** A flick still has to travel this far (px), so a jittery tap isn't a swipe. */
  readonly minFlickDistance: number;
}

export const DEFAULT_SWIPE_OPTIONS: SwipeOptions = {
  axis: 'horizontal',
  deadzone: 8,
  distanceRatio: 0.25,
  flickVelocity: 0.3,
  minFlickDistance: 24,
};

interface Sample {
  readonly value: number;
  readonly time: number;
}

/** Only recent movement defines the release speed: a drag that stops before release isn't a flick. */
const VELOCITY_WINDOW_MS = 100;

/**
 * Pure gesture math, independent of DOM events so it can be unit-tested.
 * Feed it coordinates and timestamps; it reports the locked axis, the drag offset
 * along the navigation axis and, on release, whether the gesture was a swipe.
 */
export class SwipeTracker {
  private startX = 0;
  private startY = 0;
  private samples: Sample[] = [];
  private lockedAxis: SwipeAxis | null = null;
  private tracking = false;

  constructor(private readonly options: SwipeOptions = DEFAULT_SWIPE_OPTIONS) {}

  public get isTracking(): boolean {
    return this.tracking;
  }

  public get axis(): SwipeAxis | null {
    return this.lockedAxis;
  }

  /** True once the gesture has locked onto the navigation axis. */
  public get isNavigating(): boolean {
    return this.lockedAxis === this.options.axis;
  }

  public start(x: number, y: number, time: number): void {
    this.startX = x;
    this.startY = y;
    this.samples = [{ value: this.main(x, y), time }];
    this.lockedAxis = null;
    this.tracking = true;
  }

  /** Returns the offset along the navigation axis (0 until locked onto it). */
  public move(x: number, y: number, time: number): number {
    if (!this.tracking) return 0;

    const dx = x - this.startX;
    const dy = y - this.startY;

    if (this.lockedAxis === null) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < this.options.deadzone) return 0;
      this.lockedAxis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }

    this.samples.push({ value: this.main(x, y), time });
    this.samples = this.samples.filter((sample) => time - sample.time <= VELOCITY_WINDOW_MS);

    return this.isNavigating ? this.main(dx, dy) : 0;
  }

  /** Ends the gesture and decides whether it was a swipe. */
  public end(x: number, y: number, time: number, containerSize: number): SwipeDirection {
    const wasNavigating = this.tracking && this.isNavigating;
    const oldest = this.samples.find((sample) => time - sample.time <= VELOCITY_WINDOW_MS);
    this.reset();
    if (!wasNavigating) return 0;

    const value = this.main(x, y);
    const delta = value - this.main(this.startX, this.startY);
    const velocity =
      oldest && time > oldest.time ? (value - oldest.value) / (time - oldest.time) : 0;

    const farEnough = Math.abs(delta) >= containerSize * this.options.distanceRatio;
    const isFlick =
      Math.abs(velocity) >= this.options.flickVelocity &&
      Math.abs(delta) >= this.options.minFlickDistance &&
      Math.sign(velocity) === Math.sign(delta);

    if (!farEnough && !isFlick) return 0;
    return delta < 0 ? 1 : -1;
  }

  public reset(): void {
    this.tracking = false;
    this.lockedAxis = null;
    this.samples = [];
  }

  private main(x: number, y: number): number {
    return this.options.axis === 'horizontal' ? x : y;
  }
}
