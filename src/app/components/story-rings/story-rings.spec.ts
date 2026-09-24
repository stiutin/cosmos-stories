import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { StoryGroup } from '../../data/apod/apod.groups';
import { makeEntry } from '../../data/apod/apod.testing';
import { SeenStoriesService } from '../../stories/seen-stories.service';
import { StoryTransitionService } from '../../stories/story-transition';
import { StoryRings } from './story-rings';

const GROUPS: StoryGroup[] = [
  { id: 'latest', title: 'Latest', entries: [makeEntry('2026-09-22'), makeEntry('2026-09-21')] },
  { id: 'empty', title: 'Empty', entries: [] },
  { id: 'stars', title: 'Stars', entries: [makeEntry('2026-09-05')] },
  { id: 'galaxies', title: 'Galaxies', entries: [makeEntry('2026-09-04')] },
];

@Component({ template: '' })
class PlayerStub {}

describe('StoryRings', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'stories/:groupId/:date', component: PlayerStub }])],
    });
  });

  function render(transitionsEnabled = true) {
    const fixture = TestBed.createComponent(StoryRings);
    fixture.componentRef.setInput('groups', GROUPS);
    fixture.componentRef.setInput('transitionsEnabled', transitionsEnabled);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const links = (): HTMLAnchorElement[] => [
      ...element.querySelectorAll<HTMLAnchorElement>('a.ring'),
    ];
    return { fixture, links };
  }

  it('links every non-empty group to its first story', () => {
    const { links } = render();

    expect(links().map((link) => link.getAttribute('href'))).toEqual([
      '/stories/latest/2026-09-22',
      '/stories/stars/2026-09-05',
      '/stories/galaxies/2026-09-04',
    ]);
    expect(links()[0]?.textContent).toContain('2 stories');
  });

  it('resumes a group at its first unseen story', () => {
    TestBed.inject(SeenStoriesService).markSeen('2026-09-22');
    const { links } = render();

    expect(links()[0]?.getAttribute('href')).toBe('/stories/latest/2026-09-21');
  });

  it('moves fully seen groups to the end, in grey', () => {
    TestBed.inject(SeenStoriesService).markSeen('2026-09-05');
    const { links } = render();

    expect(links().map((link) => link.textContent.trim().split(',')[0])).toEqual([
      'Latest',
      'Galaxies',
      'Stars',
    ]);
    expect(links()[2]?.classList).toContain('ring--seen');
    expect(links()[2]?.textContent).toContain('all seen');
  });

  it('names the clicked ring for the view transition, only while the player is closed', async () => {
    const { fixture, links } = render();
    links()[1]?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const avatar = (): string | undefined =>
      links()[1]?.querySelector<HTMLElement>('.ring__avatar')?.style.viewTransitionName;
    expect(TestBed.inject(StoryTransitionService).groupId()).toBe('stars');
    expect(avatar()).toBe('story-cover');

    fixture.componentRef.setInput('transitionsEnabled', false);
    fixture.detectChanges();
    expect(avatar()).toBe('');
  });
});
