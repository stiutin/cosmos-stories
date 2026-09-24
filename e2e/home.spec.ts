import {expect, test} from '@playwright/test';

import {useFixtureData} from './helpers';

test.beforeEach(async ({page}) => {
  await useFixtureData(page);
  await page.goto('./');
});

test('shows story rings and the "Today in space" banner', async ({page}) => {
  const rings = page.getByRole('navigation', {name: 'Story groups'}).getByRole('link');
  await expect(rings).toHaveCount(5);
  await expect(rings.first()).toContainText('Latest');

  const banner = page.getByRole('region', {name: 'Today in space'});
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('group', {name: 'Choose slide'}).getByRole('button')).toHaveCount(7);
});

test('the banner can be navigated with the keyboard', async ({page}) => {
  const banner = page.getByRole('region', {name: 'Today in space'});
  await banner.focus();
  await page.keyboard.press('ArrowRight');
  await expect(banner.locator('.ui-carousel__slide--active')).toHaveAttribute('aria-label', '2 of 7');
  await page.keyboard.press('End');
  await expect(banner.locator('.ui-carousel__slide--active')).toHaveAttribute('aria-label', '7 of 7');
});

test('a banner slide opens its story', async ({page}) => {
  const banner = page.getByRole('region', {name: 'Today in space'});
  await banner.focus();
  await page.keyboard.press('ArrowRight');
  await banner.locator('.ui-carousel__slide--active').getByRole('link', {name: 'Open the story'}).click();
  await expect(page).toHaveURL(/\/stories\/latest\/2026-09-22$/);
});
