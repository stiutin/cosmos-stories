import type { PauseReason } from './autoplay-clock';
import { AutoplayClock } from './autoplay-clock';
import {
  hasClones,
  indexToPosition,
  isClonePosition,
  normalizePosition,
  positionToIndex,
} from './loop';

export interface CarouselOptions {
  /** Wrap around seamlessly (with clones) instead of stopping at the ends. */
  readonly loop: boolean;
  /** Whether autoplay starts playing. Afterwards use `play()` / `pause()`. */
  readonly autoplay: boolean;
  /** Autoplay cycle length in ms. */
  readonly interval: number;
  /**
   * `false` for reduced motion: every move becomes an instant jump, and the
   * renderer never has to deal with clones.
   */
  readonly animated: boolean;
  /** Drag damping past the first/last slide when not looping (0 = rigid, 1 = free). */
  readonly edgeResistance: number;
}

export const DEFAULT_CAROUSEL_OPTIONS: CarouselOptions = {
  loop: true,
  autoplay: true,
  interval: 10_000,
  animated: true,
  edgeResistance: 0.35,
};

/**
 * - `idle`      — resting on a slide;
 * - `animating` — moving to a new position; the renderer calls `settle()` when done;
 * - `dragging`  — following the user's pointer.
 */
export type CarouselPhase = 'idle' | 'animating' | 'dragging';

export interface CarouselState {
  readonly count: number;
  /** The real slide (0..count-1) that is showing or being moved to. */
  readonly index: number;
  /** Position in the rendered track, clones included. Render: translate by `-position × 100%`. */
  readonly position: number;
  /** Number of rendered items: `count`, plus 2 clones when looping. */
  readonly renderedCount: number;
  readonly phase: CarouselPhase;
  /** Whether the renderer should transition to `position` or jump there. */
  readonly animate: boolean;
  /** Pixel offset to add to the position while dragging. */
  readonly dragOffset: number;
  /** The user's play/pause choice. */
  readonly playing: boolean;
  /** Whether autoplay time is currently frozen for any reason (including not playing). */
  readonly paused: boolean;
  /** Progress of the current autoplay cycle, 0..1. */
  readonly progress: number;
  /**
   * A move is waiting for the renderer to paint a jump first.
   * The renderer must call `resolvePending()` on the next frame.
   */
  readonly hasPending: boolean;
  readonly canPrev: boolean;
  readonly canNext: boolean;
}

export type CarouselListener = (state: CarouselState) => void;

/**
 * Framework-agnostic carousel state machine.
 *
 * It holds no DOM references, timers or animation frames. The host
 * (an Angular component, a React hook, a test…) feeds it commands, input and
 * timestamps, subscribes to state changes, and renders them. That split is what
 * makes the whole behaviour unit-testable and the engine reusable.
 *
 * Renderer contract:
 * 1. Translate the track to `-state.position` slides, plus `state.dragOffset` px.
 * 2. Use a transition only when `state.animate` is true and `phase !== 'dragging'`.
 * 3. Call `settle()` when that transition ends.
 * 4. When `state.hasPending` is true, paint, then call `resolvePending()` on the next frame.
 * 5. Call `tick(now)` on every animation frame for autoplay.
 */
export class CarouselEngine {
  private options: CarouselOptions;
  private readonly clock: AutoplayClock;
  private readonly listeners = new Set<CarouselListener>();
  private state: CarouselState;
  private pendingPosition: number | null = null;

  constructor(options: Partial<CarouselOptions> = {}) {
    this.options = { ...DEFAULT_CAROUSEL_OPTIONS, ...options };
    this.clock = new AutoplayClock(this.options.interval);
    this.clock.setPaused('user', !this.options.autoplay);
    this.state = this.buildState({ count: 0, position: 0, phase: 'idle', animate: false });
  }

  public getState(): CarouselState {
    return this.state;
  }

  public getOptions(): CarouselOptions {
    return this.options;
  }

  /** Registers a listener for state changes. Returns an unsubscribe function. */
  public subscribe(listener: CarouselListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public destroy(): void {
    this.listeners.clear();
  }

  // ─── Configuration ──────────────────────────────────────────────────────

  public setOptions(options: Partial<Omit<CarouselOptions, 'autoplay'>>): void {
    const { index } = this.state;
    this.options = { ...this.options, ...options };
    if (options.interval !== undefined) this.clock.setDuration(options.interval);
    this.pendingPosition = null;
    this.update({
      position: indexToPosition(index, this.state.count, this.options.loop),
      phase: 'idle',
      animate: false,
    });
  }

  /** Call whenever the number of slides changes. Keeps the current index when possible. */
  public setCount(count: number): void {
    const index = Math.min(this.state.index, Math.max(count - 1, 0));
    this.pendingPosition = null;
    this.clock.restart();
    this.update({
      count,
      position: indexToPosition(index, count, this.options.loop),
      phase: 'idle',
      animate: false,
      dragOffset: 0,
    });
  }

  // ─── Navigation ─────────────────────────────────────────────────────────

  public next(): void {
    this.moveBy(1);
  }

  public prev(): void {
    this.moveBy(-1);
  }

  public goTo(index: number): void {
    const { count } = this.state;
    if (count === 0 || index < 0 || index >= count) return;

    const target = indexToPosition(index, count, this.options.loop);
    if (this.isOnClone()) {
      this.jumpOffClone(target);
      return;
    }
    if (target === this.state.position) return;
    this.moveTo(target);
  }

  /** The renderer finished animating to `position`. */
  public settle(): void {
    if (this.state.phase !== 'animating') return;
    if (this.isOnClone()) {
      this.update({
        position: this.normalized(this.state.position),
        phase: 'idle',
        animate: false,
      });
    } else {
      this.update({ phase: 'idle' });
    }
  }

  /** The renderer has painted the jump off a clone: run the move that was waiting for it. */
  public resolvePending(): void {
    if (this.pendingPosition === null) return;
    const target = this.pendingPosition;
    this.pendingPosition = null;
    this.moveTo(target);
  }

  private moveBy(step: 1 | -1): void {
    const { count, index, position } = this.state;
    if (count < 2) return;

    if (!this.options.loop) {
      const target = index + step;
      if (target >= 0 && target < count) this.moveTo(target);
      else this.update({ animate: true, phase: 'idle' }); // Nowhere to go: snap back.
      return;
    }

    if (this.isOnClone()) {
      this.jumpOffClone(this.normalized(position) + step);
      return;
    }
    this.moveTo(position + step);
  }

  private moveTo(position: number): void {
    this.clock.restart();

    if (!this.options.animated) {
      this.update({ position: this.normalized(position), phase: 'idle', animate: false });
      return;
    }
    this.update({ position, phase: 'animating', animate: true });
  }

  /**
   * A move was requested while resting on a clone (the previous transition
   * hasn't settled yet). Jump to the matching real slide first; the move itself
   * has to wait until that jump is painted, or the browser would merge both.
   */
  private jumpOffClone(target: number): void {
    this.pendingPosition = target;
    this.update({ position: this.normalized(this.state.position), phase: 'idle', animate: false });
  }

  // ─── Dragging ───────────────────────────────────────────────────────────

  public dragStart(): void {
    if (this.state.count < 2) return;
    this.settle();
    this.pendingPosition = null;
    this.clock.setPaused('drag', true);
    this.update({ phase: 'dragging', dragOffset: 0, animate: false });
  }

  /**
   * `offset` is in px along the navigation axis (negative = towards the next slide).
   * Without looping, dragging past either end is damped.
   */
  public dragMove(offset: number): void {
    if (this.state.phase !== 'dragging') return;
    const { canPrev, canNext } = this.state;
    const beyondEdge = (offset > 0 && !canPrev) || (offset < 0 && !canNext);
    this.update({ dragOffset: beyondEdge ? offset * this.options.edgeResistance : offset });
  }

  /** `direction`: 1 = next, -1 = previous, 0 = snap back. */
  public dragEnd(direction: -1 | 0 | 1): void {
    if (this.state.phase !== 'dragging') return;
    this.clock.setPaused('drag', false);
    this.update({ phase: 'idle', dragOffset: 0, animate: true });
    if (direction !== 0) this.moveBy(direction);
  }

  // ─── Autoplay ───────────────────────────────────────────────────────────

  public play(): void {
    this.clock.setPaused('user', false);
    this.clock.restart();
    this.update({});
  }

  public pause(): void {
    this.clock.setPaused('user', true);
    this.update({});
  }

  public toggle(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }

  /** Temporarily freezes autoplay for a reason (hover, focus, hidden tab…). */
  public setPaused(reason: Exclude<PauseReason, 'user' | 'drag'>, paused: boolean): void {
    this.clock.setPaused(reason, paused);
    this.update({});
  }

  public isPausedBy(reason: PauseReason): boolean {
    return this.clock.hasReason(reason);
  }

  /** Advances autoplay. Call on every animation frame with a monotonic timestamp (ms). */
  public tick(now: number): void {
    const completed = this.clock.tick(now);
    if (completed && this.state.count > 1) {
      if (this.state.canNext) this.next();
      else this.goTo(0);
    }
    if (this.state.progress !== this.clock.progress) this.update({});
  }

  // ─── Internals ──────────────────────────────────────────────────────────

  private isOnClone(): boolean {
    return isClonePosition(this.state.position, this.state.count, this.options.loop);
  }

  private normalized(position: number): number {
    return normalizePosition(position, this.state.count, this.options.loop);
  }

  private update(patch: Partial<CarouselState>): void {
    const next = this.buildState({ ...this.state, ...patch });
    if (shallowEqual(next, this.state)) return;
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }

  private buildState(base: Partial<CarouselState>): CarouselState {
    const count = base.count ?? 0;
    const position = base.position ?? 0;
    const { loop } = this.options;
    const index = positionToIndex(position, count, loop);
    const looping = hasClones(count, loop);

    return {
      count,
      index,
      position,
      renderedCount: looping ? count + 2 : count,
      phase: base.phase ?? 'idle',
      animate: base.animate ?? false,
      dragOffset: base.dragOffset ?? 0,
      playing: !this.clock.hasReason('user'),
      paused: this.clock.isPaused,
      progress: this.clock.progress,
      hasPending: this.pendingPosition !== null,
      canPrev: looping || index > 0,
      canNext: looping || index < count - 1,
    };
  }
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  return (Object.keys(a) as (keyof T)[]).every((key) => a[key] === b[key]);
}
