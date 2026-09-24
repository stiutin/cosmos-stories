import { Injectable, signal } from '@angular/core';
import type { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';

/**
 * Name shared by the ring that opens a group and the active story in the player.
 * The browser morphs one into the other (View Transitions API). At any moment only
 * one element in the document may carry the name, so rings only use it while the
 * player is closed, and the player only on its active face.
 */
export const STORY_COVER_TRANSITION = 'story-cover';

export const STORIES_ROUTE_PATH = 'stories/:groupId/:date';

/** Which group the cover transition belongs to: the ring that opened the player, or the group it closed on. */
@Injectable({ providedIn: 'root' })
export class StoryTransitionService {
  readonly groupId = signal<string | null>(null);
}

export function isStoriesRoute(snapshot: ActivatedRouteSnapshot | null): boolean {
  for (let route = snapshot; route; route = route.firstChild) {
    if (route.routeConfig?.path === STORIES_ROUTE_PATH) return true;
  }
  return false;
}

/**
 * Router hook: animate opening and closing the player, but not
 * - the initial navigation: there is nothing on screen to morph from, and while a view
 *   transition runs its pseudo-elements cover the page, so taps and swipes on a freshly
 *   opened story link would land on the document instead of the player;
 * - story-to-story URL updates inside the player (the cube and progress bars animate those);
 * - anything, for people who prefer reduced motion.
 */
export function onStoryViewTransition(
  { transition, from, to }: ViewTransitionInfo,
  reducedMotion = prefersReducedMotion(),
): void {
  const initialNavigation = from.firstChild === null;
  if (reducedMotion || initialNavigation || (isStoriesRoute(from) && isStoriesRoute(to))) {
    transition.skipTransition();
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
