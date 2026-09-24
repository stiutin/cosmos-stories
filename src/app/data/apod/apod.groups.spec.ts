import {groupStories, LATEST_GROUP_SIZE} from './apod.groups';
import type {ApodEntry} from './apod.model';

function entry(date: string, title: string, explanation = 'Nothing special.'): ApodEntry {
  return {
    date,
    title,
    explanation,
    media: {kind: 'image', url: `https://example.com/${date}.jpg`, hdUrl: null},
    copyright: null,
    pageUrl: `https://apod.nasa.gov/apod/ap${date}.html`,
    cover: null,
  };
}

describe('groupStories', () => {
  const entries = [
    entry('2026-09-01', 'Andromeda Galaxy'),
    entry('2026-09-02', 'The Orion Nebula'),
    entry('2026-09-03', 'Mars at Dawn'),
    entry('2026-09-04', 'Untitled Wonder', 'A spiral galaxy hidden behind dust.'),
    entry('2026-09-05', 'Something Else'),
    entry('2026-09-06', 'Northern Aurora'),
    entry('2026-09-07', 'Pleiades Star Cluster'),
    entry('2026-09-08', 'Total Solar Eclipse'),
  ];
  const groups = groupStories(entries);
  const ids = groups.map((group) => group.id);
  const group = (id: string) => groups.find((candidate) => candidate.id === id);

  it('starts with the latest entries', () => {
    expect(groups[0]?.title).toBe('Latest');
    expect(groups[0]?.entries).toHaveLength(LATEST_GROUP_SIZE);
    expect(groups[0]?.entries[0]?.date).toBe('2026-09-08');
  });

  it('sorts entries into topics by title, then by explanation', () => {
    expect(group('galaxies')?.entries.map((e) => e.date)).toEqual(['2026-09-04', '2026-09-01']);
    expect(group('nebulae')?.entries.map((e) => e.date)).toEqual(['2026-09-02']);
    expect(group('solar-system')?.entries.map((e) => e.date)).toEqual(['2026-09-08', '2026-09-03']);
  });

  it('orders topics by their newest entry and puts "More" last', () => {
    expect(ids).toEqual(['latest', 'solar-system', 'stars', 'earth-sky', 'galaxies', 'nebulae', 'more']);
  });

  it('puts each entry in exactly one topic group', () => {
    const inTopics = groups.slice(1).flatMap((g) => g.entries.map((e) => e.date));
    expect(new Set(inTopics).size).toBe(entries.length);
    expect(inTopics).toHaveLength(entries.length);
  });

  it('returns no groups for no entries', () => {
    expect(groupStories([])).toEqual([]);
  });
});
