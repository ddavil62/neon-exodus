import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: 'http://localhost:5555',
    headless: true,
    viewport: { width: 360, height: 640 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx http-server -p 5555 -c-1 --silent',
    port: 5555,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
