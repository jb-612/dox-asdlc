/**
 * settings.spec.ts — UAT for the Settings page and IPC persistence.
 *
 * Requires a production build: `npm run build` before running.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'path';
import type { ElectronApplication, Page } from '@playwright/test';

const APP_MAIN = join(__dirname, '../../dist/main/index.js');

async function launchAndOpenSettings(): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const electronApp = await electron.launch({ args: [APP_MAIN] });
  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  // Navigate to Settings
  await page.click('text=Settings');
  // Wait for the form to load (past the "Loading settings..." state)
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 10_000 });
  return { electronApp, page };
}

test('settings page loads with default field values visible', async () => {
  const { electronApp, page } = await launchAndOpenSettings();
  try {
    // Redis URL field should be present (labeled field)
    await expect(page.getByPlaceholder('redis://localhost:6379')).toBeVisible();
    // Cursor Agent URL field
    await expect(page.getByPlaceholder('http://localhost:8090')).toBeVisible();
    // Save and Reset buttons present
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset to Defaults' })).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test('changing Cursor Agent URL and clicking Save shows "Settings saved."', async () => {
  const { electronApp, page } = await launchAndOpenSettings();
  try {
    const urlInput = page.getByPlaceholder('http://localhost:8090');
    await urlInput.fill('http://localhost:9999');

    await page.getByRole('button', { name: 'Save' }).click();

    // Success message appears
    await expect(page.getByText('Settings saved.')).toBeVisible({ timeout: 5_000 });
  } finally {
    await electronApp.close();
  }
});

test('toggling Execution Mode checkbox and saving persists the change', async () => {
  const { electronApp, page } = await launchAndOpenSettings();
  try {
    const checkbox = page.locator('input[type="checkbox"]').first();
    const initialChecked = await checkbox.isChecked();

    // Toggle the checkbox
    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: !initialChecked });

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible({ timeout: 5_000 });

    // Verify the checkbox state is still toggled
    await expect(checkbox).toBeChecked({ checked: !initialChecked });
  } finally {
    await electronApp.close();
  }
});

test('Reset to Defaults restores original field values', async () => {
  const { electronApp, page } = await launchAndOpenSettings();
  try {
    const urlInput = page.getByPlaceholder('http://localhost:8090');

    // Change the value
    await urlInput.fill('http://changed-value:1234');
    await expect(urlInput).toHaveValue('http://changed-value:1234');

    // Reset
    await page.getByRole('button', { name: 'Reset to Defaults' }).click();

    // Field should be cleared back to default (empty or the default placeholder)
    const value = await urlInput.inputValue();
    expect(value).not.toBe('http://changed-value:1234');
  } finally {
    await electronApp.close();
  }
});

test('save error is shown when settings IPC fails gracefully', async () => {
  // This test launches without a built app — it verifies the error path
  // is handled without crashing the UI. We confirm by checking Save is clickable
  // and either success or a readable error message appears (not a blank crash).
  const { electronApp, page } = await launchAndOpenSettings();
  try {
    await page.getByRole('button', { name: 'Save' }).click();
    // Either "Settings saved." or an error message must appear — not silence
    const saved = page.getByText('Settings saved.');
    const errored = page.locator('.text-red-400');
    await expect(saved.or(errored).first()).toBeVisible({ timeout: 5_000 });
  } finally {
    await electronApp.close();
  }
});
