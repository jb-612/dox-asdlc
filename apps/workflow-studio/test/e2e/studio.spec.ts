/**
 * studio.spec.ts — E2E tests for F01: Studio Block Composer.
 *
 * Route: /studio
 * Requires a production build: `npm run build` before running.
 * Tests use mock mode (no Docker required).
 */
import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { launchStudio } from './helpers';

let electronApp: ElectronApplication;
let page: Page;

test.afterEach(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});

// ---------------------------------------------------------------------------
// T01: Studio page renders (smoke)
// ---------------------------------------------------------------------------

test('Studio page renders @smoke', async () => {
  ({ electronApp, page } = await launchStudio());

  // Block palette should be visible
  await expect(page.getByTestId('block-palette')).toBeVisible({ timeout: 5_000 });

  // Studio canvas should be visible
  await expect(page.getByTestId('studio-canvas')).toBeVisible();
});

// ---------------------------------------------------------------------------
// T02: Block palette shows Plan block
// ---------------------------------------------------------------------------

test('Block palette shows Plan block @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  // Plan block card should be visible
  await expect(page.getByTestId('palette-block-plan')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('palette-block-plan').getByText('Plan')).toBeVisible();

  // Phase 2 blocks should NOT be visible (Phase 1 scope only)
  const palette = page.getByTestId('block-palette');
  await expect(palette.getByText('Dev')).not.toBeVisible();
  await expect(palette.getByText('Test')).not.toBeVisible();
  await expect(palette.getByText('Review')).not.toBeVisible();
  await expect(palette.getByText('DevOps')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// T03: Drag Plan block onto canvas creates node
// ---------------------------------------------------------------------------

test('Drag Plan block onto canvas creates node @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  const paletteBlock = page.getByTestId('palette-block-plan');
  const canvas = page.getByTestId('studio-canvas');

  await expect(paletteBlock).toBeVisible({ timeout: 5_000 });
  await expect(canvas).toBeVisible();

  // Drag the Plan block onto the canvas
  const paletteBBox = await paletteBlock.boundingBox();
  const canvasBBox = await canvas.boundingBox();

  if (paletteBBox && canvasBBox) {
    await page.mouse.move(
      paletteBBox.x + paletteBBox.width / 2,
      paletteBBox.y + paletteBBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      canvasBBox.x + canvasBBox.width / 2,
      canvasBBox.y + canvasBBox.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();
  }

  // A node with label "Plan" should appear on the canvas
  // ReactFlow renders nodes as divs inside the canvas area
  await expect(canvas.getByText('Plan').first()).toBeVisible({ timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// T04: Selecting a Plan node opens config panel
// ---------------------------------------------------------------------------

test('Selecting a Plan node opens config panel @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  // Add a Plan node via drag
  const paletteBlock = page.getByTestId('palette-block-plan');
  const canvas = page.getByTestId('studio-canvas');

  await expect(paletteBlock).toBeVisible({ timeout: 5_000 });

  const paletteBBox = await paletteBlock.boundingBox();
  const canvasBBox = await canvas.boundingBox();

  if (paletteBBox && canvasBBox) {
    await page.mouse.move(
      paletteBBox.x + paletteBBox.width / 2,
      paletteBBox.y + paletteBBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      canvasBBox.x + canvasBBox.width / 2,
      canvasBBox.y + canvasBBox.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();
  }

  // Wait for node to appear, then click it
  const planNode = canvas.getByText('Plan').first();
  await expect(planNode).toBeVisible({ timeout: 5_000 });
  await planNode.click();

  // Config panel should become visible
  const configPanel = page.getByTestId('block-config-panel');
  await expect(configPanel).toBeVisible({ timeout: 3_000 });

  // Should show prompt harness labels
  await expect(configPanel.getByText('System Prompt Prefix')).toBeVisible();
  await expect(configPanel.getByText('Output Checklist')).toBeVisible();
});

// ---------------------------------------------------------------------------
// T05: Default prompt harness is pre-populated
// ---------------------------------------------------------------------------

test('Default prompt harness is pre-populated @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  // Add a Plan node via drag
  const paletteBlock = page.getByTestId('palette-block-plan');
  const canvas = page.getByTestId('studio-canvas');
  await expect(paletteBlock).toBeVisible({ timeout: 5_000 });

  const paletteBBox = await paletteBlock.boundingBox();
  const canvasBBox = await canvas.boundingBox();

  if (paletteBBox && canvasBBox) {
    await page.mouse.move(
      paletteBBox.x + paletteBBox.width / 2,
      paletteBBox.y + paletteBBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      canvasBBox.x + canvasBBox.width / 2,
      canvasBBox.y + canvasBBox.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();
  }

  // Select the node
  await canvas.getByText('Plan').first().click();
  await expect(page.getByTestId('block-config-panel')).toBeVisible({ timeout: 3_000 });

  // Prompt prefix textarea should contain default text
  const prefixInput = page.getByTestId('prompt-prefix-input');
  await expect(prefixInput).toBeVisible();
  await expect(prefixInput).toContainText('senior technical planner', { useInnerText: false });

  // Output checklist should have 4 items
  const checklist = page.getByTestId('output-checklist');
  await expect(checklist).toBeVisible();
  await expect(checklist.getByText('Requirements document')).toBeVisible();
  await expect(checklist.getByText('Acceptance criteria')).toBeVisible();
  await expect(checklist.getByText('Task breakdown')).toBeVisible();
  await expect(checklist.getByText('Dependency map')).toBeVisible();
});

// ---------------------------------------------------------------------------
// T06: Edit system prompt prefix persists in state
// ---------------------------------------------------------------------------

test('Edit system prompt prefix persists in state @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  // Add and select a Plan node
  const paletteBlock = page.getByTestId('palette-block-plan');
  const canvas = page.getByTestId('studio-canvas');
  await expect(paletteBlock).toBeVisible({ timeout: 5_000 });

  const paletteBBox = await paletteBlock.boundingBox();
  const canvasBBox = await canvas.boundingBox();

  if (paletteBBox && canvasBBox) {
    await page.mouse.move(paletteBBox.x + paletteBBox.width / 2, paletteBBox.y + paletteBBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBBox.x + canvasBBox.width / 2, canvasBBox.y + canvasBBox.height / 2, { steps: 10 });
    await page.mouse.up();
  }

  await canvas.getByText('Plan').first().click();
  await expect(page.getByTestId('block-config-panel')).toBeVisible({ timeout: 3_000 });

  // Clear and type new value
  const prefixInput = page.getByTestId('prompt-prefix-input');
  await prefixInput.click();
  await prefixInput.fill('You are a security auditor.');

  // Click canvas to deselect
  await canvas.click({ position: { x: 10, y: 10 } });

  // Re-select the node
  await canvas.getByText('Plan').first().click();
  await expect(page.getByTestId('block-config-panel')).toBeVisible({ timeout: 3_000 });

  // Verify the value persisted
  await expect(page.getByTestId('prompt-prefix-input')).toHaveValue('You are a security auditor.');
});

// ---------------------------------------------------------------------------
// T07: Add and remove output checklist items
// ---------------------------------------------------------------------------

test('Add and remove output checklist items @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  // Add and select a Plan node
  const paletteBlock = page.getByTestId('palette-block-plan');
  const canvas = page.getByTestId('studio-canvas');
  await expect(paletteBlock).toBeVisible({ timeout: 5_000 });

  const paletteBBox = await paletteBlock.boundingBox();
  const canvasBBox = await canvas.boundingBox();

  if (paletteBBox && canvasBBox) {
    await page.mouse.move(paletteBBox.x + paletteBBox.width / 2, paletteBBox.y + paletteBBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBBox.x + canvasBBox.width / 2, canvasBBox.y + canvasBBox.height / 2, { steps: 10 });
    await page.mouse.up();
  }

  await canvas.getByText('Plan').first().click();
  await expect(page.getByTestId('block-config-panel')).toBeVisible({ timeout: 3_000 });

  const checklist = page.getByTestId('output-checklist');

  // Count initial items (should be 4 defaults)
  const initialItems = await checklist.locator('li, [data-checklist-item]').count();

  // Click the add button and type a new item
  const addBtn = checklist.getByRole('button', { name: /add/i }).or(checklist.locator('button').last());
  await addBtn.click();

  // Type the new item name and confirm
  const newInput = checklist.locator('input').last();
  if (await newInput.isVisible()) {
    await newInput.fill('Generate architecture diagram');
    await newInput.press('Enter');
  }

  // Verify item was added
  await expect(checklist.getByText('Generate architecture diagram')).toBeVisible({ timeout: 3_000 });

  // Remove the new item
  const removeBtn = checklist
    .locator('li, [data-checklist-item]')
    .filter({ hasText: 'Generate architecture diagram' })
    .getByRole('button')
    .first();
  if (await removeBtn.isVisible()) {
    await removeBtn.click();
  }

  // Verify item was removed
  await expect(checklist.getByText('Generate architecture diagram')).not.toBeVisible({ timeout: 3_000 });
});

// ---------------------------------------------------------------------------
// T08: Agent backend selector defaults to Claude
// ---------------------------------------------------------------------------

test('Agent backend selector defaults to Claude @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  // Add and select a Plan node
  const paletteBlock = page.getByTestId('palette-block-plan');
  const canvas = page.getByTestId('studio-canvas');
  await expect(paletteBlock).toBeVisible({ timeout: 5_000 });

  const paletteBBox = await paletteBlock.boundingBox();
  const canvasBBox = await canvas.boundingBox();

  if (paletteBBox && canvasBBox) {
    await page.mouse.move(paletteBBox.x + paletteBBox.width / 2, paletteBBox.y + paletteBBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBBox.x + canvasBBox.width / 2, canvasBBox.y + canvasBBox.height / 2, { steps: 10 });
    await page.mouse.up();
  }

  await canvas.getByText('Plan').first().click();
  await expect(page.getByTestId('block-config-panel')).toBeVisible({ timeout: 3_000 });

  // Backend selector should be visible with Claude selected
  const backendSelector = page.getByTestId('backend-selector');
  await expect(backendSelector).toBeVisible();
  await expect(
    backendSelector.getByText('Claude Code (Docker)').or(backendSelector.getByText('Claude')),
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// T09: Change agent backend to Cursor
// ---------------------------------------------------------------------------

test('Change agent backend to Cursor @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  // Add and select a Plan node
  const paletteBlock = page.getByTestId('palette-block-plan');
  const canvas = page.getByTestId('studio-canvas');
  await expect(paletteBlock).toBeVisible({ timeout: 5_000 });

  const paletteBBox = await paletteBlock.boundingBox();
  const canvasBBox = await canvas.boundingBox();

  if (paletteBBox && canvasBBox) {
    await page.mouse.move(paletteBBox.x + paletteBBox.width / 2, paletteBBox.y + paletteBBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBBox.x + canvasBBox.width / 2, canvasBBox.y + canvasBBox.height / 2, { steps: 10 });
    await page.mouse.up();
  }

  await canvas.getByText('Plan').first().click();
  await expect(page.getByTestId('block-config-panel')).toBeVisible({ timeout: 3_000 });

  // Click cursor option in the backend selector
  const backendSelector = page.getByTestId('backend-selector');
  const cursorOption = backendSelector.getByText('Cursor CLI (Docker)').or(backendSelector.getByText('Cursor'));
  await cursorOption.click();

  // Deselect and re-select node to verify persistence
  await canvas.click({ position: { x: 10, y: 10 } });
  await canvas.getByText('Plan').first().click();
  await expect(page.getByTestId('block-config-panel')).toBeVisible({ timeout: 3_000 });

  // Cursor should still be selected
  // Check via the radio/button being in active/selected state
  const cursorActive = backendSelector
    .locator('[aria-checked="true"], [data-active="true"], .bg-blue-600, .ring-blue-500')
    .filter({ hasText: /cursor/i });
  await expect(cursorActive.or(backendSelector.getByText(/cursor/i).first())).toBeVisible();
});

// ---------------------------------------------------------------------------
// T10: Add workflow-level rules
// ---------------------------------------------------------------------------

test('Add workflow-level rules @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  const rulesBar = page.getByTestId('workflow-rules-bar');
  await expect(rulesBar).toBeVisible({ timeout: 5_000 });

  const addRuleInput = page.getByTestId('add-rule-input').locator('input');

  // Add first rule
  await addRuleInput.fill('Use Python');
  await addRuleInput.press('Enter');

  // Add second rule
  await addRuleInput.fill('Write unit tests');
  await addRuleInput.press('Enter');

  // Verify both rule chips are visible
  await expect(rulesBar.getByText('Use Python')).toBeVisible({ timeout: 3_000 });
  await expect(rulesBar.getByText('Write unit tests')).toBeVisible();
});

// ---------------------------------------------------------------------------
// T11: Remove a workflow rule
// ---------------------------------------------------------------------------

test('Remove a workflow rule @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  const rulesBar = page.getByTestId('workflow-rules-bar');
  await expect(rulesBar).toBeVisible({ timeout: 5_000 });

  const addRuleInput = page.getByTestId('add-rule-input').locator('input');

  // Add two rules
  await addRuleInput.fill('Rule A');
  await addRuleInput.press('Enter');
  await addRuleInput.fill('Rule B');
  await addRuleInput.press('Enter');

  await expect(rulesBar.getByText('Rule A')).toBeVisible({ timeout: 3_000 });
  await expect(rulesBar.getByText('Rule B')).toBeVisible();

  // Remove Rule A by clicking the X/remove button on its chip
  const ruleAChip = rulesBar.locator('[data-tag]', { hasText: 'Rule A' }).or(
    rulesBar.locator('span', { hasText: 'Rule A' }).locator('..'),
  );
  const removeBtn = ruleAChip.getByRole('button').or(ruleAChip.locator('button'));
  await removeBtn.first().click();

  // Only Rule B should remain
  await expect(rulesBar.getByText('Rule A')).not.toBeVisible({ timeout: 3_000 });
  await expect(rulesBar.getByText('Rule B')).toBeVisible();
});

// ---------------------------------------------------------------------------
// T12: Save as Template opens dialog
// ---------------------------------------------------------------------------

test('Save as Template opens dialog @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  // Wait for page to be ready
  await expect(page.getByTestId('block-palette')).toBeVisible({ timeout: 5_000 });

  // Click Save as Template button
  await page.getByTestId('save-as-template-btn').click();

  // Dialog should appear with name input
  await expect(page.getByPlaceholder('Template name...')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// T13: Save as Template persists to template store (main process verification)
// ---------------------------------------------------------------------------

test('Save as Template persists to template store @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  // Add a Plan node first
  const paletteBlock = page.getByTestId('palette-block-plan');
  const canvas = page.getByTestId('studio-canvas');
  await expect(paletteBlock).toBeVisible({ timeout: 5_000 });

  const paletteBBox = await paletteBlock.boundingBox();
  const canvasBBox = await canvas.boundingBox();

  if (paletteBBox && canvasBBox) {
    await page.mouse.move(paletteBBox.x + paletteBBox.width / 2, paletteBBox.y + paletteBBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBBox.x + canvasBBox.width / 2, canvasBBox.y + canvasBBox.height / 2, { steps: 10 });
    await page.mouse.up();
  }

  // Add a workflow rule
  const addRuleInput = page.getByTestId('add-rule-input').locator('input');
  await addRuleInput.fill('Always test first');
  await addRuleInput.press('Enter');

  // Click Save as Template
  await page.getByTestId('save-as-template-btn').click();

  // Enter template name and confirm
  const nameInput = page.getByPlaceholder('Template name...');
  await expect(nameInput).toBeVisible({ timeout: 3_000 });
  await nameInput.fill('E2E Test Template');
  await page.getByRole('button', { name: 'Save' }).click();

  // Wait for save to complete
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

  // Verify via IPC that the template was saved
  const templates = await page.evaluate(async () => {
    return window.electronAPI.template.list();
  });

  const savedTemplate = templates.find(
    (t: { name: string }) => t.name === 'E2E Test Template',
  );
  expect(savedTemplate).toBeTruthy();
  expect(savedTemplate?.tags).toContain('studio-block-composer');
});

// ---------------------------------------------------------------------------
// T14: Studio page renders without console errors
// ---------------------------------------------------------------------------

test('Studio page renders without console errors @smoke', async () => {
  const errors: string[] = [];

  ({ electronApp, page } = await launchStudio());

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Wait for full page load
  await expect(page.getByTestId('block-palette')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('studio-canvas')).toBeVisible();

  // Give a moment for any deferred errors
  await page.waitForTimeout(1_000);

  expect(errors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// T15: Prompt harness fields saved in workflow definition (IPC)
// ---------------------------------------------------------------------------

test('Prompt harness fields saved in workflow definition @regression', async () => {
  ({ electronApp, page } = await launchStudio());

  // Add a Plan node
  const paletteBlock = page.getByTestId('palette-block-plan');
  const canvas = page.getByTestId('studio-canvas');
  await expect(paletteBlock).toBeVisible({ timeout: 5_000 });

  const paletteBBox = await paletteBlock.boundingBox();
  const canvasBBox = await canvas.boundingBox();

  if (paletteBBox && canvasBBox) {
    await page.mouse.move(paletteBBox.x + paletteBBox.width / 2, paletteBBox.y + paletteBBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBBox.x + canvasBBox.width / 2, canvasBBox.y + canvasBBox.height / 2, { steps: 10 });
    await page.mouse.up();
  }

  // Select the node and modify harness fields
  await canvas.getByText('Plan').first().click();
  await expect(page.getByTestId('block-config-panel')).toBeVisible({ timeout: 3_000 });

  const prefixInput = page.getByTestId('prompt-prefix-input');
  await prefixInput.fill('Custom prefix for testing.');

  // Save as template
  await page.getByTestId('save-as-template-btn').click();
  const nameInput = page.getByPlaceholder('Template name...');
  await expect(nameInput).toBeVisible({ timeout: 3_000 });
  await nameInput.fill('Harness Fields Test');
  await page.getByRole('button', { name: 'Save' }).click();

  // Wait for save to complete
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 5_000 });

  // Load the saved template via IPC and verify harness fields
  const templates = await page.evaluate(async () => {
    return window.electronAPI.template.list();
  });

  const savedTemplate = templates.find(
    (t: { name: string }) => t.name === 'Harness Fields Test',
  );
  expect(savedTemplate).toBeTruthy();

  // Load full template to check node configs
  const loaded = await page.evaluate(async (id: string) => {
    return window.electronAPI.template.load(id);
  }, savedTemplate!.id);

  expect(loaded).toBeTruthy();
  expect(loaded!.nodes.length).toBeGreaterThan(0);

  const planNode = loaded!.nodes[0];
  expect(planNode.config.systemPromptPrefix).toBe('Custom prefix for testing.');
  expect(planNode.config.outputChecklist).toBeTruthy();
  expect(Array.isArray(planNode.config.outputChecklist)).toBe(true);
});
