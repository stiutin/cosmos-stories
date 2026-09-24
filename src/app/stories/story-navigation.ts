import type {StoryGroup} from '../data/apod/apod.groups';

export interface StoryCursor {
  readonly group: number;
  readonly story: number;
}

export function nextCursor(groups: readonly StoryGroup[], cursor: StoryCursor): StoryCursor | null {
  const group = groups[cursor.group];
  if (!group) return null;
  if (cursor.story + 1 < group.entries.length) return {group: cursor.group, story: cursor.story + 1};
  return cursor.group + 1 < groups.length ? {group: cursor.group + 1, story: 0} : null;
}

export function prevCursor(groups: readonly StoryGroup[], cursor: StoryCursor): StoryCursor | null {
  if (cursor.story > 0) return {group: cursor.group, story: cursor.story - 1};
  const previous = groups[cursor.group - 1];
  return previous ? {group: cursor.group - 1, story: previous.entries.length - 1} : null;
}

export function findCursor(groups: readonly StoryGroup[], groupId: string, date: string | null): StoryCursor | null {
  const group = groups.findIndex((candidate) => candidate.id === groupId);
  if (group === -1) return null;
  const story = groups[group]?.entries.findIndex((entry) => entry.date === date) ?? -1;
  return {group, story: Math.max(story, 0)};
}
