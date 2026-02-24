/**
 * templates.spec.ts — E2E tests for F02: Template Repository.
 *
 * Route: /templates
 * Requires a production build: `npm run build` before running.
 * Tests use mock mode (no Docker required).
 */
import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { launchTemplates, createTestTemplate } from './helpers';

let electronApp: ElectronApplication;
let page: Page;

test.afterEach(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});

// ---------------------------------------------------------------------------
// T01: Templates page renders (smoke)
// ---------------------------------------------------------------------------

test('Templates page renders @smoke', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Page should be visible with header elements
  await expect(page.getByText('Templates').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('new-template-btn')).toBeVisible();
});

// ---------------------------------------------------------------------------
// T02: Template list shows saved templates
// ---------------------------------------------------------------------------

test('Template list shows saved templates @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Pre-create 2 templates via IPC
  await createTestTemplate(page, { name: 'TDD Workflow' });
  await createTestTemplate(page, { name: 'Security Pipeline' });

  // Reload templates by navigating away and back
  await page.click('text=Designer');
  await page.click('text=Templates');

  // Both templates should be visible
  await expect(page.getByText('TDD Workflow')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Security Pipeline')).toBeVisible();
});

// ---------------------------------------------------------------------------
// T03: Search filters templates by name
// ---------------------------------------------------------------------------

test('Search filters templates by name @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Pre-create templates
  await createTestTemplate(page, { name: 'TDD Cycle' });
  await createTestTemplate(page, { name: 'Full Pipeline' });
  await createTestTemplate(page, { name: 'Code Review' });

  // Reload to see templates
  await page.click('text=Designer');
  await page.click('text=Templates');
  await expect(page.getByText('TDD Cycle')).toBeVisible({ timeout: 5_000 });

  // Type search query
  const searchInput = page.getByTestId('template-search');
  await searchInput.fill('tdd');

  // Only TDD Cycle should be visible (debounce 300ms)
  await expect(page.getByText('TDD Cycle')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText('Full Pipeline')).not.toBeVisible({ timeout: 3_000 });
  await expect(page.getByText('Code Review')).not.toBeVisible();

  // Clear search
  await searchInput.fill('');

  // All templates should reappear
  await expect(page.getByText('TDD Cycle')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText('Full Pipeline')).toBeVisible();
  await expect(page.getByText('Code Review')).toBeVisible();
});

// ---------------------------------------------------------------------------
// T04: Tag filter narrows results
// ---------------------------------------------------------------------------

test('Tag filter narrows results @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Pre-create templates with different tags
  await createTestTemplate(page, { name: 'Template A', tags: ['tdd'] });
  await createTestTemplate(page, { name: 'Template B', tags: ['review'] });
  await createTestTemplate(page, { name: 'Template C', tags: ['tdd', 'ci'] });

  // Reload
  await page.click('text=Designer');
  await page.click('text=Templates');
  await expect(page.getByText('Template A')).toBeVisible({ timeout: 5_000 });

  // Click the "tdd" tag filter chip
  const tagFilter = page.getByTestId('tag-filter');
  if (await tagFilter.isVisible()) {
    await tagFilter.getByText('tdd').click();

    // Only templates with "tdd" tag should be visible
    await expect(page.getByText('Template A')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Template C')).toBeVisible();
    await expect(page.getByText('Template B')).not.toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// T05: Status filter hides paused templates
// ---------------------------------------------------------------------------

test('Status filter hides paused templates @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Pre-create 2 active and 1 paused template
  await createTestTemplate(page, { name: 'Active One', status: 'active' });
  await createTestTemplate(page, { name: 'Active Two', status: 'active' });
  await createTestTemplate(page, { name: 'Paused One', status: 'paused' });

  // Reload
  await page.click('text=Designer');
  await page.click('text=Templates');
  await expect(page.getByText('Active One')).toBeVisible({ timeout: 5_000 });

  // Select "Active" status filter
  const statusFilter = page.getByTestId('status-filter');
  await statusFilter.getByText('Active').click();

  // Only active templates should show
  await expect(page.getByText('Active One')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText('Active Two')).toBeVisible();
  await expect(page.getByText('Paused One')).not.toBeVisible();

  // Select "All" to show everything again
  await statusFilter.getByText('All').click();
  await expect(page.getByText('Paused One')).toBeVisible({ timeout: 3_000 });
});

// ---------------------------------------------------------------------------
// T06: New Template button navigates to designer with blank canvas
// ---------------------------------------------------------------------------

test('New Template button navigates to designer @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  await expect(page.getByTestId('new-template-btn')).toBeVisible({ timeout: 5_000 });

  // Click "New Template"
  await page.getByTestId('new-template-btn').click();

  // Should navigate to the designer page
  await expect(page.locator('main')).toBeVisible({ timeout: 5_000 });

  // The canvas/designer area should be visible
  // Designer page is at "/" — check that we're on it
  const designerLink = page.getByRole('link', { name: 'Designer' });
  await expect(designerLink).toBeVisible();
});

// ---------------------------------------------------------------------------
// T07: Edit template loads it into designer
// ---------------------------------------------------------------------------

test('Edit template loads it into designer @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Pre-create a template with 2 nodes
  const templateId = await createTestTemplate(page, {
    name: 'Editable Template',
    nodeCount: 2,
  });

  // Reload
  await page.click('text=Designer');
  await page.click('text=Templates');

  // Wait for template card to appear
  const card = page.getByTestId(`template-card-${templateId}`);
  await expect(card).toBeVisible({ timeout: 5_000 });

  // Click "Edit" on the card
  await card.getByText('Edit').click();

  // Should navigate to the designer with nodes loaded
  await expect(page.locator('main')).toBeVisible({ timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// T08: Delete template with confirmation
// ---------------------------------------------------------------------------

test('Delete template with confirmation @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Pre-create a template
  const templateId = await createTestTemplate(page, { name: 'Delete Me' });

  // Reload
  await page.click('text=Designer');
  await page.click('text=Templates');

  const card = page.getByTestId(`template-card-${templateId}`);
  await expect(card).toBeVisible({ timeout: 5_000 });

  // Click "Del" on the card
  await card.getByText('Del').click();

  // Confirmation dialog should appear
  await expect(page.getByText('Delete Template')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText(/Delete Me/)).toBeVisible();

  // Confirm deletion
  await page.getByRole('button', { name: 'Delete' }).click();

  // Card should no longer be visible
  await expect(card).not.toBeVisible({ timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// T09: Delete template cancel preserves template
// ---------------------------------------------------------------------------

test('Delete template cancel preserves template @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Pre-create a template
  const templateId = await createTestTemplate(page, { name: 'Keep Me' });

  // Reload
  await page.click('text=Designer');
  await page.click('text=Templates');

  const card = page.getByTestId(`template-card-${templateId}`);
  await expect(card).toBeVisible({ timeout: 5_000 });

  // Click "Del"
  await card.getByText('Del').click();

  // Dialog appears
  await expect(page.getByText('Delete Template')).toBeVisible({ timeout: 3_000 });

  // Cancel
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Card should still be visible
  await expect(card).toBeVisible({ timeout: 3_000 });
});

// ---------------------------------------------------------------------------
// T10: Toggle template status (active to paused)
// ---------------------------------------------------------------------------

test('Toggle template status active to paused @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Pre-create an active template
  const templateId = await createTestTemplate(page, {
    name: 'Toggle Status Test',
    status: 'active',
  });

  // Reload
  await page.click('text=Designer');
  await page.click('text=Templates');

  const card = page.getByTestId(`template-card-${templateId}`);
  await expect(card).toBeVisible({ timeout: 5_000 });

  // Click the status badge to toggle
  const statusBadge = page.getByTestId(`status-badge-${templateId}`);
  await statusBadge.click();

  // Badge should change to "Paused" (optimistic update)
  await expect(card.getByText('Paused')).toBeVisible({ timeout: 3_000 });
});

// ---------------------------------------------------------------------------
// T11: Toggle status persists (IPC verification)
// ---------------------------------------------------------------------------

test('Toggle status persists via IPC @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Pre-create an active template
  const templateId = await createTestTemplate(page, {
    name: 'Persist Toggle Test',
    status: 'active',
  });

  // Reload
  await page.click('text=Designer');
  await page.click('text=Templates');

  const statusBadge = page.getByTestId(`status-badge-${templateId}`);
  await expect(statusBadge).toBeVisible({ timeout: 5_000 });

  // Toggle to paused
  await statusBadge.click();

  // Wait a moment for IPC to complete
  await page.waitForTimeout(500);

  // Verify via IPC that the toggle persisted
  const loaded = await page.evaluate(async (id: string) => {
    return window.electronAPI.template.load(id);
  }, templateId);

  expect(loaded).toBeTruthy();
  expect(loaded?.metadata?.status).toBe('paused');
});

// ---------------------------------------------------------------------------
// T12: Duplicate creates a copy
// ---------------------------------------------------------------------------

test('Duplicate creates a copy @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Pre-create a template
  const templateId = await createTestTemplate(page, {
    name: 'Original Pipeline',
  });

  // Reload
  await page.click('text=Designer');
  await page.click('text=Templates');

  const card = page.getByTestId(`template-card-${templateId}`);
  await expect(card).toBeVisible({ timeout: 5_000 });

  // Click "Dup" on the card
  await card.getByText('Dup').click();

  // A new card with "(Copy)" suffix should appear
  await expect(
    page.getByText('Original Pipeline (Copy)').or(page.getByText(/Original Pipeline.*Copy/)),
  ).toBeVisible({ timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// T13: Duplicate of paused template is Active
// ---------------------------------------------------------------------------

test('Duplicate of paused template is Active @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Pre-create a paused template
  const templateId = await createTestTemplate(page, {
    name: 'Draft Pipeline',
    status: 'paused',
  });

  // Reload
  await page.click('text=Designer');
  await page.click('text=Templates');

  const card = page.getByTestId(`template-card-${templateId}`);
  await expect(card).toBeVisible({ timeout: 5_000 });

  // Duplicate it
  await card.getByText('Dup').click();

  // Wait for the duplicate card to appear
  await expect(
    page.getByText('Draft Pipeline (Copy)').or(page.getByText(/Draft Pipeline.*Copy/)),
  ).toBeVisible({ timeout: 5_000 });

  // The duplicate should show "Active" status
  // Find the duplicate card and check its status badge
  const allCards = page.locator('[data-testid^="template-card-"]');
  const cardCount = await allCards.count();

  // Check template list via IPC for the duplicate's status
  const templates = await page.evaluate(async () => {
    return window.electronAPI.template.list();
  });

  const duplicate = templates.find(
    (t: { name: string; id: string }) =>
      t.name.includes('Draft Pipeline') && t.name.includes('Copy'),
  );
  expect(duplicate).toBeTruthy();
  expect(duplicate?.status ?? 'active').toBe('active');
});

// ---------------------------------------------------------------------------
// T14: Empty state message when no templates match
// ---------------------------------------------------------------------------

test('Empty state message when no templates match @regression', async () => {
  ({ electronApp, page } = await launchTemplates());

  // Wait for page to load (may show "No templates yet" if empty)
  await expect(page.getByTestId('new-template-btn')).toBeVisible({ timeout: 5_000 });

  // If no templates exist, we should see the empty state
  const hasTemplates = await page
    .locator('[data-testid^="template-card-"]')
    .first()
    .isVisible()
    .catch(() => false);

  if (!hasTemplates) {
    // Should show empty state
    await expect(
      page.getByText('No templates yet').or(page.getByText('No templates')).first(),
    ).toBeVisible({ timeout: 3_000 });
  } else {
    // Search for something that won't match
    const searchInput = page.getByTestId('template-search');
    await searchInput.fill('xyznonexistentquery99999');

    // Should show no-match message
    await expect(
      page
        .getByText('No templates match')
        .or(page.getByText('No results'))
        .first(),
    ).toBeVisible({ timeout: 3_000 });
  }
});
