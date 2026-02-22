/**
 * app.spec.ts — Smoke tests for app launch and navigation.
 *
 * Requires a production build: `npm run build` before running.
 * The app entry point is dist/main/index.js.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'path';
import type { ElectronApplication, Page } from '@playwright/test';

const APP_MAIN = join(__dirname, '../../dist/main/index.js');

let electronApp: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  electronApp = await electron.launch({ args: [APP_MAIN] });
  page = await electronApp.firstWindow();
  // Wait for the app to be ready
  await page.waitForLoadState('domcontentloaded');
});

test.afterEach(async () => {
  await electronApp.close();
});

test('app launches and window appears within 5 seconds', async () => {
  await expect(page).toBeTruthy();
  // Sidebar heading confirms the app rendered
  await expect(page.getByText('Workflow Studio')).toBeVisible({ timeout: 5_000 });
});

test('window title is "aSDLC Workflow Studio"', async () => {
  const title = await electronApp.evaluate(({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows()[0]?.getTitle();
  });
  expect(title).toBe('aSDLC Workflow Studio');
});

test('Designer route "/" renders without console errors', async () => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.click('text=Designer');
  await expect(page.locator('main')).toBeVisible();
  expect(errors).toHaveLength(0);
});

test('Templates route "/templates" renders', async () => {
  await page.click('text=Templates');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Templates' })).toBeVisible();
});

test('Execute route "/execute" renders', async () => {
  await page.click('text=Execute');
  await expect(page.getByText('Execute Workflow')).toBeVisible();
});

test('CLI Sessions route "/cli" renders', async () => {
  await page.click('text=CLI Sessions');
  await expect(page.locator('main')).toBeVisible();
});

test('Settings route "/settings" renders', async () => {
  await page.click('text=Settings');
  await expect(page.getByText('Settings', { exact: true }).first()).toBeVisible();
});

test('all nav links are present in sidebar', async () => {
  await expect(page.getByRole('link', { name: 'Designer' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Templates' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Execute' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'CLI Sessions' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
});
