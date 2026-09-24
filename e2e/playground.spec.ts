import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { useFixtureData } from './helpers';

test.beforeEach(async ({ page }) => {
  await useFixtureData(page);
});

test('opens from the home page and reflects options live', async ({ page, isMobile }) => {
  if (isMobile) {
    await page.goto('./playground');
  } else {
    await page.goto('./');
    await page.getByRole('link', { name: 'Playground', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Carousel playground' })).toBeVisible();

  await page.getByLabel('vertical').check();
  await expect(page.getByTestId('generated-code')).toContainText('orientation="vertical"');

  await page.getByRole('button', { name: 'Next ›' }).click();
  await expect(page.getByTestId('state-index')).toHaveText('1 / 5');
  await expect(page.locator('.log')).toContainText('Venus');
});

test.describe('accessibility', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the playground has no detectable accessibility violations', async ({ page }) => {
    await page.goto('./playground');
    await expect(page.getByRole('heading', { name: 'Carousel playground' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
