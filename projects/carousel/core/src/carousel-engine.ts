import type {PauseReason} from './autoplay-clock';
import {AutoplayClock} from './autoplay-clock';
import {hasClones, indexToPosition, isClonePosition, normalizePosition, positionToIndex} from './loop';

export interface CarouselOptions {
  readonly loop: boolean;
  readonly autoplay: boolean;
  readonly interval: number;
  readonly animated: boolean;
  readonly edgeResistance: number;
}

export const DEFAULT_CAROUSEL_OPTIONS: CarouselOptions = {
  loop: true,
  autoplay: true,
  interval: 10_000,
  animated: true,
  edgeResistance: 0.35,
};

export type CarouselPhase = 'idle' | 'animating' | 'dragging';

export interface CarouselState {
  readonly count: number;
  readonly index: number;
  readonly position: number;
  readonly renderedCount: number;
  readonly phase: CarouselPhase;
  readonly animate: boolean;
  readonly dragOffset: number;
  readonly playing: boolean;
  readonly paused: boolean;
  readonly progress: number;
  readonly hasPending: boolean;
  readonly canPrev: boolean;
  readonly canNext: boolean;
}

export type CarouselListener = (state: CarouselState) => void;

export class CarouselEngine {
  private options: CarouselOptions;
  private readonly clock: AutoplayClock;
  private readonly listeners = new Set<CarouselListener>();
  private state: CarouselState;
  private pendingPosition: number | null = null;

  constructor(options: Partial<CarouselOptions> = {}) {
    this.options = {...DEFAULT_CAROUSEL_OPTIONS, ...options};
    this.clock = new AutoplayClock(this.options.interval);
    this.clock.setPaused('user', !this.options.autoplay);
    this.state = this.buildState({count: 0, position: 0, phase: 'idle', animate: false});
  }

  public getState(): CarouselState {
    return this.state;
  }

  public getOptions(): CarouselOptions {
    return this.options;
  }

  public subscribe(listener: CarouselListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public destroy(): void {
    this.listeners.clear();
  }

  public setOptions(options: Partial<Omit<CarouselOptions, 'autoplay'>>): void {
    const {index} = this.state;
    this.options = {...this.options, ...options};

    if (options.interval !== undefined) this.clock.setDuration(options.interval);

    this.pendingPosition = null;
    this.update({
      position: indexToPosition(index, this.state.count, this.options.loop),
      phase: 'idle',
      animate: false,
    });
  }

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

  public next(): void {
    this.moveBy(1);
  }

  public prev(): void {
    this.moveBy(-1);
  }

  public goTo(index: number): void {
    const {count} = this.state;
    if (count === 0 || index < 0 || index >= count) return;

    const target = indexToPosition(index, count, this.options.loop);

    if (this.isOnClone()) {
      this.jumpOffClone(target);
      return;
    }

    if (target === this.state.position) return;

    this.moveTo(target);
  }

  public settle(): void {
    if (this.state.phase !== 'animating') return;

    if (this.isOnClone()) {
      this.update({
        position: this.normalized(this.state.position),
        phase: 'idle',
        animate: false,
      });
    } else {
      this.update({phase: 'idle'});
    }
  }

  public resolvePending(): void {
    if (this.pendingPosition === null) return;

    const target = this.pendingPosition;
    this.pendingPosition = null;
    this.moveTo(target);
  }

  private moveBy(step: 1 | -1): void {
    const {count, index, position} = this.state;
    if (count < 2) return;

    if (!this.options.loop) {
      const target = index + step;
      if (target >= 0 && target < count) this.moveTo(target);
      else this.update({animate: true, phase: 'idle'});
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
      this.update({position: this.normalized(position), phase: 'idle', animate: false});
      return;
    }

    this.update({position, phase: 'animating', animate: true});
  }

  private jumpOffClone(target: number): void {
    this.pendingPosition = target;
    this.update({position: this.normalized(this.state.position), phase: 'idle', animate: false});
  }

  public dragStart(): void {
    if (this.state.count < 2) return;

    this.settle();
    this.pendingPosition = null;
    this.clock.setPaused('drag', true);
    this.update({phase: 'dragging', dragOffset: 0, animate: false});
  }

  public dragMove(offset: number): void {
    if (this.state.phase !== 'dragging') return;

    const {canPrev, canNext} = this.state;
    const beyondEdge = (offset > 0 && !canPrev) || (offset < 0 && !canNext);
    this.update({dragOffset: beyondEdge ? offset * this.options.edgeResistance : offset});
  }

  public dragEnd(direction: -1 | 0 | 1): void {
    if (this.state.phase !== 'dragging') return;

    this.clock.setPaused('drag', false);
    this.update({phase: 'idle', dragOffset: 0, animate: true});

    if (direction !== 0) this.moveBy(direction);
  }

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
    if (this.state.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  public setPaused(reason: Exclude<PauseReason, 'user' | 'drag'>, paused: boolean): void {
    this.clock.setPaused(reason, paused);
    this.update({});
  }

  public isPausedBy(reason: PauseReason): boolean {
    return this.clock.hasReason(reason);
  }

  public tick(now: number): void {
    const completed = this.clock.tick(now);

    if (completed && this.state.count > 1) {
      if (this.state.canNext) this.next();
      else this.goTo(0);
    }

    if (this.state.progress !== this.clock.progress) this.update({});
  }

  private isOnClone(): boolean {
    return isClonePosition(this.state.position, this.state.count, this.options.loop);
  }

  private normalized(position: number): number {
    return normalizePosition(position, this.state.count, this.options.loop);
  }

  private update(patch: Partial<CarouselState>): void {
    const next = this.buildState({...this.state, ...patch});

    if (shallowEqual(next, this.state)) return;

    this.state = next;

    for (const listener of this.listeners) listener(next);
  }

  private buildState(base: Partial<CarouselState>): CarouselState {
    const count = base.count ?? 0;
    const position = base.position ?? 0;
    const {loop} = this.options;
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
