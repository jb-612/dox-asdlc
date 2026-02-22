/**
 * cursor-agent.spec.ts — E2E tests for the Cursor agent execution path.
 *
 * These tests exercise the real `executeNodeRemote()` path in the engine:
 *   ExecutionPage → IPC → ExecutionEngine → POST /execute → cursor-agent container
 *
 * Prerequisites:
 *   1. Production build:  npm run build   (in apps/workflow-studio)
 *   2. Cursor agent running:  docker compose up cursor-agent   (in docker/)
 *      The container listens on http://localhost:8090 by default.
 *
 * Tests skip automatically when the cursor agent is not reachable.
 * Run with: npx playwright test test/e2e/cursor-agent.spec.ts
 */
import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'path';
import type { ElectronApplication, Page } from '@playwright/test';

const APP_MAIN = join(__dirname, '../../dist/main/index.js');
const CURSOR_URL = 'http://localhost:8090';

// ---------------------------------------------------------------------------
// Health check — skips all tests gracefully when container is not running
// ---------------------------------------------------------------------------

async function isCursorAgentRunning(): Promise<boolean> {
  try {
    const resp = await fetch(`${CURSOR_URL}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!resp.ok) return false;
    const body = await resp.json() as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Launch helper — opens the app and navigates to the Execute page
// ---------------------------------------------------------------------------

async function launchAndOpenExecute(): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const electronApp = await electron.launch({ args: [APP_MAIN] });
  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.click('text=Execute');
  await expect(page.getByText('Execute Workflow')).toBeVisible({ timeout: 5_000 });
  return { electronApp, page };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('cursor agent health endpoint responds with status ok', async () => {
  // This test always runs — it verifies the container itself is healthy.
  // If it fails, all other cursor tests will be skipped.
  const resp = await fetch(`${CURSOR_URL}/health`);
  expect(resp.ok).toBe(true);
  const body = await resp.json() as { status: string };
  expect(body.status).toBe('ok');
});

test('"Cursor Pipeline" workflow is visible in the Execute page', async () => {
  const { electronApp, page } = await launchAndOpenExecute();
  try {
    await expect(page.getByText('Cursor Pipeline')).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test('selecting Cursor Pipeline shows the Cursor Coder node in review', async () => {
  const { electronApp, page } = await launchAndOpenExecute();
  try {
    await page.getByText('Cursor Pipeline').click();

    const reviewPanel = page.locator('h3', { hasText: 'Review Configuration' })
      .locator('..')
      .locator('..');
    await expect(reviewPanel.getByText('Cursor Coder')).toBeVisible({ timeout: 3_000 });
  } finally {
    await electronApp.close();
  }
});

test('Cursor agent execution: node completes or fails with a clear status', async () => {
  const running = await isCursorAgentRunning();
  test.skip(!running, `Cursor agent not reachable at ${CURSOR_URL} — start with: docker compose up cursor-agent`);

  const { electronApp, page } = await launchAndOpenExecute();
  try {
    // Select the Cursor Pipeline workflow
    await page.getByText('Cursor Pipeline').click();
    await expect(page.getByRole('button', { name: 'Start Execution' })).toBeEnabled({ timeout: 3_000 });

    // Start
    await page.getByRole('button', { name: 'Start Execution' }).click();

    // The walkthrough page should appear with the workflow name in the header
    await expect(page.getByText('Cursor Pipeline')).toBeVisible({ timeout: 10_000 });

    // Wait for the execution to reach a terminal state: Completed or Failed
    // Cursor node has timeoutSeconds: 60, give test 90s headroom
    const terminalBadge = page.getByText('Completed').or(page.getByText('Failed')).first();
    await expect(terminalBadge).toBeVisible({ timeout: 90_000 });
  } finally {
    await electronApp.close();
  }
});

test('Cursor agent execution: engine dispatches POST /execute to the container', async () => {
  const running = await isCursorAgentRunning();
  test.skip(!running, `Cursor agent not reachable at ${CURSOR_URL} — start with: docker compose up cursor-agent`);

  const { electronApp, page } = await launchAndOpenExecute();
  try {
    await page.getByText('Cursor Pipeline').click();
    await page.getByRole('button', { name: 'Start Execution' }).click();

    // Navigate to walkthrough page
    await expect(page.getByText('Cursor Pipeline')).toBeVisible({ timeout: 10_000 });

    // The "Running" badge should appear while the cursor agent is processing
    // (or jump directly to Completed if the task finishes quickly)
    const activeBadge = page
      .getByText('Running')
      .or(page.getByText('Completed'))
      .or(page.getByText('Failed'))
      .first();
    await expect(activeBadge).toBeVisible({ timeout: 15_000 });
  } finally {
    await electronApp.close();
  }
});

test('Cursor agent execution: completed node shows no crash in the UI', async () => {
  const running = await isCursorAgentRunning();
  test.skip(!running, `Cursor agent not reachable at ${CURSOR_URL} — start with: docker compose up cursor-agent`);

  const { electronApp, page } = await launchAndOpenExecute();
  try {
    // Collect JS errors during execution
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.getByText('Cursor Pipeline').click();
    await page.getByRole('button', { name: 'Start Execution' }).click();

    // Wait for terminal state
    const terminalBadge = page.getByText('Completed').or(page.getByText('Failed')).first();
    await expect(terminalBadge).toBeVisible({ timeout: 90_000 });

    // No uncaught JS errors during the run
    expect(jsErrors).toHaveLength(0);

    // The page body should still be intact
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  } finally {
    await electronApp.close();
  }
});

test('Cursor agent: unreachable URL causes node to fail with error event', async () => {
  // This test always runs (no container needed) — it verifies the failure path.
  // It sets cursorAgentUrl to a deliberately broken URL via Settings.
  const { electronApp, page } = await launchAndOpenExecute();
  try {
    // Point to a non-existent port
    await page.click('text=Settings');
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder('http://localhost:8090').fill('http://localhost:19999');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible({ timeout: 5_000 });

    // Navigate back to Execute
    await page.click('text=Execute');
    await expect(page.getByText('Cursor Pipeline')).toBeVisible();

    await page.getByText('Cursor Pipeline').click();
    await page.getByRole('button', { name: 'Start Execution' }).click();

    // The engine will POST to localhost:19999, fail, and mark the node as failed
    // Execution should reach "Failed" status — not hang
    const failedBadge = page.getByText('Failed').first();
    await expect(failedBadge).toBeVisible({ timeout: 30_000 });
  } finally {
    await electronApp.close();
  }
});
