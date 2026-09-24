import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { ApodService } from '../data/apod/apod.service';
import { fakeApodService } from '../data/apod/apod.service.fake';
import { makeEntry } from '../data/apod/apod.testing';
import { queryRequired } from '../../testing/dom';
import { SeenStoriesService } from './seen-stories.service';
import { StoriesPlayer, STORY_DURATION_MS } from './stories-player';
import { StoryTransitionService } from './story-transition';

// Groups built from these: latest [22, 21, 20], solar-system [22], galaxies [21], nebulae [20].
const ENTRIES = [
  makeEntry('2026-09-22', { title: 'Mars at Dawn' }),
  makeEntry('2026-09-21', { title: 'A Spiral Galaxy' }),
  makeEntry('2026-09-20', { title: 'The Veil Nebula' }),
];

describe('StoriesPlayer', () => {
  let harness: RouterTestingHarness;
  let router: Router;

  const root = (): HTMLElement => queryRequired(document, 'app-home');
  const player = (): StoriesPlayer => {
    const node = harness.fixture.debugElement.query(
      (candidate) => candidate.componentInstance instanceof StoriesPlayer,
    );
    const instance: unknown = node.componentInstance;
    if (!(instance instanceof StoriesPlayer)) throw new Error('Player is not open');
    return instance;
  };
  const activeFace = (): HTMLElement | null => document.querySelector<HTMLElement>('.face--active');
  const activeTitle = (): string | undefined =>
    activeFace()?.querySelector('.face__title')?.textContent.trim();

  async function settle(ms = 0): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    harness.fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    harness.fixture.detectChanges();
  }

  function loadImages(): void {
    document.querySelectorAll('.media__image').forEach((image) => {
      image.dispatchEvent(new Event('load'));
    });
    harness.fixture.detectChanges();
  }

  function key(name: string): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
    harness.fixture.detectChanges();
  }

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
    await harness.navigateByUrl(url);
    await settle(50);
    loadImages();
  }

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes, withComponentInputBinding()),
        { provide: ApodService, useValue: fakeApodService(ENTRIES) },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the deep-linked story with one progress segment per story', async () => {
    await open('/stories/latest/2026-09-21');

    expect(activeTitle()).toBe('A Spiral Galaxy');
    expect(activeFace()?.querySelectorAll('.segment')).toHaveLength(3);
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Stories: Latest',
    );
  });

  it('marks stories as seen once their picture is shown', async () => {
    await open('/stories/latest/2026-09-22');
    const seen = TestBed.inject(SeenStoriesService);
    expect(seen.seen().has('2026-09-22')).toBe(true);
    expect(seen.seen().has('2026-09-21')).toBe(false);

    key('ArrowRight');
    await settle();
    loadImages();
    expect(seen.seen().has('2026-09-21')).toBe(true);
  });

  it('gives the active story the shared view-transition name', async () => {
    await open('/stories/latest/2026-09-22');
    const media = document.querySelector<HTMLElement>('.face--active app-story-media');
    expect(media?.style.viewTransitionName).toBe('story-cover');
    expect(TestBed.inject(StoryTransitionService).groupId()).toBe('latest');
  });

  it('renders the page behind a deep-linked story only later', async () => {
    await open('/stories/latest/2026-09-22');
    expect(document.querySelector('app-story-rings')).toBeNull();

    key('Escape');
    await settle(50);
    expect(document.querySelector('app-story-rings')).not.toBeNull();
  });

  it('makes the page behind the player inert', async () => {
    await open('/stories/latest/2026-09-22');
    expect(root().querySelector('main.app')?.hasAttribute('inert')).toBe(true);
  });

  it('advances automatically, but only once the picture has loaded', async () => {
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
    await harness.navigateByUrl('/stories/latest/2026-09-22');
    await settle(STORY_DURATION_MS + 500);
    expect(player().isPausedBy('loading')).toBe(true);
    expect(activeTitle()).toBe('Mars at Dawn');

    loadImages();
    await settle(STORY_DURATION_MS + 100);
    expect(activeTitle()).toBe('A Spiral Galaxy');
    expect(router.url).toBe('/stories/latest/2026-09-21');
  });

  it('steps through stories with the keyboard', async () => {
    await open('/stories/latest/2026-09-22');

    key('ArrowRight');
    await settle();
    expect(activeTitle()).toBe('A Spiral Galaxy');

    key('ArrowLeft');
    await settle();
    expect(activeTitle()).toBe('Mars at Dawn');
  });

  it('turns the cube to the next group after the last story of a group', async () => {
    await open('/stories/latest/2026-09-20');

    key('ArrowRight');
    await settle(1000);

    expect(router.url).toBe('/stories/solar-system/2026-09-22');
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Stories: Solar System',
    );
  });

  it('closes after the very last story', async () => {
    await open('/stories/nebulae/2026-09-20');

    key('ArrowRight');
    await settle(100);

    expect(router.url).toBe('/');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('pauses with the pause button and with Space', async () => {
    await open('/stories/latest/2026-09-22');

    queryRequired(document, '[aria-label="Pause stories"]').click();
    harness.fixture.detectChanges();
    await settle(STORY_DURATION_MS * 2);
    expect(activeTitle()).toBe('Mars at Dawn');

    key(' ');
    expect(player().paused()).toBe(false);
  });

  it('pauses while the caption is expanded', async () => {
    await open('/stories/latest/2026-09-22');

    const more = [...document.querySelectorAll<HTMLButtonElement>('.text-button')].find(
      (button) => button.textContent.trim() === 'More',
    );
    more?.click();
    harness.fixture.detectChanges();

    expect(player().isPausedBy('caption')).toBe(true);
    expect(more?.getAttribute('aria-expanded')).toBe('true');

    key('Escape');
    expect(player().isPausedBy('caption')).toBe(false);
  });

  it('closes with Escape', async () => {
    await open('/stories/latest/2026-09-22');

    key('Escape');
    await settle(50);
    expect(router.url).toBe('/');
  });

  it('goes home for an unknown group', async () => {
    await open('/stories/unknown/2026-09-22');
    expect(router.url).toBe('/');
  });

  it('copies the link when the Web Share API is unavailable', async () => {
    await open('/stories/latest/2026-09-22');
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    await player().share();
    harness.fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/stories/latest/2026-09-22'));
    expect(document.querySelector('.player__toast')?.textContent).toContain('Link copied');
  });
});
