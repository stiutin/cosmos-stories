import type { StoryGroup } from '../data/apod/apod.groups';

/** Points at one story: the group index and the story index inside that group. */
export interface StoryCursor {
  readonly group: number;
  readonly story: number;
}

/** The cursor after `cursor`, crossing into the next group; `null` after the very last story. */
export function nextCursor(groups: readonly StoryGroup[], cursor: StoryCursor): StoryCursor | null {
  const group = groups[cursor.group];
  if (!group) return null;
  if (cursor.story + 1 < group.entries.length)
    return { group: cursor.group, story: cursor.story + 1 };
  return cursor.group + 1 < groups.length ? { group: cursor.group + 1, story: 0 } : null;
}

/**
 * The cursor before `cursor`. From a group's first story it goes to the last story
 * of the previous group; before the very first story it returns `null`.
 */
export function prevCursor(groups: readonly StoryGroup[], cursor: StoryCursor): StoryCursor | null {
  if (cursor.story > 0) return { group: cursor.group, story: cursor.story - 1 };
  const previous = groups[cursor.group - 1];
  return previous ? { group: cursor.group - 1, story: previous.entries.length - 1 } : null;
}

/** Finds a story by group id and entry date (deep links). Unknown date → the group's first story. */
export function findCursor(
  groups: readonly StoryGroup[],
  groupId: string,
  date: string | null,
): StoryCursor | null {
  const group = groups.findIndex((candidate) => candidate.id === groupId);
  if (group === -1) return null;
  const story = groups[group]?.entries.findIndex((entry) => entry.date === date) ?? -1;
  return { group, story: Math.max(story, 0) };
}
