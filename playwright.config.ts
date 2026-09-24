import { defineConfig, devices } from '@playwright/test';

const PORT = 4400;
/** Lets a sandbox without Playwright's own browser download point at a local Chromium. */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE?.trim()
  ? process.env.PW_CHROMIUM_EXECUTABLE
  : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Gesture timing (tap vs hold) needs a responsive browser: don't oversubscribe the CPU.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Lazy chunks plus a view transition can take a few seconds on a busy CI runner.
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}/cosmos-stories/`,
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop',
      // Lazy chunks plus a view transition can take a few seconds on a busy CI runner.
      expect: { timeout: 10_000 },
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // Expects a production build with --base-href /cosmos-stories/ (see `npm run e2e`).
    command: 'node e2e/serve.ts',
    url: `http://localhost:${PORT}/cosmos-stories/`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
});
