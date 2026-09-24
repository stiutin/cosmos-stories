export type SwipeAxis = 'horizontal' | 'vertical';
export type SwipeDirection = -1 | 0 | 1;

export interface SwipeOptions {
  readonly axis: SwipeAxis;
  readonly deadzone: number;
  readonly distanceRatio: number;
  readonly flickVelocity: number;
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

const VELOCITY_WINDOW_MS = 100;

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

  public get isNavigating(): boolean {
    return this.lockedAxis === this.options.axis;
  }

  public start(x: number, y: number, time: number): void {
    this.startX = x;
    this.startY = y;
    this.samples = [{value: this.main(x, y), time}];
    this.lockedAxis = null;
    this.tracking = true;
  }

  public move(x: number, y: number, time: number): number {
    if (!this.tracking) return 0;

    const dx = x - this.startX;
    const dy = y - this.startY;

    if (this.lockedAxis === null) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < this.options.deadzone) return 0;

      this.lockedAxis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }

    this.samples.push({value: this.main(x, y), time});
    this.samples = this.samples.filter((sample) => time - sample.time <= VELOCITY_WINDOW_MS);

    return this.isNavigating ? this.main(dx, dy) : 0;
  }

  public end(x: number, y: number, time: number, containerSize: number): SwipeDirection {
    const wasNavigating = this.tracking && this.isNavigating;
    const oldest = this.samples.find((sample) => time - sample.time <= VELOCITY_WINDOW_MS);
    this.reset();

    if (!wasNavigating) return 0;

    const value = this.main(x, y);
    const delta = value - this.main(this.startX, this.startY);
    const velocity = oldest && time > oldest.time ? (value - oldest.value) / (time - oldest.time) : 0;

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
