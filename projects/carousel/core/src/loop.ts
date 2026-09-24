/**
 * Seamless looping with clones.
 *
 * The track renders `[clone of last, ...slides, clone of first]`. Moving past either
 * end animates onto a clone (so the motion keeps its direction), and once the
 * transition finishes the track jumps, without animation, to the real slide the
 * clone mirrors. The jump is invisible because both show identical content.
 *
 * "Index" is a slide's place in the data (0..count-1).
 * "Position" is its place in the rendered track (0..count+1 with clones).
 *
 * Every helper takes `loop`: with `loop = false` (or fewer than two slides)
 * there are no clones and positions equal indexes.
 */

export interface RenderedItem<T> {
  /** Stable key for `@for ... track`. Clones need their own keys. */
  readonly key: string;
  readonly item: T;
  /** Index of the real slide this item shows. */
  readonly index: number;
  readonly isClone: boolean;
}

export function hasClones(count: number, loop = true): boolean {
  return loop && count > 1;
}

export function withClones<T>(items: readonly T[], loop = true): RenderedItem<T>[] {
  const real = items.map((item, index) => ({ key: `slide-${index}`, item, index, isClone: false }));
  const first = items[0];
  const last = items[items.length - 1];
  if (!hasClones(items.length, loop) || first === undefined || last === undefined) return real;

  return [
    { key: 'clone-last', item: last, index: items.length - 1, isClone: true },
    ...real,
    { key: 'clone-first', item: first, index: 0, isClone: true },
  ];
}

export function indexToPosition(index: number, count: number, loop = true): number {
  return hasClones(count, loop) ? index + 1 : index;
}

/** Maps any track position (including clones) back to the real slide index. */
export function positionToIndex(position: number, count: number, loop = true): number {
  if (count === 0) return 0;
  if (!hasClones(count, loop)) return Math.min(Math.max(position, 0), count - 1);
  return (((position - 1) % count) + count) % count;
}

export function isClonePosition(position: number, count: number, loop = true): boolean {
  return hasClones(count, loop) && (position <= 0 || position >= count + 1);
}

/** The real-slide position that shows the same content as `position`. */
export function normalizePosition(position: number, count: number, loop = true): number {
  return indexToPosition(positionToIndex(position, count, loop), count, loop);
}
