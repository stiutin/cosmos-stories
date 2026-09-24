import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

import {expectStory, useFixtureData} from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

test.use({reducedMotion: 'reduce'});

test.beforeEach(async ({page}) => {
  await useFixtureData(page);
});

test('the home page has no detectable accessibility violations', async ({page}) => {
  await page.goto('./');
  await expect(page.getByRole('region', {name: 'Today in space'})).toBeVisible();
  const results = await new AxeBuilder({page}).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});

test('the stories player has no detectable accessibility violations', async ({page}) => {
  await page.goto('./stories/latest/2026-09-22');
  await expectStory(page, 'Latest', 'Mars at Dawn');
  const results = await new AxeBuilder({page}).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});
