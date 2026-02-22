/**
 * execution-real.spec.ts — UAT for real (non-mock) execution mode.
 *
 * These tests disable mock mode via the Settings page before starting execution.
 * They require:
 *   1. A production build: `npm run build`
 *   2. The `claude` CLI available on PATH (real mode spawns live processes)
 *
 * Skip these in CI unless the environment has `claude` installed.
 * Run locally with: npx playwright test test/e2e/execution-real.spec.ts
 */
import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'path';
import type { ElectronApplication, Page } from '@playwright/test';

const APP_MAIN = join(__dirname, '../../dist/main/index.js');

// ---------------------------------------------------------------------------
// Helper: launch app, turn off mock mode via Settings, navigate to Execute
// ---------------------------------------------------------------------------

async function launchWithRealMode(): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const electronApp = await electron.launch({ args: [APP_MAIN] });
  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // 1. Go to Settings and turn off mock mode
  await page.click('text=Settings');
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 10_000 });

  const mockCheckbox = page.locator('input[type="checkbox"]').first();
  const isMockOn = await mockCheckbox.isChecked();
  if (isMockOn) {
    await mockCheckbox.click();
    await expect(mockCheckbox).toBeChecked({ checked: false });
  }
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible({ timeout: 5_000 });

  // 2. Navigate to Execute
  await page.click('text=Execute');
  await expect(page.getByText('Execute Workflow')).toBeVisible({ timeout: 5_000 });

  return { electronApp, page };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('settings show "Real mode (live CLI)" after unchecking mock', async () => {
  const { electronApp, page } = await launchWithRealMode();
  try {
    // Go back to settings and verify the label reflects real mode
    await page.click('text=Settings');
    await expect(page.getByText('Real mode (live CLI)')).toBeVisible({ timeout: 5_000 });
  } finally {
    await electronApp.close();
  }
});

test('Start Execution in real mode navigates to /execute/run', async () => {
  const { electronApp, page } = await launchWithRealMode();
  try {
    await page.getByText('TDD Pipeline').click();
    await expect(page.getByRole('button', { name: 'Start Execution' })).toBeEnabled();
    await page.getByRole('button', { name: 'Start Execution' }).click();

    // The walkthrough page must appear — real mode may take longer to boot
    await expect(
      page.getByText('Execution Walkthrough').or(page.getByText('Running')).first()
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await electronApp.close();
  }
});

test('real mode execution page renders without crashing', async () => {
  const { electronApp, page } = await launchWithRealMode();
  try {
    await page.getByText('TDD Pipeline').click();
    await page.getByRole('button', { name: 'Start Execution' }).click();

    // Give the real CLI 20 seconds to produce some output or at least not crash
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });

    // No JS error dialogs or blank white screens
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  } finally {
    await electronApp.close();
  }
});
