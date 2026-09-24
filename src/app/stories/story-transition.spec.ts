import type {ActivatedRouteSnapshot, ViewTransitionInfo} from '@angular/router';

import {isStoriesRoute, onStoryViewTransition, STORIES_ROUTE_PATH} from './story-transition';

function route(path: string, child: ActivatedRouteSnapshot | null = null): ActivatedRouteSnapshot {
  return {routeConfig: {path}, firstChild: child} as unknown as ActivatedRouteSnapshot;
}

const initial = route('', null);
const home = route('', route(''));
const player = route('', route('', route(STORIES_ROUTE_PATH)));

function transitionFor(from: ActivatedRouteSnapshot, to: ActivatedRouteSnapshot, reduced = false) {
  const skipTransition = vi.fn();
  const info = {transition: {skipTransition}, from, to} as unknown as ViewTransitionInfo;
  onStoryViewTransition(info, reduced);
  return skipTransition;
}

describe('story view transitions', () => {
  it('finds the stories route anywhere in the snapshot', () => {
    expect(isStoriesRoute(player)).toBe(true);
    expect(isStoriesRoute(home)).toBe(false);
    expect(isStoriesRoute(null)).toBe(false);
  });

  it('animates opening and closing the player', () => {
    expect(transitionFor(home, player)).not.toHaveBeenCalled();
    expect(transitionFor(player, home)).not.toHaveBeenCalled();
  });

  it('skips story-to-story navigation inside the player', () => {
    expect(transitionFor(player, player)).toHaveBeenCalledOnce();
  });

  it('skips the initial navigation (a story link opened directly)', () => {
    expect(transitionFor(initial, player)).toHaveBeenCalledOnce();
    expect(transitionFor(initial, home)).toHaveBeenCalledOnce();
  });

  it('skips everything with reduced motion', () => {
    expect(transitionFor(home, player, true)).toHaveBeenCalledOnce();
  });
});
