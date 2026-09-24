import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Deterministic data: every test sees the same six stories, whatever the build contains. */
const FIXTURE = readFileSync(join(import.meta.dirname, 'fixtures', 'apod.json'), 'utf8');

export async function useFixtureData(page: Page): Promise<void> {
  await page.route('**/data/apod.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE }),
  );
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Sends a touch `PointerEvent` to whatever element is under `point` (for `pointerdown`)
 * or to the element that received the `pointerdown` (for later events, as with
 * implicit pointer capture).
 *
 * Why not raw CDP touch events: how Chrome turns a *held* or *moving* synthetic touch
 * into pointer events (long-press and fling heuristics, touch-action interventions)
 * differs between Chrome versions and operating systems. That made the hold and swipe
 * tests fail on Windows while passing on Linux. Pointer events are exactly what the
 * app's gesture code consumes, so these tests are deterministic everywhere. The
 * browser's own touch → pointer path is still covered by the tap-zone test, which
 * uses Playwright's `touchscreen.tap()`.
 */
async function pointer(page: Page, type: string, point: Point): Promise<void> {
  await page.evaluate(
    ({ type, x, y }) => {
      const store = globalThis as { __gestureTarget?: Element | null };
      if (type === 'pointerdown') store.__gestureTarget = document.elementFromPoint(x, y);
      const target = store.__gestureTarget;
      if (!target) throw new Error(`No element at ${x},${y}`);
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          button: type === 'pointermove' ? -1 : 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: x,
          clientY: y,
        }),
      );
    },
    { type, ...point },
  );
}

export async function pointerDown(page: Page, point: Point): Promise<void> {
  await pointer(page, 'pointerdown', point);
}

export async function pointerUp(page: Page, point: Point): Promise<void> {
  await pointer(page, 'pointerup', point);
}

/** A finger swipe from `from` to `to`, ~60 fps, as touch pointer events. */
export async function swipe(page: Page, from: Point, to: Point, steps = 8): Promise<void> {
  await pointerDown(page, from);
  for (let step = 1; step <= steps; step++) {
    await page.waitForTimeout(16);
    await pointer(page, 'pointermove', {
      x: from.x + ((to.x - from.x) * step) / steps,
      y: from.y + ((to.y - from.y) * step) / steps,
    });
  }
  await pointerUp(page, to);
}

export const activeTitle = (page: Page) => page.locator('.face--active .face__title');
export const player = (page: Page) => page.getByRole('dialog');

export async function expectStory(page: Page, group: string, title: string): Promise<void> {
  await expect(player(page)).toHaveAttribute('aria-label', `Stories: ${group}`);
  await expect(activeTitle(page)).toHaveText(title);
  // Ready means: the picture is on screen, the cube has stopped turning, and no view
  // transition is running (its pseudo-elements cover the page and swallow input).
  await expect(page.locator('.face--active .media__image')).toHaveJSProperty('complete', true);
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => {
      if (animation.playState !== 'running') return true;
      const effect = animation.effect;
      const target = effect instanceof KeyframeEffect ? effect.target : null;
      const onFace = target instanceof Element && target.classList.contains('face');
      const viewTransition =
        effect instanceof KeyframeEffect &&
        (effect.pseudoElement ?? '').includes('view-transition');
      return !onFace && !viewTransition;
    }),
  );
}
