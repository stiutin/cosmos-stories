export type PauseReason = 'user' | 'hover' | 'focus' | 'drag' | 'hidden';

export class AutoplayClock<Reason extends string = PauseReason> {
  private readonly pauseReasons = new Set<Reason>();
  private elapsed = 0;
  private lastTime: number | null = null;

  constructor(private duration: number) {
    AutoplayClock.assertDuration(duration);
  }

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

  public setPaused(reason: Reason, paused: boolean): void {
    if (paused) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
  }

  public restart(): void {
    this.elapsed = 0;
  }

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
