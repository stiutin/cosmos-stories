import { expect, test } from '@playwright/test';
import { expectStory, useFixtureData } from './helpers';

test.skip(({ isMobile }) => isMobile, 'one browser is enough for the service worker');
// The service worker must see real requests, so routing is limited to the data file.
test.use({ serviceWorkers: 'allow' });

test('works offline once visited (service worker)', async ({ page, context }) => {
  await useFixtureData(page);
  await page.goto('./');
  await expect(page.getByRole('region', { name: 'Today in space' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Let the worker finish caching the app shell.
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    return keys.some((key) => key.includes('ngsw'));
  });
  await page.reload();

  await context.setOffline(true);
  await page.goto('./stories/latest/2026-09-22');
  await expectStory(page, 'Latest', 'Mars at Dawn');
});
