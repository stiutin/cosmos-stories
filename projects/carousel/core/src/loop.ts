export interface RenderedItem<T> {
  readonly key: string;
  readonly item: T;
  readonly index: number;
  readonly isClone: boolean;
}

export function hasClones(count: number, loop = true): boolean {
  return loop && count > 1;
}

export function withClones<T>(items: readonly T[], loop = true): RenderedItem<T>[] {
  const real = items.map((item, index) => ({key: `slide-${index}`, item, index, isClone: false}));
  const first = items[0];
  const last = items[items.length - 1];

  if (!hasClones(items.length, loop) || first === undefined || last === undefined) return real;

  return [
    {key: 'clone-last', item: last, index: items.length - 1, isClone: true},
    ...real,
    {key: 'clone-first', item: first, index: 0, isClone: true},
  ];
}

export function indexToPosition(index: number, count: number, loop = true): number {
  return hasClones(count, loop) ? index + 1 : index;
}

export function positionToIndex(position: number, count: number, loop = true): number {
  if (count === 0) return 0;

  if (!hasClones(count, loop)) return Math.min(Math.max(position, 0), count - 1);

  return (((position - 1) % count) + count) % count;
}

export function isClonePosition(position: number, count: number, loop = true): boolean {
  return hasClones(count, loop) && (position <= 0 || position >= count + 1);
}

export function normalizePosition(position: number, count: number, loop = true): number {
  return indexToPosition(positionToIndex(position, count, loop), count, loop);
}
