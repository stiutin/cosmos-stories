import {Injectable, signal} from '@angular/core';
import type {ActivatedRouteSnapshot, ViewTransitionInfo} from '@angular/router';

export const STORY_COVER_TRANSITION = 'story-cover';
export const STORIES_ROUTE_PATH = 'stories/:groupId/:date';

@Injectable({providedIn: 'root'})
export class StoryTransitionService {
  public readonly groupId = signal<string | null>(null);
}

export function isStoriesRoute(snapshot: ActivatedRouteSnapshot | null): boolean {
  for (let route = snapshot; route; route = route.firstChild) {
    if (route.routeConfig?.path === STORIES_ROUTE_PATH) return true;
  }
  return false;
}

export function onStoryViewTransition(
  {transition, from, to}: ViewTransitionInfo,
  reducedMotion = prefersReducedMotion()
): void {
  const initialNavigation = from.firstChild === null;

  if (reducedMotion || initialNavigation || (isStoriesRoute(from) && isStoriesRoute(to))) {
    transition.skipTransition();
  }
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
