import { AutoplayClock } from './autoplay-clock';

describe('AutoplayClock', () => {
  it('completes a cycle after the duration and reports progress', () => {
    const clock = new AutoplayClock(1000);
    clock.tick(0);

    expect(clock.tick(500)).toBe(false);
    expect(clock.progress).toBeCloseTo(0.5);
    expect(clock.tick(1000)).toBe(true);
    expect(clock.progress).toBe(0);
  });

  it('does not count time while paused', () => {
    const clock = new AutoplayClock(1000);
    clock.tick(0);
    clock.tick(400);

    clock.setPaused('hover', true);
    expect(clock.tick(5000)).toBe(false);
    expect(clock.progress).toBeCloseTo(0.4);

    clock.setPaused('hover', false);
    expect(clock.tick(5500)).toBe(false);
    expect(clock.progress).toBeCloseTo(0.9);
  });

  it('stays paused until every reason is released', () => {
    const clock = new AutoplayClock(1000);
    clock.setPaused('hover', true);
    clock.setPaused('focus', true);
    clock.setPaused('hover', false);

    expect(clock.isPaused).toBe(true);
    clock.setPaused('focus', false);
    expect(clock.isPaused).toBe(false);
  });

  it('restarts the current cycle', () => {
    const clock = new AutoplayClock(1000);
    clock.tick(0);
    clock.tick(800);
    clock.restart();

    expect(clock.progress).toBe(0);
    expect(clock.tick(1500)).toBe(false);
  });

  it('ignores the gap before the first tick and backwards timestamps', () => {
    const clock = new AutoplayClock(1000);
    expect(clock.tick(10_000)).toBe(false);
    expect(clock.tick(9_000)).toBe(false);
    expect(clock.progress).toBe(0);
  });

  it('rejects a non-positive duration', () => {
    expect(() => new AutoplayClock(0)).toThrow(RangeError);
    expect(() => {
      new AutoplayClock(1000).setDuration(-1);
    }).toThrow(RangeError);
  });

  it('keeps proportional progress when the duration changes', () => {
    const clock = new AutoplayClock(1000);
    clock.tick(0);
    clock.tick(500);
    clock.setDuration(4000);

    expect(clock.progress).toBeCloseTo(0.5);
    expect(clock.tick(2400)).toBe(false);
    expect(clock.tick(2500)).toBe(true);
  });

  it('accepts custom pause reasons', () => {
    const clock = new AutoplayClock<'hold' | 'loading'>(1000);
    clock.setPaused('loading', true);
    expect(clock.hasReason('loading')).toBe(true);
    expect(clock.isPaused).toBe(true);
  });
});
