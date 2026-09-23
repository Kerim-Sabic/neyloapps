import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-reduced-motion', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' } },
  ],
  webServer: {
    command: 'npm run dev', url: 'http://127.0.0.1:3100/pay',
    reuseExistingServer: !process.env.CI, timeout: 120_000,
    env: { APP_STAGE: 'development', APP_ORIGIN: 'http://127.0.0.1:3100' },
  },
});
