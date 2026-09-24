import { DEFAULT_SWIPE_OPTIONS, SwipeTracker } from './swipe-tracker';

const WIDTH = 400;

function drag(points: readonly [x: number, y: number, time: number][]): SwipeTracker {
  const tracker = new SwipeTracker();
  const [first, ...rest] = points;
  if (!first) throw new Error('At least one point is required');
  tracker.start(...first);
  for (const point of rest) tracker.move(...point);
  return tracker;
}

describe('SwipeTracker', () => {
  it('stays unlocked inside the deadzone', () => {
    const tracker = drag([
      [0, 0, 0],
      [4, 3, 10],
    ]);
    expect(tracker.axis).toBeNull();
  });

  it('locks to the dominant axis and reports the horizontal offset', () => {
    const tracker = new SwipeTracker();
    tracker.start(100, 100, 0);

    expect(tracker.move(70, 105, 16)).toBe(-30);
    expect(tracker.axis).toBe('horizontal');
  });

  it('ignores vertical gestures', () => {
    const tracker = drag([
      [100, 100, 0],
      [102, 200, 100],
    ]);
    expect(tracker.axis).toBe('vertical');
    expect(tracker.end(102, 0, 120, WIDTH)).toBe(0);
  });

  it('treats a long slow drag as a swipe', () => {
    const tracker = drag([
      [300, 0, 0],
      [250, 0, 400],
      [180, 0, 800],
    ]);
    expect(tracker.end(180, 0, 1200, WIDTH)).toBe(1);
  });

  it('snaps back after a short slow drag', () => {
    const tracker = drag([
      [200, 0, 0],
      [170, 0, 500],
    ]);
    expect(tracker.end(170, 0, 1000, WIDTH)).toBe(0);
  });

  it('treats a short fast flick as a swipe', () => {
    const tracker = drag([
      [100, 0, 0],
      [130, 0, 30],
      [160, 0, 60],
    ]);
    expect(tracker.end(170, 0, 70, WIDTH)).toBe(-1);
  });

  it('does not count a flick if the finger stopped before release', () => {
    const tracker = drag([
      [100, 0, 0],
      [160, 0, 60],
      [160, 0, 400],
    ]);
    expect(tracker.end(160, 0, 500, WIDTH)).toBe(0);
  });

  it('does not count a flick back towards the start as a swipe that way', () => {
    // Dragged far left, then flicked right a little: net movement still left and short.
    const tracker = drag([
      [200, 0, 0],
      [150, 0, 300],
      [170, 0, 330],
    ]);
    expect(tracker.end(175, 0, 335, WIDTH)).toBe(0);
  });

  it('navigates along the vertical axis when configured', () => {
    const tracker = new SwipeTracker({ ...DEFAULT_SWIPE_OPTIONS, axis: 'vertical' });
    tracker.start(100, 400, 0);

    expect(tracker.move(104, 300, 200)).toBe(-100);
    expect(tracker.isNavigating).toBe(true);
    expect(tracker.end(104, 250, 400, WIDTH)).toBe(1);
  });

  it('leaves horizontal movement alone in vertical mode', () => {
    const tracker = new SwipeTracker({ ...DEFAULT_SWIPE_OPTIONS, axis: 'vertical' });
    tracker.start(100, 100, 0);

    expect(tracker.move(250, 104, 100)).toBe(0);
    expect(tracker.isNavigating).toBe(false);
  });
});
