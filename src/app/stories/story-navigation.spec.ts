import type {StoryGroup} from '../data/apod/apod.groups';
import {makeEntry} from '../data/apod/apod.testing';
import {findCursor, nextCursor, prevCursor} from './story-navigation';

const groups: StoryGroup[] = [
  {id: 'latest', title: 'Latest', entries: [makeEntry('2026-09-22'), makeEntry('2026-09-21')]},
  {id: 'galaxies', title: 'Galaxies', entries: [makeEntry('2026-09-10')]},
  {id: 'stars', title: 'Stars', entries: [makeEntry('2026-09-05'), makeEntry('2026-09-01')]},
];

describe('story navigation', () => {
  it('moves forward inside a group, then into the next group', () => {
    expect(nextCursor(groups, {group: 0, story: 0})).toEqual({group: 0, story: 1});
    expect(nextCursor(groups, {group: 0, story: 1})).toEqual({group: 1, story: 0});
  });

  it('ends after the last story of the last group', () => {
    expect(nextCursor(groups, {group: 2, story: 1})).toBeNull();
    expect(nextCursor(groups, {group: 9, story: 0})).toBeNull();
  });

  it('moves back inside a group, then to the last story of the previous group', () => {
    expect(prevCursor(groups, {group: 2, story: 1})).toEqual({group: 2, story: 0});
    expect(prevCursor(groups, {group: 2, story: 0})).toEqual({group: 1, story: 0});
    expect(prevCursor(groups, {group: 1, story: 0})).toEqual({group: 0, story: 1});
  });

  it('has nothing before the very first story', () => {
    expect(prevCursor(groups, {group: 0, story: 0})).toBeNull();
  });

  it('finds deep-linked stories', () => {
    expect(findCursor(groups, 'stars', '2026-09-01')).toEqual({group: 2, story: 1});
    expect(findCursor(groups, 'stars', '1999-01-01')).toEqual({group: 2, story: 0});
    expect(findCursor(groups, 'stars', null)).toEqual({group: 2, story: 0});
    expect(findCursor(groups, 'nope', null)).toBeNull();
  });
});
