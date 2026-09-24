import { DOCUMENT, Location } from '@angular/common';
import type { ElementRef } from '@angular/core';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import type { CarouselState } from '@cosmos-stories/carousel/core';
import { AutoplayClock, CarouselEngine } from '@cosmos-stories/carousel/core';
import { ApodService } from '../data/apod/apod.service';
import { coverImage, coverSources } from '../data/apod/apod.media';
import type { ApodEntry } from '../data/apod/apod.model';
import { formatApodDate } from '../services/banner.service';
import { StoryGesturesDirective } from './story-gestures.directive';
import { StoryMedia } from './story-media';
import type { StoryCursor } from './story-navigation';
import { findCursor, nextCursor, prevCursor } from './story-navigation';
import { StoryProgress } from './story-progress';
import { SeenStoriesService } from './seen-stories.service';
import { STORY_COVER_TRANSITION, StoryTransitionService } from './story-transition';

export const STORY_DURATION_MS = 7_000;
export const CUBE_TRANSITION_MS = 450;
const SETTLE_FALLBACK_MS = CUBE_TRANSITION_MS + 150;
const TOAST_MS = 2_000;

/** Why the story timer is frozen. Several reasons can hold at once. */
export type StoryPauseReason =
  'user' | 'hold' | 'hidden' | 'loading' | 'caption' | 'video' | 'moving' | 'dismiss';

interface Face {
  readonly group: number;
  readonly title: string;
  readonly entry: ApodEntry;
  readonly story: number;
  readonly count: number;
  readonly transform: string;
  readonly active: boolean;
}

/**
 * Instagram-style stories player.
 *
 * - **Stories inside a group** advance on an `AutoplayClock` (from the carousel core)
 *   with named pause reasons: hold, hidden tab, image loading, open caption or video…
 * - **Groups** are faces of a 3D cube. The cube is driven by the same `CarouselEngine`
 *   as the banner carousel (bounded mode with edge resistance); only the renderer
 *   differs: faces are rotated by `90° × (index − position)` instead of translated.
 * - **The URL** always points at the current story, so it can be shared or reloaded.
 */
@Component({
  selector: 'app-stories-player',
  imports: [StoryGesturesDirective, StoryMedia, StoryProgress],
  templateUrl: './stories-player.html',
  styleUrl: './stories-player.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:visibilitychange)': 'onVisibilityChange()',
  },
})
export class StoriesPlayer {
  private readonly apod = inject(ApodService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seenStories = inject(SeenStoriesService);
  private readonly transition = inject(StoryTransitionService);

  protected readonly coverTransition = STORY_COVER_TRANSITION;

  /** Route params (`/stories/:groupId/:date`), bound by `withComponentInputBinding`. */
  readonly groupId = input<string>('latest');
  readonly date = input<string | null>(null);

  protected readonly groups = this.apod.groups;
  protected readonly isLoading = this.apod.isLoading;

  private readonly reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Groups: the cube, driven by the carousel engine ───────────────────

  private readonly engine = new CarouselEngine({
    loop: false,
    autoplay: false,
    animated: !this.reducedMotion,
  });
  protected readonly cube = signal<CarouselState>(this.engine.getState());
  protected readonly groupIndex = computed(() => this.cube().index);

  /** Remembered story per group, so returning to a group resumes where you left it. */
  private readonly storyByGroup = signal<ReadonlyMap<number, number>>(new Map());

  readonly cursor = computed<StoryCursor>(() => {
    const group = this.groupIndex();
    return { group, story: this.storyByGroup().get(group) ?? 0 };
  });

  readonly currentGroup = computed(() => this.groups()[this.cursor().group] ?? null);
  readonly current = computed(() => this.currentGroup()?.entries[this.cursor().story] ?? null);

  // ─── Story timer ────────────────────────────────────────────────────────

  private readonly clock = new AutoplayClock<StoryPauseReason>(STORY_DURATION_MS);
  readonly paused = signal(false);
  protected readonly holding = signal(false);
  protected readonly captionOpen = signal(false);
  protected readonly dismissOffset = signal(0);
  protected readonly toast = signal<string | null>(null);
  /** Polite announcement for screen readers, set on user-initiated changes only. */
  protected readonly announcement = signal('');
  private readonly loaded = signal<ReadonlySet<string>>(new Set());
  /** Set once the route has been resolved to a story; nothing is synced back before that. */
  private readonly ready = signal(false);

  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  protected readonly width = signal(360);

  protected readonly faces = computed<Face[]>(() => {
    const { position, dragOffset } = this.cube();
    const width = Math.max(1, this.width());
    const half = width / 2;
    const drag = Math.max(-90, Math.min(90, (dragOffset / width) * 90));

    return this.groups().flatMap((group, index) => {
      if (Math.abs(index - position) > 1) return [];
      const story = this.storyByGroup().get(index) ?? 0;
      const entry = group.entries[story];
      if (!entry) return [];
      const angle = (index - position) * 90 + drag;
      return [
        {
          group: index,
          title: group.title,
          entry,
          story,
          count: group.entries.length,
          transform: `translateZ(${-half}px) rotateY(${angle}deg) translateZ(${half}px)`,
          active: index === this.groupIndex(),
        },
      ];
    });
  });

  protected readonly faceTransition = computed(() => {
    const { animate, phase } = this.cube();
    return animate && phase === 'animating' && !this.reducedMotion
      ? `transform ${CUBE_TRANSITION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
      : 'none';
  });

  protected readonly neighbours = computed(() => {
    const groups = this.groups();
    const index = this.groupIndex();
    return { prev: groups[index - 1] ?? null, next: groups[index + 1] ?? null };
  });

  protected readonly formatDate = formatApodDate;

  private frameId: number | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly returnFocus: Element | null;
  private preloadLink: HTMLLinkElement | null = null;

  constructor() {
    this.returnFocus = this.document.activeElement;
    this.clock.setPaused('hidden', this.document.hidden);

    this.engine.subscribe((state) => {
      const previous = this.cube();
      this.cube.set(state);
      this.clock.setPaused('moving', state.phase !== 'idle');
      if (state.phase === 'animating' && state.position !== previous.position) {
        this.scheduleSettle();
      }
    });

    // Deep link / route change → jump straight to that story (no cube animation).
    effect(() => {
      const groups = this.groups();
      const target = findCursor(groups, this.groupId(), this.date());
      untracked(() => {
        if (groups.length === 0) return;
        if (!target) {
          void this.router.navigate(['/'], { replaceUrl: true });
          return;
        }
        const current = this.cursor();
        if (this.cube().count !== groups.length) this.engine.setCount(groups.length);
        if (target.group !== current.group || target.story !== current.story) this.jumpTo(target);
        this.ready.set(true);
      });
    });

    // Current story changed → restart its timer, sync the URL, preload what comes next.
    effect(() => {
      const group = this.currentGroup();
      const entry = this.current();
      if (!group || !entry || !this.ready()) return;
      untracked(() => {
        this.clock.restart();
        this.captionOpen.set(false);
        this.clock.setPaused('caption', false);
        this.clock.setPaused('video', false);
        this.syncUrl(group.id, entry.date);
        this.preloadNext();
      });
    });

    // The timer waits for the current picture; once it's on screen, the story counts as seen.
    effect(() => {
      const entry = this.current();
      if (!entry) return;
      const visible = coverImage(entry) === null || this.loaded().has(entry.date);
      this.clock.setPaused('loading', !visible);
      if (visible && this.ready())
        untracked(() => {
          this.seenStories.markSeen(entry.date);
        });
    });

    // Closing the player morphs back into the ring of the group it ends on.
    effect(() => {
      const group = this.currentGroup();
      if (group && this.ready()) this.transition.groupId.set(group.id);
    });

    // Measure the stage for the cube's depth.
    effect((onCleanup) => {
      const element = this.stage()?.nativeElement;
      if (!element || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) => {
        if (entry) this.width.set(entry.contentRect.width);
      });
      observer.observe(element);
      onCleanup(() => {
        observer.disconnect();
      });
    });

    // Move focus into the dialog once it's rendered.
    effect(() => {
      this.closeButton()?.nativeElement.focus({ preventScroll: true });
    });

    this.startFrames();
    this.destroyRef.onDestroy(() => {
      if (this.frameId !== null) cancelAnimationFrame(this.frameId);
      if (this.settleTimer !== null) clearTimeout(this.settleTimer);
      if (this.toastTimer !== null) clearTimeout(this.toastTimer);
      this.preloadLink?.remove();
      this.engine.destroy();
      if (this.returnFocus instanceof HTMLElement) this.returnFocus.focus({ preventScroll: true });
    });
  }

  // ─── Navigation ─────────────────────────────────────────────────────────

  next(userInitiated = false): void {
    const next = nextCursor(this.groups(), this.cursor());
    if (!next) {
      this.close();
      return;
    }
    this.goTo(next, userInitiated);
  }

  prev(userInitiated = false): void {
    const previous = prevCursor(this.groups(), this.cursor());
    if (!previous) {
      // Before the first story: restart it.
      this.clock.restart();
      return;
    }
    this.goTo(previous, userInitiated);
  }

  goToGroup(group: number): void {
    this.engine.goTo(group);
    this.announce();
  }

  close(): void {
    void this.router.navigate(['/']);
  }

  private goTo(cursor: StoryCursor, userInitiated: boolean): void {
    this.remember(cursor);
    if (cursor.group !== this.groupIndex()) this.engine.goTo(cursor.group);
    if (userInitiated) this.announce();
  }

  private jumpTo(cursor: StoryCursor): void {
    this.remember(cursor);
    const animated = !this.reducedMotion;
    this.engine.setOptions({ animated: false });
    this.engine.goTo(cursor.group);
    this.engine.setOptions({ animated });
  }

  private remember(cursor: StoryCursor): void {
    this.storyByGroup.update((map) => new Map(map).set(cursor.group, cursor.story));
  }

  private syncUrl(groupId: string, date: string): void {
    if (groupId === this.groupId() && date === this.date()) return;
    void this.router.navigate(['/stories', groupId, date], { replaceUrl: true });
  }

  private announce(): void {
    // Read after the move has been applied.
    queueMicrotask(() => {
      const group = this.currentGroup();
      const entry = this.current();
      if (!group || !entry) return;
      this.announcement.set(
        `${group.title}, story ${this.cursor().story + 1} of ${group.entries.length}: ${entry.title}`,
      );
    });
  }

  private preloadNext(): void {
    const next = nextCursor(this.groups(), this.cursor());
    const entry = next ? this.groups()[next.group]?.entries[next.story] : undefined;
    if (!entry) return;

    // Optimised versions: a typed preload, so browsers only fetch a format they support,
    // in the size the `<picture>` will pick.
    this.preloadLink?.remove();
    this.preloadLink = null;
    const [best] = coverSources(entry);
    if (best) {
      const link = this.document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.type = best.type;
      link.setAttribute('imagesrcset', best.srcset);
      link.setAttribute('imagesizes', '(min-width: 768px) 480px, 100vw');
      this.document.head.append(link);
      this.preloadLink = link;
      return;
    }

    const src = coverImage(entry);
    if (!src) return;
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    image.src = src;
    // `decode()` warms the decoded bitmap too; older engines only get the download.
    if (typeof image.decode === 'function') void image.decode().catch(() => undefined);
  }

  // ─── Cube rendering glue ────────────────────────────────────────────────

  protected onFaceTransitionEnd(event: TransitionEvent, active: boolean): void {
    if (active && event.target === event.currentTarget && event.propertyName === 'transform') {
      this.settle();
    }
  }

  private scheduleSettle(): void {
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settle();
    }, SETTLE_FALLBACK_MS);
  }

  private settle(): void {
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = null;
    this.engine.settle();
  }

  // ─── Timer ──────────────────────────────────────────────────────────────

  private startFrames(): void {
    const frame = (now: number): void => {
      if (this.clock.tick(now)) this.next();
      // Paint the bar straight into the DOM: a transform write, no change detection.
      const fill = this.stage()?.nativeElement.querySelector<HTMLElement>(
        '.face--active .segment--current .segment__fill',
      );
      fill?.style.setProperty('transform', `scaleX(${this.clock.progress})`);
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  togglePause(): void {
    const paused = !this.paused();
    this.paused.set(paused);
    this.clock.setPaused('user', paused);
  }

  isPausedBy(reason: StoryPauseReason): boolean {
    return this.clock.hasReason(reason);
  }

  // ─── Input ──────────────────────────────────────────────────────────────

  protected onReady(date: string): void {
    this.loaded.update((set) => new Set(set).add(date));
  }

  protected onVideoOpen(open: boolean): void {
    this.clock.setPaused('video', open);
  }

  protected toggleCaption(): void {
    const open = !this.captionOpen();
    this.captionOpen.set(open);
    this.clock.setPaused('caption', open);
  }

  protected onHold(holding: boolean): void {
    this.holding.set(holding);
    this.clock.setPaused('hold', holding);
  }

  protected onDragStart(): void {
    this.engine.dragStart();
  }

  protected onDragMove(offset: number): void {
    this.engine.dragMove(offset);
  }

  protected onDragEnd(direction: -1 | 0 | 1): void {
    this.engine.dragEnd(direction);
    if (direction !== 0) this.announce();
  }

  protected onDismissMove(offset: number): void {
    this.dismissOffset.set(offset);
    this.clock.setPaused('dismiss', offset > 0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const onButton = event.target instanceof HTMLElement && event.target.closest('button, a');
    switch (event.key) {
      case 'ArrowRight':
        this.next(true);
        break;
      case 'ArrowLeft':
        this.prev(true);
        break;
      case ' ':
        if (onButton) return;
        this.togglePause();
        break;
      case 'Escape':
        if (this.captionOpen()) this.toggleCaption();
        else this.close();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  protected onVisibilityChange(): void {
    this.clock.setPaused('hidden', this.document.hidden);
  }

  async share(): Promise<void> {
    const entry = this.current();
    if (!entry) return;
    // Built from the router state, so it includes the base href (e.g. a GitHub Pages sub-path).
    const url = new URL(
      this.location.prepareExternalUrl(this.router.url),
      this.document.location.origin,
    ).toString();
    const nav = this.document.defaultView?.navigator;

    this.clock.setPaused('user', true);
    try {
      if (nav && typeof nav.share === 'function') {
        await nav.share({ title: entry.title, text: `${entry.title}, via Cosmos Stories`, url });
      } else if (nav?.clipboard) {
        await nav.clipboard.writeText(url);
        this.showToast('Link copied');
      }
    } catch {
      // The user closed the share sheet: nothing to report.
    } finally {
      this.clock.setPaused('user', this.paused());
    }
  }

  private showToast(message: string): void {
    this.toast.set(message);
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.set(null);
    }, TOAST_MS);
  }
}
