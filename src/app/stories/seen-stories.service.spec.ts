import { TestBed } from '@angular/core/testing';
import type { StoryGroup } from '../data/apod/apod.groups';
import { makeEntry } from '../data/apod/apod.testing';
import { SEEN_STORAGE_KEY, SeenStoriesService } from './seen-stories.service';

const group: StoryGroup = {
  id: 'latest',
  title: 'Latest',
  entries: [makeEntry('2026-09-22'), makeEntry('2026-09-21'), makeEntry('2026-09-20')],
};

describe('SeenStoriesService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks seen stories and persists them', () => {
    const service = TestBed.inject(SeenStoriesService);
    service.markSeen('2026-09-22');

    expect(service.seen().has('2026-09-22')).toBe(true);
    expect(JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) ?? '[]')).toEqual(['2026-09-22']);
  });

  it('restores what was seen in a previous visit', () => {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(['2026-09-21', 42]));
    expect(TestBed.inject(SeenStoriesService).seen()).toEqual(new Set(['2026-09-21']));
  });

  it('knows when a whole group is seen and where to resume', () => {
    const service = TestBed.inject(SeenStoriesService);
    service.markSeen('2026-09-22');
    expect(service.isGroupSeen(group)).toBe(false);
    expect(service.firstUnseenIndex(group)).toBe(1);

    service.markSeen('2026-09-21');
    service.markSeen('2026-09-20');
    expect(service.isGroupSeen(group)).toBe(true);
    expect(service.firstUnseenIndex(group)).toBe(0);
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem(SEEN_STORAGE_KEY, '{oops');
    expect(TestBed.inject(SeenStoriesService).seen().size).toBe(0);
  });

  it('keeps working when storage refuses to save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const service = TestBed.inject(SeenStoriesService);

    expect(() => {
      service.markSeen('2026-09-22');
    }).not.toThrow();
    expect(service.seen().has('2026-09-22')).toBe(true);
  });
});
