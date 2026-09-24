import {
  indexToPosition,
  isClonePosition,
  normalizePosition,
  positionToIndex,
  withClones,
} from './loop';

describe('withClones', () => {
  it('wraps the slides with clones of the last and first slide', () => {
    const rendered = withClones(['a', 'b', 'c']);

    expect(rendered.map((entry) => entry.item)).toEqual(['c', 'a', 'b', 'c', 'a']);
    expect(rendered.map((entry) => entry.isClone)).toEqual([true, false, false, false, true]);
    expect(rendered.map((entry) => entry.index)).toEqual([2, 0, 1, 2, 0]);
  });

  it('gives every rendered item a unique key', () => {
    const keys = withClones(['a', 'b', 'c']).map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not clone a single slide or an empty list', () => {
    expect(withClones(['a'])).toHaveLength(1);
    expect(withClones([])).toHaveLength(0);
  });
});

describe('positions', () => {
  const count = 3;

  it('maps indexes to positions after the leading clone', () => {
    expect([0, 1, 2].map((index) => indexToPosition(index, count))).toEqual([1, 2, 3]);
  });

  it('maps clone positions to the slides they mirror', () => {
    expect(positionToIndex(0, count)).toBe(2);
    expect(positionToIndex(4, count)).toBe(0);
    expect(positionToIndex(2, count)).toBe(1);
  });

  it('detects clone positions', () => {
    expect([0, 1, 2, 3, 4].map((position) => isClonePosition(position, count))).toEqual([
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it('normalizes clone positions to the matching real positions', () => {
    expect(normalizePosition(0, count)).toBe(3);
    expect(normalizePosition(4, count)).toBe(1);
    expect(normalizePosition(2, count)).toBe(2);
  });

  it('uses plain positions when looping is impossible', () => {
    expect(indexToPosition(0, 1)).toBe(0);
    expect(positionToIndex(0, 1)).toBe(0);
    expect(isClonePosition(0, 1)).toBe(false);
  });

  it('uses plain, clamped positions when looping is turned off', () => {
    expect(withClones(['a', 'b', 'c'], false)).toHaveLength(3);
    expect(indexToPosition(2, count, false)).toBe(2);
    expect(positionToIndex(5, count, false)).toBe(2);
    expect(positionToIndex(-1, count, false)).toBe(0);
    expect(isClonePosition(0, count, false)).toBe(false);
  });
});
