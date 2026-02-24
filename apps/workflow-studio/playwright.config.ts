import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'smoke',
      testMatch: /.*\.spec\.ts/,
      grep: /@smoke/,
    },
    {
      name: 'regression',
      testMatch: /.*\.spec\.ts/,
      grep: /@regression/,
      grepInvert: /@requires-docker|@requires-claude|@requires-cursor/,
    },
    {
      name: 'docker',
      testMatch: /.*\.spec\.ts/,
      grep: /@requires-docker/,
      timeout: 120_000,
      retries: 2,
    },
    {
      name: 'full',
      testMatch: /.*\.spec\.ts/,
    },
  ],
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'test-results/html' }],
  ],
});
