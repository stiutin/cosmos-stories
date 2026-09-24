import type { CarouselOptions, CarouselState } from './carousel-engine';
import { CarouselEngine, DEFAULT_CAROUSEL_OPTIONS } from './carousel-engine';

function create(options: Partial<CarouselOptions> = {}, count = 3): CarouselEngine {
  const engine = new CarouselEngine({ interval: 1000, ...options });
  engine.setCount(count);
  return engine;
}

/** Simulates the renderer finishing the current transition. */
function finish(engine: CarouselEngine): CarouselState {
  engine.settle();
  return engine.getState();
}

describe('CarouselEngine', () => {
  describe('initial state', () => {
    it('starts on the first slide, after the leading clone', () => {
      const state = create().getState();

      expect(state).toMatchObject({ count: 3, index: 0, position: 1, renderedCount: 5 });
      expect(state).toMatchObject({ phase: 'idle', playing: true, canPrev: true, canNext: true });
    });

    it('has no clones without looping', () => {
      expect(create({ loop: false }).getState()).toMatchObject({ position: 0, renderedCount: 3 });
    });

    it('respects autoplay: false', () => {
      expect(create({ autoplay: false }).getState()).toMatchObject({
        playing: false,
        paused: true,
      });
    });
  });

  describe('looping navigation', () => {
    it('animates forward and settles', () => {
      const engine = create();
      engine.next();

      expect(engine.getState()).toMatchObject({ index: 1, position: 2, phase: 'animating' });
      expect(engine.getState().animate).toBe(true);
      expect(finish(engine).phase).toBe('idle');
    });

    it('goes from the last slide onto the trailing clone, then jumps to the first slide', () => {
      const engine = create();
      engine.goTo(2);
      finish(engine);

      engine.next();
      expect(engine.getState()).toMatchObject({ index: 0, position: 4, animate: true });

      expect(finish(engine)).toMatchObject({ index: 0, position: 1, animate: false });
    });

    it('goes backwards from the first slide through the leading clone', () => {
      const engine = create();
      engine.prev();
      expect(engine.getState()).toMatchObject({ index: 2, position: 0 });
      expect(finish(engine)).toMatchObject({ position: 3, animate: false });
    });

    it('queues a move that arrives before the clone jump was painted', () => {
      const engine = create();
      engine.goTo(2);
      finish(engine);
      engine.next(); // onto the clone at position 4, not settled yet

      engine.next();
      expect(engine.getState()).toMatchObject({ position: 1, animate: false, hasPending: true });

      engine.resolvePending();
      expect(engine.getState()).toMatchObject({
        index: 1,
        position: 2,
        animate: true,
        hasPending: false,
      });
    });

    it('does not animate goTo backwards from a clone', () => {
      const engine = create();
      engine.goTo(2);
      finish(engine);
      engine.next(); // clone of slide 0 at position 4

      engine.goTo(1);
      expect(engine.getState()).toMatchObject({ position: 1, hasPending: true });
      engine.resolvePending();
      expect(engine.getState()).toMatchObject({ index: 1, position: 2 });
    });

    it('ignores goTo to the current slide or out of range', () => {
      const engine = create();
      const before = engine.getState();

      engine.goTo(0);
      engine.goTo(-1);
      engine.goTo(7);
      expect(engine.getState()).toBe(before);
    });
  });

  describe('without looping', () => {
    it('stops at the ends', () => {
      const engine = create({ loop: false });
      engine.prev();
      expect(engine.getState()).toMatchObject({ index: 0, canPrev: false });

      engine.goTo(2);
      finish(engine);
      engine.next();
      expect(engine.getState()).toMatchObject({ index: 2, canNext: false });
    });

    it('damps dragging past an edge', () => {
      const engine = create({ loop: false, edgeResistance: 0.5 });
      engine.dragStart();

      engine.dragMove(100);
      expect(engine.getState().dragOffset).toBe(50);
      engine.dragMove(-100);
      expect(engine.getState().dragOffset).toBe(-100);
    });

    it('rewinds to the first slide when autoplay reaches the end', () => {
      const engine = create({ loop: false });
      engine.goTo(2);
      finish(engine);

      engine.tick(0);
      engine.tick(1000);
      expect(engine.getState().index).toBe(0);
    });
  });

  describe('without animation (reduced motion)', () => {
    it('jumps straight to real slides and never rests on a clone', () => {
      const engine = create({ animated: false });
      engine.prev();

      expect(engine.getState()).toMatchObject({
        index: 2,
        position: 3,
        animate: false,
        phase: 'idle',
      });
    });
  });

  describe('dragging', () => {
    it('follows the pointer and pauses autoplay', () => {
      const engine = create();
      engine.dragStart();
      engine.dragMove(-40);

      expect(engine.getState()).toMatchObject({ phase: 'dragging', dragOffset: -40, paused: true });
      expect(engine.isPausedBy('drag')).toBe(true);
    });

    it('moves on a swipe and snaps back otherwise', () => {
      const engine = create();
      engine.dragStart();
      engine.dragEnd(1);
      expect(engine.getState()).toMatchObject({ index: 1, dragOffset: 0, animate: true });

      finish(engine);
      engine.dragStart();
      engine.dragMove(-20);
      engine.dragEnd(0);
      expect(engine.getState()).toMatchObject({ index: 1, dragOffset: 0, phase: 'idle' });
      expect(engine.isPausedBy('drag')).toBe(false);
    });

    it('settles a clone before dragging so the drag starts from a real slide', () => {
      const engine = create();
      engine.prev(); // leading clone
      engine.dragStart();

      expect(engine.getState()).toMatchObject({ position: 3, phase: 'dragging' });
    });

    it('ignores drags with a single slide', () => {
      const engine = create({}, 1);
      engine.dragStart();
      expect(engine.getState().phase).toBe('idle');
    });
  });

  describe('autoplay', () => {
    it('advances after the interval and reports progress', () => {
      const engine = create();
      engine.tick(0);
      engine.tick(500);
      expect(engine.getState().progress).toBeCloseTo(0.5);

      engine.tick(1000);
      expect(engine.getState()).toMatchObject({ index: 1, progress: 0 });
    });

    it('can be paused, resumed and toggled', () => {
      const engine = create();
      engine.pause();
      engine.tick(0);
      engine.tick(5000);
      expect(engine.getState()).toMatchObject({ index: 0, playing: false });

      engine.toggle();
      engine.tick(6000);
      expect(engine.getState()).toMatchObject({ index: 1, playing: true });
    });

    it('stays paused while any temporary reason holds', () => {
      const engine = create();
      engine.setPaused('hover', true);
      engine.setPaused('hidden', true);
      engine.setPaused('hover', false);
      engine.tick(0);
      engine.tick(5000);

      expect(engine.getState()).toMatchObject({ index: 0, playing: true, paused: true });
    });

    it('restarts the cycle after manual navigation', () => {
      const engine = create();
      engine.tick(0);
      engine.tick(900);
      engine.next();

      expect(engine.getState().progress).toBe(0);
    });

    it('does nothing with fewer than two slides', () => {
      const engine = create({}, 1);
      engine.tick(0);
      engine.tick(5000);
      expect(engine.getState().index).toBe(0);
    });
  });

  describe('configuration', () => {
    it('keeps the current slide when looping is switched off and on', () => {
      const engine = create();
      engine.goTo(2);
      finish(engine);

      engine.setOptions({ loop: false });
      expect(engine.getState()).toMatchObject({ index: 2, position: 2, renderedCount: 3 });
      engine.setOptions({ loop: true });
      expect(engine.getState()).toMatchObject({ index: 2, position: 3, renderedCount: 5 });
    });

    it('clamps the index when slides are removed', () => {
      const engine = create();
      engine.goTo(2);
      finish(engine);
      engine.setCount(2);

      expect(engine.getState()).toMatchObject({ count: 2, index: 1 });
    });
  });

  describe('subscriptions', () => {
    it('notifies listeners on change only, until they unsubscribe', () => {
      const engine = create();
      const listener = vi.fn();
      const unsubscribe = engine.subscribe(listener);

      engine.goTo(0); // no change
      expect(listener).not.toHaveBeenCalled();

      engine.next();
      expect(listener).toHaveBeenCalledWith(engine.getState());

      unsubscribe();
      engine.next();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('drops every listener on destroy', () => {
      const engine = create();
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.destroy();
      engine.next();
      expect(listener).not.toHaveBeenCalled();
    });

    it('merges options with the defaults', () => {
      const engine = new CarouselEngine({ interval: 500 });
      expect(engine.getOptions()).toEqual({ ...DEFAULT_CAROUSEL_OPTIONS, interval: 500 });
    });
  });
});
