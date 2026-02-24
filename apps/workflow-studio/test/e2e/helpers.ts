/**
 * helpers.ts — Shared E2E test utilities for Playwright Electron tests.
 *
 * Provides app launch helpers, navigation utilities, and test fixture creators.
 */
import { _electron as electron, expect } from '@playwright/test';
import { join } from 'path';
import type { ElectronApplication, Page } from '@playwright/test';

export const APP_MAIN = join(__dirname, '../../dist/main/index.js');

/** Launch app and navigate to a specific route via sidebar link text. */
export async function launchAndNavigate(
  linkText: string,
): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const electronApp = await electron.launch({ args: [APP_MAIN] });
  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.click(`text=${linkText}`);
  return { electronApp, page };
}

/** Launch app and navigate to the Studio page. */
export async function launchStudio(): Promise<{
  electronApp: ElectronApplication;
  page: Page;
}> {
  return launchAndNavigate('Studio');
}

/** Launch app and navigate to the Templates page. */
export async function launchTemplates(): Promise<{
  electronApp: ElectronApplication;
  page: Page;
}> {
  return launchAndNavigate('Templates');
}

/** Launch app and navigate to the Execute page. */
export async function launchExecute(): Promise<{
  electronApp: ElectronApplication;
  page: Page;
}> {
  const result = await launchAndNavigate('Execute');
  const { page } = result;
  await expect(
    page
      .getByText('Execute Workflow')
      .or(page.getByText('Select Template'))
      .first(),
  ).toBeVisible({ timeout: 5_000 });
  return result;
}

/** Launch app and navigate to the CLI Sessions page. */
export async function launchCLI(): Promise<{
  electronApp: ElectronApplication;
  page: Page;
}> {
  return launchAndNavigate('CLI Sessions');
}

/** Launch app and navigate to the Monitoring page. */
export async function launchMonitoring(): Promise<{
  electronApp: ElectronApplication;
  page: Page;
}> {
  return launchAndNavigate('Monitoring');
}

/** Launch app and navigate to the Settings page. */
export async function launchSettings(): Promise<{
  electronApp: ElectronApplication;
  page: Page;
}> {
  const result = await launchAndNavigate('Settings');
  const { page } = result;
  await expect(
    page
      .getByRole('tab')
      .or(page.getByRole('button', { name: 'Save' }))
      .first(),
  ).toBeVisible({ timeout: 10_000 });
  return result;
}

/**
 * Create a test template via the renderer's electronAPI.
 * Returns the template ID.
 */
export async function createTestTemplate(
  page: Page,
  opts: {
    name: string;
    tags?: string[];
    status?: 'active' | 'paused';
    nodeCount?: number;
  },
): Promise<string> {
  const { name, tags = [], status = 'active', nodeCount = 1 } = opts;

  const id = await page.evaluate(
    async ({ name, tags, status, nodeCount }) => {
      const crypto = await import('crypto');
      const id = crypto.randomUUID ? crypto.randomUUID() : `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const nodes = Array.from({ length: nodeCount }, (_, i) => ({
        id: `node-${i}`,
        type: 'planner' as const,
        label: `Node ${i}`,
        config: {},
        inputs: [],
        outputs: [],
        position: { x: i * 200, y: 100 },
      }));

      await window.electronAPI.template.save({
        id,
        metadata: {
          name,
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [...tags],
          status,
        },
        nodes,
        transitions: [],
        gates: [],
        variables: [],
      } as any);

      return id;
    },
    { name, tags, status, nodeCount },
  );

  return id;
}

/** Check if Docker is available on the host. */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    const { execSync } = require('child_process');
    execSync('docker info', { timeout: 5000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
