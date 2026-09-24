/**
 * Why a clock instead of `setInterval`: it exposes progress (0..1) for progress bars,
 * and pausing freezes time instead of restarting the countdown.
 */
export type PauseReason = 'user' | 'hover' | 'focus' | 'drag' | 'hidden';

/**
 * Time-based autoplay state. It knows nothing about the DOM: the caller feeds it
 * timestamps (e.g. from `requestAnimationFrame`), which makes it trivial to test.
 *
 * The pause-reason type is generic, so other players can bring their own reasons
 * (the stories player adds `hold`, `loading`, `caption`…).
 */
export class AutoplayClock<Reason extends string = PauseReason> {
  private readonly pauseReasons = new Set<Reason>();
  private elapsed = 0;
  private lastTime: number | null = null;

  constructor(private duration: number) {
    AutoplayClock.assertDuration(duration);
  }

  /** Changes the cycle length; progress so far is kept proportionally. */
  public setDuration(duration: number): void {
    AutoplayClock.assertDuration(duration);
    this.elapsed = this.progress * duration;
    this.duration = duration;
  }

  public get progress(): number {
    return Math.min(1, this.elapsed / this.duration);
  }

  public get isPaused(): boolean {
    return this.pauseReasons.size > 0;
  }

  public hasReason(reason: Reason): boolean {
    return this.pauseReasons.has(reason);
  }

  /** Several reasons can hold the pause at once; playback resumes when none remain. */
  public setPaused(reason: Reason, paused: boolean): void {
    if (paused) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
  }

  /** Starts the current cycle over, e.g. after manual navigation. */
  public restart(): void {
    this.elapsed = 0;
  }

  /**
   * Advances the clock to `now` (ms). Returns `true` once per completed cycle.
   * While paused, time passes without being counted.
   */
  private static assertDuration(duration: number): void {
    if (!(duration > 0)) throw new RangeError('duration must be positive');
  }

  public tick(now: number): boolean {
    const delta = this.lastTime === null ? 0 : Math.max(0, now - this.lastTime);
    this.lastTime = now;
    if (this.isPaused) return false;

    this.elapsed += delta;
    if (this.elapsed < this.duration) return false;

    this.elapsed = 0;
    return true;
  }
}
