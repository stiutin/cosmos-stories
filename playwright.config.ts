import {defineConfig, devices} from '@playwright/test';

const PORT = 4400;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', {open: 'never'}]] : 'list',
  expect: {timeout: 10_000},
  use: {
    baseURL: `http://localhost:${PORT}/cosmos-stories/`,
    trace: 'retain-on-failure',
    launchOptions: {executablePath: process.env.CHROMIUM_PATH ?? undefined},
  },
  projects: [
    {name: 'mobile', use: {...devices['Pixel 7']}},
    {
      name: 'desktop',
      expect: {timeout: 10_000},
      use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 900}},
    },
  ],
  webServer: {
    command: 'node e2e/serve.ts',
    url: `http://localhost:${PORT}/cosmos-stories/`,
    reuseExistingServer: !process.env.CI,
    env: {PORT: String(PORT)},
  },
});
