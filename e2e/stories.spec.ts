import { expect, test } from '@playwright/test';
import {
  activeTitle,
  expectStory,
  player,
  pointerDown,
  pointerUp,
  swipe,
  useFixtureData,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await useFixtureData(page);
});

test.describe('on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch gestures');

  test('opens from a ring and steps with tap zones', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('link', { name: /^Latest/ }).click();
    await expect(page).toHaveURL(/\/stories\/latest\/2026-09-22$/);
    await expectStory(page, 'Latest', 'Mars at Dawn');

    const box = await player(page).boundingBox();
    if (!box) throw new Error('player not visible');
    await page.touchscreen.tap(box.width * 0.85, box.height / 2);
    await expect(activeTitle(page)).toHaveText('A Spiral Galaxy');
    await expect(page).toHaveURL(/\/stories\/latest\/2026-09-21$/);

    await page.touchscreen.tap(box.width * 0.1, box.height / 2);
    await expect(activeTitle(page)).toHaveText('Mars at Dawn');
  });

  test('swipes to the next group on the cube and closes with a swipe down', async ({ page }) => {
    await page.goto('./stories/latest/2026-09-22');
    await expectStory(page, 'Latest', 'Mars at Dawn');

    await swipe(page, { x: 330, y: 400 }, { x: 60, y: 405 });
    await expectStory(page, 'Solar System', 'Mars at Dawn');
    await expect(page).toHaveURL(/\/stories\/solar-system\//);

    await swipe(page, { x: 200, y: 250 }, { x: 205, y: 650 });
    await expect(player(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/cosmos-stories\/$/);
  });

  test('holding a story pauses it and hides the interface', async ({ page }) => {
    await page.goto('./stories/latest/2026-09-22');
    await expectStory(page, 'Latest', 'Mars at Dawn');

    await pointerDown(page, { x: 200, y: 400 });
    await expect(page.locator('.player--holding')).toHaveCount(1);
    await page.waitForTimeout(8_000); // longer than one story
    await expect(activeTitle(page)).toHaveText('Mars at Dawn');
    await pointerUp(page, { x: 200, y: 400 });
    await expect(page.locator('.player--holding')).toHaveCount(0);
  });
});

test.describe('on desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard and mouse');

  test('keyboard shortcuts step, pause and close', async ({ page }) => {
    await page.goto('./stories/galaxies/2026-09-21');
    await expectStory(page, 'Galaxies', 'A Spiral Galaxy');

    await page.keyboard.press('ArrowRight');
    await expect(activeTitle(page)).toHaveText('A Galaxy Cluster');
    await page.keyboard.press('ArrowRight'); // end of the group: the cube turns
    await expectStory(page, 'Nebulae', 'The Veil Nebula');

    await page.keyboard.press('Escape');
    await expect(player(page)).toHaveCount(0);
  });

  test('neighbouring groups can be opened from the side', async ({ page }) => {
    await page.goto('./stories/latest/2026-09-22');
    await page.getByRole('button', { name: 'Next group: Solar System' }).click();
    await expectStory(page, 'Solar System', 'Mars at Dawn');
  });

  test('deep links survive a reload', async ({ page }) => {
    await page.goto('./stories/nebulae/2026-09-20');
    await expectStory(page, 'Nebulae', 'The Veil Nebula');
    await page.reload();
    await expectStory(page, 'Nebulae', 'The Veil Nebula');
  });

  test('seen groups turn grey and move to the end of the rings', async ({ page }) => {
    await page.goto('./stories/earth-sky/2026-09-19');
    await expectStory(page, 'Earth & Sky', 'Aurora Over the Fjord');
    await page.keyboard.press('Escape');

    const rings = page.getByRole('navigation', { name: 'Story groups' }).getByRole('link');
    await expect(rings.last()).toContainText('Earth & Sky');
    await expect(rings.last()).toHaveClass(/ring--seen/);
  });

  test('share copies the link when the Web Share API is missing', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await page.goto('./stories/latest/2026-09-22');
    await page.getByRole('button', { name: 'Share this story' }).click();

    await expect(page.getByText('Link copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      /\/cosmos-stories\/stories\/latest\/2026-09-22$/,
    );
  });
});
