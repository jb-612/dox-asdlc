# P15 Electron Workflow Studio -- UAT and E2E Test Design

**Version:** 1.0
**Date:** 2026-02-24
**Framework:** Playwright Electron (`@playwright/test` + `_electron`)
**Scope:** 8 features (F01--F08), ~110 test cases

---

## 1. Overview

### Purpose

This document defines the User Acceptance Test (UAT) and End-to-End (E2E) test strategy for the
P15 Electron Workflow Studio feature set. Tests validate that all eight features work correctly
from the user's perspective through the full Electron application stack: renderer UI, IPC channels,
main process services, and (where applicable) Docker container integration.

### Framework

All tests use Playwright's Electron support via `@playwright/test`:

- `_electron.launch({ args: [APP_MAIN] })` to start the built application
- `electronApp.firstWindow()` for renderer Page interactions
- `electronApp.evaluate(fn)` for main process assertions (IPC, services)
- Standard Playwright selectors (`getByRole`, `getByText`, `getByPlaceholder`, `getByTestId`)

### Test Organization

One spec file per feature, plus one cross-feature integration spec:

```
apps/workflow-studio/test/e2e/
  app.spec.ts               # Existing: smoke tests
  settings.spec.ts          # Existing: legacy settings (to be updated for F08)
  execution.spec.ts         # Existing: mock-mode execution
  execution-real.spec.ts    # Existing: real-mode execution
  cursor-agent.spec.ts      # Existing: cursor agent integration
  studio.spec.ts            # NEW: F01 Studio Block Composer
  templates.spec.ts         # NEW: F02 Template Repository
  launcher.spec.ts          # NEW: F03 Execute Launcher
  multistep.spec.ts         # NEW: F04 Multi-Step Execution UX
  parallel.spec.ts          # NEW: F05 Parallel Execution Engine
  cli-sessions.spec.ts      # NEW: F06 CLI Session Enhancement
  monitoring.spec.ts        # NEW: F07 Monitoring Dashboard
  settings-redesign.spec.ts # NEW: F08 Settings Redesign
  integration.spec.ts       # NEW: Cross-feature integration
```

### Conventions

- **Selector preference**: `getByRole` > `getByText` > `getByPlaceholder` > `getByTestId` > CSS
- **Cleanup**: Every test uses `try/finally` with `electronApp.close()` in the `finally` block
- **Independence**: Each test launches and closes its own app instance
- **Tags**: `@smoke`, `@regression`, `@requires-docker`, `@requires-claude` (via test titles or annotations)
- **Timeouts**: 5s for UI assertions, 10s for IPC-dependent state, 30s for Docker operations

---

## 2. Test Infrastructure

### 2.1 Shared Fixtures and Helpers

All new spec files import from a shared helpers module:

```typescript
// test/e2e/helpers.ts
import { _electron as electron } from '@playwright/test';
import { join } from 'path';
import type { ElectronApplication, Page } from '@playwright/test';

export const APP_MAIN = join(__dirname, '../../dist/main/index.js');

/** Launch app and navigate to a specific route via sidebar link text. */
export async function launchAndNavigate(
  linkText: string
): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const electronApp = await electron.launch({ args: [APP_MAIN] });
  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.click(`text=${linkText}`);
  return { electronApp, page };
}

/** Launch app and navigate to the Studio page. */
export async function launchStudio(): Promise<{ electronApp: ElectronApplication; page: Page }> {
  return launchAndNavigate('Studio');
}

/** Launch app and navigate to the Templates page. */
export async function launchTemplates(): Promise<{ electronApp: ElectronApplication; page: Page }> {
  return launchAndNavigate('Templates');
}

/** Launch app and navigate to the Execute page. */
export async function launchExecute(): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const result = await launchAndNavigate('Execute');
  const { page } = result;
  await expect(page.getByText('Execute Workflow').or(page.getByText('Select Template'))).toBeVisible({ timeout: 5_000 });
  return result;
}

/** Launch app and navigate to the CLI Sessions page. */
export async function launchCLI(): Promise<{ electronApp: ElectronApplication; page: Page }> {
  return launchAndNavigate('CLI Sessions');
}

/** Launch app and navigate to the Monitoring page. */
export async function launchMonitoring(): Promise<{ electronApp: ElectronApplication; page: Page }> {
  return launchAndNavigate('Monitoring');
}

/** Launch app and navigate to the Settings page. */
export async function launchSettings(): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const result = await launchAndNavigate('Settings');
  // Wait for the settings form to be fully loaded
  const { page } = result;
  await expect(page.getByRole('tab').or(page.getByRole('button', { name: 'Save' }))).toBeVisible({ timeout: 10_000 });
  return result;
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
```

### 2.2 Test Data Management

**Workflow fixtures**: The app ships with built-in mock workflows ("TDD Pipeline", "Security Scan",
"Cursor Pipeline") when `executionMockMode` is true. Tests that need custom workflows use
`electronApp.evaluate()` to inject data via the main process.

**Template fixtures**: Tests that need saved templates create them programmatically via IPC:

```typescript
// Create a test template via main process evaluation
await electronApp.evaluate(async ({ ipcMain }) => {
  // Dispatch template:save IPC to create fixture data
});
```

**Settings fixtures**: The default settings loaded at app startup provide a clean baseline.
Tests that modify settings restore defaults in the `finally` block or rely on fresh app launches.

### 2.3 Environment Configuration

| Environment Variable | Purpose | Default |
|----------------------|---------|---------|
| `DOCKER_AVAILABLE` | Skips Docker-dependent tests when `false` | Auto-detected |
| `CLAUDE_CLI_PATH` | Path to claude CLI for real-mode tests | System PATH |
| `CURSOR_AGENT_URL` | URL for cursor agent tests | `http://localhost:8090` |

### 2.4 CI Considerations

| Test Category | Requires | CI Strategy |
|---------------|----------|-------------|
| `@smoke` | Built app only | Every PR |
| `@regression` | Built app only | Every PR |
| `@requires-docker` | Docker daemon | Nightly / manual |
| `@requires-claude` | claude CLI on PATH | Nightly / manual |
| `@requires-cursor` | Cursor agent container | Manual only |

---

## 3. Test Spec Files

### 3.1 F01 -- Studio Block Composer (`studio.spec.ts`)

**Route**: `/studio`
**Helper**: `launchStudio()`

#### Recommended `data-testid` attributes

| Component | Attribute |
|-----------|-----------|
| `BlockPalette` | `data-testid="block-palette"` |
| Plan block card in palette | `data-testid="palette-block-plan"` |
| `StudioCanvas` | `data-testid="studio-canvas"` |
| `BlockConfigPanel` | `data-testid="block-config-panel"` |
| System prompt prefix textarea | `data-testid="prompt-prefix-input"` |
| Output checklist container | `data-testid="output-checklist"` |
| Agent backend selector | `data-testid="backend-selector"` |
| Rules bar | `data-testid="workflow-rules-bar"` |
| Add rule input | `data-testid="add-rule-input"` |
| Save as Template button | `data-testid="save-as-template-btn"` |
| Parallel lane overlay | `data-testid="parallel-lane-overlay"` |

#### Tests

**T01: Studio page renders (smoke)**
- Navigate to `/studio`
- Assert: page heading "Block Composer" or Studio canvas is visible
- Assert: `data-testid="block-palette"` is visible
- Tag: `@smoke`

**T02: Block palette shows Plan block**
- Navigate to `/studio`
- Assert: a card with text "Plan" is visible inside the palette
- Assert: no "Dev", "Test", "Review", or "DevOps" cards are visible (Phase 1 scope)
- Tag: `@regression`

**T03: Drag Plan block onto canvas creates node**
- Locate the Plan block card in the palette
- Drag to the canvas area (using `page.dragAndDrop` or manual mouse events)
- Assert: a node with label "Plan" appears on the canvas
- Tag: `@regression`

**T04: Selecting a Plan node opens config panel**
- Add a Plan block to the canvas (via drag or programmatic action)
- Click on the Plan node
- Assert: `data-testid="block-config-panel"` becomes visible
- Assert: "System Prompt Prefix" label is visible
- Assert: "Output Checklist" label is visible
- Tag: `@regression`

**T05: Default prompt harness is pre-populated**
- Add a Plan block and select it
- Assert: the prompt prefix textarea contains text matching "senior technical planner"
- Assert: the output checklist has 4 default items (Requirements document, Acceptance criteria, Task breakdown, Dependency map)
- Tag: `@regression`

**T06: Edit system prompt prefix persists in state**
- Add a Plan block and select it
- Clear the prompt prefix textarea and type "You are a security auditor."
- Click elsewhere on the canvas (deselect)
- Re-select the Plan node
- Assert: prompt prefix textarea contains "You are a security auditor."
- Tag: `@regression`

**T07: Add and remove output checklist items**
- Add a Plan block and select it
- Click the add button in the output checklist area
- Type "Generate architecture diagram" and confirm
- Assert: a new checklist item appears
- Click the remove button on the new item
- Assert: the item is removed
- Tag: `@regression`

**T08: Agent backend selector defaults to Claude**
- Add a Plan block and select it
- Assert: the backend selector shows "Claude Code (Docker)" as selected/active
- Tag: `@regression`

**T09: Change agent backend to Cursor**
- Add a Plan block and select it
- Select "Cursor CLI (Docker)" in the backend selector
- Click elsewhere, then re-select the node
- Assert: "Cursor CLI (Docker)" is still selected
- Tag: `@regression`

**T10: Add workflow-level rules**
- Navigate to the rules bar area
- Type "Use Python" in the add-rule input and press Enter
- Type "Write unit tests" and press Enter
- Assert: two rule chips are visible: "Use Python" and "Write unit tests"
- Tag: `@regression`

**T11: Remove a workflow rule**
- Add two rules ("Rule A", "Rule B")
- Click the remove button on "Rule A"
- Assert: only "Rule B" remains
- Tag: `@regression`

**T12: Save as Template opens dialog**
- Add a Plan block with one rule
- Click `data-testid="save-as-template-btn"`
- Assert: a dialog/modal appears asking for template name
- Tag: `@regression`

**T13: Save as Template persists to template store (main process verification)**
- Add a Plan block, set a rule, click Save as Template
- Enter name "E2E Test Template" and confirm
- Use `electronApp.evaluate()` to invoke `template:list` IPC
- Assert: the returned list includes an entry with name "E2E Test Template"
- Assert: the template's tags include `"studio-block-composer"`
- Tag: `@regression`

**T14: Studio page renders without console errors**
- Collect console errors during Studio page load and interaction
- Assert: no `console.error` messages
- Tag: `@smoke`

#### Main Process Tests

**T15: Prompt harness fields saved in workflow definition (IPC)**
- Create a workflow with a Plan block via the Studio UI
- Save as template
- Use `electronApp.evaluate()` to load the template via `template:load`
- Assert: node config has `systemPromptPrefix` and `outputChecklist` fields
- Tag: `@regression`

---

### 3.2 F02 -- Template Repository (`templates.spec.ts`)

**Route**: `/templates`
**Helper**: `launchTemplates()`

#### Recommended `data-testid` attributes

| Component | Attribute |
|-----------|-----------|
| Template card | `data-testid="template-card-{id}"` |
| Search input | `data-testid="template-search"` |
| New Template button | `data-testid="new-template-btn"` |
| Status filter | `data-testid="status-filter"` |
| Tag filter chips | `data-testid="tag-filter"` |
| Delete confirmation dialog | `data-testid="delete-confirm-dialog"` |
| Status badge | `data-testid="status-badge-{id}"` |

#### Tests

**T01: Templates page renders (smoke)**
- Navigate to `/templates`
- Assert: page heading or template list area is visible
- Assert: "New Template" button is visible
- Tag: `@smoke`

**T02: Template list shows saved templates**
- Pre-create 2 templates via `electronApp.evaluate()` (IPC `template:save`)
- Navigate to `/templates`
- Assert: both template names are visible as cards
- Tag: `@regression`

**T03: Search filters templates by name**
- Pre-create templates: "TDD Cycle", "Full Pipeline", "Code Review"
- Type "tdd" in the search input
- Assert: only "TDD Cycle" card is visible
- Clear search
- Assert: all 3 cards are visible
- Tag: `@regression`

**T04: Tag filter narrows results**
- Pre-create templates with tags: `["tdd"]`, `["review"]`, `["tdd", "ci"]`
- Click the "tdd" tag filter chip
- Assert: only 2 templates (the ones tagged "tdd") are visible
- Tag: `@regression`

**T05: Status filter hides paused templates**
- Pre-create 2 active and 1 paused template
- Select "Active" status filter
- Assert: only 2 cards visible
- Select "All"
- Assert: all 3 cards visible
- Tag: `@regression`

**T06: New Template button navigates to designer with blank canvas**
- Click "New Template"
- Assert: navigation moves to `/` or `/studio`
- Assert: the canvas/designer is visible and empty (no pre-existing nodes)
- Tag: `@regression`

**T07: Edit template loads it into designer**
- Pre-create a template with 2 nodes
- Click "Edit" on that template's card
- Assert: navigation moves to designer/studio
- Assert: 2 nodes are visible on the canvas
- Tag: `@regression`

**T08: Delete template with confirmation**
- Pre-create a template "Delete Me"
- Click "Delete" on that template card
- Assert: confirmation dialog appears with the template name
- Click "Confirm" / "Delete" button in dialog
- Assert: "Delete Me" card is no longer visible
- Tag: `@regression`

**T09: Delete template cancel preserves template**
- Pre-create a template "Keep Me"
- Click "Delete" on that template card
- Click "Cancel" in the confirmation dialog
- Assert: "Keep Me" card is still visible
- Tag: `@regression`

**T10: Toggle template status (active to paused)**
- Pre-create an active template
- Click the status badge (should be "Active")
- Assert: badge changes to "Paused" (optimistic UI, immediate)
- Tag: `@regression`

**T11: Toggle status persists (IPC verification)**
- Toggle a template to "Paused"
- Use `electronApp.evaluate()` to call `template:load`
- Assert: `metadata.status === 'paused'`
- Tag: `@regression`

**T12: Duplicate creates a copy**
- Pre-create template "Original Pipeline"
- Click "Duplicate" on that card
- Assert: a new card "Original Pipeline (Copy)" appears
- Tag: `@regression`

**T13: Duplicate of paused template is Active**
- Pre-create a paused template "Draft Pipeline"
- Click "Duplicate"
- Assert: the duplicate card shows "Active" status badge
- Tag: `@regression`

**T14: Empty state message when no templates match**
- Navigate to templates with no saved templates (or search for non-existent term)
- Assert: empty state message is visible (e.g., "No templates found" or similar)
- Tag: `@regression`

---

### 3.3 F03 -- Execute Launcher (`launcher.spec.ts`)

**Route**: `/execute`
**Helper**: `launchExecute()`

#### Recommended `data-testid` attributes

| Component | Attribute |
|-----------|-----------|
| Template search input | `data-testid="execute-search"` |
| Repository section | `data-testid="repo-mount-section"` |
| Local Directory tab | `data-testid="repo-tab-local"` |
| GitHub Repo tab | `data-testid="repo-tab-github"` |
| Browse button | `data-testid="repo-browse-btn"` |
| Clone button | `data-testid="repo-clone-btn"` |
| File restrictions editor | `data-testid="file-restrictions"` |
| Start Workflow button | `data-testid="start-workflow-btn"` |
| Repo validation indicator | `data-testid="repo-validation"` |
| Paused hidden badge | `data-testid="paused-hidden-badge"` |

#### Tests

**T01: Execute page shows only active templates (smoke)**
- Pre-create 2 active and 1 paused template
- Navigate to Execute
- Assert: only the 2 active template names are visible
- Assert: paused template name is NOT visible
- Tag: `@smoke`

**T02: "N paused hidden" badge when paused templates exist**
- Pre-create 1 active and 2 paused templates
- Navigate to Execute
- Assert: badge text contains "2 paused hidden" or similar
- Tag: `@regression`

**T03: Search filters templates in Execute page**
- Pre-create active templates: "TDD", "Security"
- Type "tdd" in the search input
- Assert: only "TDD" is visible
- Tag: `@regression`

**T04: Start Workflow button disabled without template selection**
- Navigate to Execute without selecting any template
- Assert: "Start Workflow" or "Start Execution" button is disabled
- Tag: `@regression`

**T05: Start Workflow button disabled without repo mount**
- Select a template
- Do NOT mount any repository
- Assert: the start button remains disabled (repo required)
- Tag: `@regression`

**T06: Repository section visible after template selection**
- Select a template
- Assert: "Repository" section or `data-testid="repo-mount-section"` becomes visible
- Tag: `@regression`

**T07: Local Directory tab has Browse button**
- Select a template
- Click on "Local Directory" tab
- Assert: "Browse" button is visible
- Tag: `@regression`

**T08: Repo validation shows green for valid git repo (main process test)**
- Use `electronApp.evaluate()` to simulate `repo:validate-path` with a path that has `.git/`
- Assert: response `{ valid: true, hasGit: true }`
- Tag: `@regression`

**T09: Repo validation shows warning for non-git directory (main process test)**
- Use `electronApp.evaluate()` to call `repo:validate-path` with a path that exists but has no `.git/`
- Assert: response `{ valid: true, hasGit: false }`
- Tag: `@regression`

**T10: GitHub Repo tab has URL input and Clone button**
- Select a template
- Click "GitHub Repo" tab
- Assert: URL text input is visible
- Assert: "Clone" button is visible and disabled (empty URL)
- Tag: `@regression`

**T11: Clone button enabled after entering URL**
- Click GitHub Repo tab
- Type `https://github.com/example/repo` in URL input
- Assert: Clone button is now enabled
- Tag: `@regression`

**T12: Clone rejects non-HTTPS URLs**
- Use `electronApp.evaluate()` to call `repo:clone` with `ssh://git@github.com/example/repo`
- Assert: response contains error about "Only HTTPS URLs supported"
- Tag: `@regression`

**T13: File restrictions editor shows chip list**
- Mount a repo (via Browse or test fixture)
- Assert: "File Restrictions (optional)" section is visible
- Type `src/**/*.ts` in the pattern input and press Enter
- Assert: a chip with text `src/**/*.ts` appears
- Tag: `@regression`

**T14: Remove file restriction chip**
- Add two restriction patterns
- Click the remove button on the first chip
- Assert: only one chip remains
- Tag: `@regression`

**T15: Start Workflow button enabled with template + repo**
- Select a template and mount a repo (provide a valid local path)
- Assert: "Start Workflow" or "Start Execution" button is enabled
- Tag: `@regression`

**T16: Last used timestamp updated after launch (IPC)**
- Select a template and start execution
- Use `electronApp.evaluate()` to check template `metadata.lastUsedAt`
- Assert: `lastUsedAt` is a recent ISO-8601 timestamp
- Tag: `@regression`

---

### 3.4 F04 -- Multi-Step Execution UX (`multistep.spec.ts`)

**Route**: `/execute/run`
**Helper**: Start execution via Execute page, then wait for `/execute/run` page

#### Recommended `data-testid` attributes

| Component | Attribute |
|-----------|-----------|
| Event log panel | `data-testid="event-log-panel"` |
| Event log entry | `data-testid="event-log-entry"` |
| Step gate panel | `data-testid="step-gate-panel"` |
| Scrutiny level selector | `data-testid="scrutiny-selector"` |
| Continue button | `data-testid="gate-continue-btn"` |
| Revise button | `data-testid="gate-revise-btn"` |
| Revision feedback textarea | `data-testid="revision-feedback"` |
| Revision submit button | `data-testid="revision-submit-btn"` |
| Revision count badge | `data-testid="revision-count"` |
| DiffViewer (stub) | `data-testid="diff-viewer"` |
| Active node indicator | `data-testid="active-node"` |

#### Helper

```typescript
async function launchAndStartExecution(): Promise<{
  electronApp: ElectronApplication;
  page: Page;
}> {
  const { electronApp, page } = await launchExecute();
  // Select TDD Pipeline (mock workflow) and start
  await page.getByText('TDD Pipeline').click();
  await page.getByRole('button', { name: /Start/ }).click();
  // Wait for walkthrough page to appear
  await expect(
    page.getByText('Execution Walkthrough').or(page.getByText('Running')).first()
  ).toBeVisible({ timeout: 10_000 });
  return { electronApp, page };
}
```

#### Tests

**T01: Execution walkthrough page renders after start (smoke)**
- Start execution in mock mode
- Assert: walkthrough page is visible with status badge
- Tag: `@smoke`

**T02: Event log panel is visible**
- Start execution
- Assert: `data-testid="event-log-panel"` is visible
- Tag: `@regression`

**T03: Event log shows entries as execution progresses**
- Start execution in mock mode
- Wait up to 10s for at least one event log entry to appear
- Assert: at least one `data-testid="event-log-entry"` is visible
- Tag: `@regression`

**T04: Event log entries have timestamps**
- Start execution and wait for events
- Assert: first event entry contains a time pattern (e.g., `HH:MM:SS` or `HH:MM`)
- Tag: `@regression`

**T05: Active node is visually highlighted**
- Start execution
- Wait for a node to become active
- Assert: an element matching active node styling (pulse animation class or highlighted border) exists
- Tag: `@regression`

**T06: Completed nodes show green styling**
- Start execution and wait for at least one node to complete
- Assert: a node with completed status styling (green color or checkmark) is visible
- Tag: `@regression`

**T07: Step gate panel appears for gate-mode blocks**
- Pre-configure a workflow with `gateMode: 'gate'` on a node (via main process fixture)
- Start execution and wait for gate status
- Assert: `data-testid="step-gate-panel"` becomes visible
- Assert: Continue button is visible
- Assert: Revise button is visible
- Tag: `@regression`

**T08: Scrutiny level selector defaults to Summary**
- Wait for step gate to open
- Assert: "Summary" segment is selected/active in the scrutiny selector
- Tag: `@regression`

**T09: Switching scrutiny level changes content**
- Wait for step gate to open
- Click "File List" in the scrutiny selector
- Assert: content area changes (e.g., file paths become visible)
- Click "Full Detail" or "Full Content"
- Assert: content area changes again (e.g., markdown content visible)
- Tag: `@regression`

**T10: Continue button advances execution**
- Wait for step gate to open
- Click "Continue"
- Assert: step gate panel closes or status changes from "Waiting for Gate" to "Running"
- Tag: `@regression`

**T11: Revise button opens feedback textarea**
- Wait for step gate to open
- Click "Revise"
- Assert: `data-testid="revision-feedback"` textarea appears
- Tag: `@regression`

**T12: Revision submit disabled with fewer than 10 characters**
- Open the revise textarea
- Type "short"
- Assert: `data-testid="revision-submit-btn"` is disabled
- Tag: `@regression`

**T13: Revision submit with valid feedback re-runs block**
- Open the revise textarea
- Type "Please add more detail to the architecture section"
- Click Submit
- Assert: event log shows re-running entry or status returns to "Running"
- Tag: `@regression`

**T14: Revision count badge increments**
- Submit a revision
- Wait for the block to complete again and gate to re-open
- Assert: revision count badge shows "Revision 1" or similar
- Tag: `@regression`

**T15: DiffViewer stub renders without errors**
- Navigate to execution walkthrough
- Assert: if `data-testid="diff-viewer"` is present, it shows "No changes to display"
- Assert: no console errors
- Tag: `@regression`

---

### 3.5 F05 -- Parallel Execution Engine (`parallel.spec.ts`)

**Route**: `/execute/run` (with parallel workflow) and `/monitoring` (container pool)
**Tags**: Most tests require Docker (`@requires-docker`)

#### Recommended `data-testid` attributes

| Component | Attribute |
|-----------|-----------|
| Container pool panel | `data-testid="container-pool-panel"` |
| Container record row | `data-testid="container-{id}"` |
| Container state badge | `data-testid="container-state-{id}"` |
| Parallel lane visualization | `data-testid="parallel-lane"` |

#### Tests

**T01: Container pool status endpoint responds (IPC, @requires-docker)**
- Use `electronApp.evaluate()` to invoke `container:pool-status` IPC
- Assert: response is an array (may be empty if no containers running)
- Tag: `@requires-docker`

**T02: Pre-warming starts containers for parallel workflow (IPC, @requires-docker)**
- Create a workflow fixture with a 2-block parallel lane
- Start execution
- Use `electronApp.evaluate()` to check pool status
- Assert: at least 2 containers in `starting` or `idle` state
- Tag: `@requires-docker`

**T03: Parallel blocks appear as side-by-side columns**
- Start execution of a workflow with parallel blocks
- Assert: at least two node elements are laid out horizontally (adjacent columns)
- Tag: `@regression` (can use mock mode with parallel visual only)

**T04: Fan-in waits for all parallel blocks (IPC, @requires-docker)**
- Start execution of a 3-block parallel lane
- Use `electronApp.evaluate()` to listen for `execution:lane-complete` event
- Assert: event payload contains results for all 3 blocks
- Tag: `@requires-docker`

**T05: Container transitions to dormant after block completion (@requires-docker)**
- Start execution with one sequential block
- Wait for block completion
- Use `electronApp.evaluate()` to check pool status
- Assert: the container that ran the block is in `dormant` state
- Tag: `@requires-docker`

**T06: Dormant container wake on re-use (@requires-docker)**
- Complete one block (container goes dormant)
- Start another block that needs a container
- Assert: pool wakes the dormant container (state goes from `dormant` to `running`)
- Tag: `@requires-docker`

**T07: Container cleanup on app exit (@requires-docker)**
- Start execution, get container IDs from pool status
- Close the electron app
- Check via `docker ps --filter label=asdlc.managed=true` that no containers remain
- Tag: `@requires-docker`

**T08: Lenient failure mode collects all results (@requires-docker)**
- Create workflow with `failureMode: 'lenient'` and a deliberately failing block
- Start execution
- Wait for lane completion
- Assert: lane-complete event includes both successful and failed results
- Tag: `@requires-docker`

**T09: Strict failure mode aborts remaining blocks (@requires-docker)**
- Create workflow with `failureMode: 'strict'` and a deliberately failing block
- Start execution
- Wait for lane completion
- Assert: remaining blocks show aborted/failed status
- Tag: `@requires-docker`

**T10: Container pool panel in monitoring shows container states (@requires-docker)**
- Start execution (containers will appear)
- Navigate to Monitoring tab
- Assert: `data-testid="container-pool-panel"` shows container entries with state badges
- Tag: `@requires-docker`

---

### 3.6 F06 -- CLI Session Enhancement (`cli-sessions.spec.ts`)

**Route**: `/cli`
**Helper**: `launchCLI()`

#### Recommended `data-testid` attributes

| Component | Attribute |
|-----------|-----------|
| Spawn dialog | `data-testid="spawn-dialog"` |
| Mode toggle (Local/Docker) | `data-testid="spawn-mode-toggle"` |
| Local mode radio | `data-testid="mode-local"` |
| Docker mode radio | `data-testid="mode-docker"` |
| Docker status indicator | `data-testid="docker-status"` |
| Session context section | `data-testid="session-context"` |
| Repo path input | `data-testid="context-repo-path"` |
| GitHub issue input | `data-testid="context-github-issue"` |
| Template dropdown | `data-testid="context-template"` |
| History panel | `data-testid="session-history"` |
| Clear terminal button | `data-testid="clear-terminal-btn"` |
| Preset: Raw Session | `data-testid="preset-raw"` |
| Preset: Issue Focus | `data-testid="preset-issue"` |
| Preset: Template Run | `data-testid="preset-template"` |

#### Tests

**T01: CLI Sessions page renders (smoke)**
- Navigate to `/cli`
- Assert: page heading or session list area is visible
- Assert: a "Spawn" or "New Session" button is visible
- Tag: `@smoke`

**T02: Spawn dialog shows mode toggle**
- Click "Spawn" / "New Session" button
- Assert: `data-testid="spawn-dialog"` is visible
- Assert: Local and Docker mode options are visible
- Tag: `@regression`

**T03: Docker mode disabled when Docker unavailable**
- If Docker is not available (check `isDockerAvailable()`):
  - Open spawn dialog
  - Assert: Docker mode radio/toggle is disabled
  - Assert: a tooltip or message explains "Docker not available"
- Tag: `@regression`

**T04: Docker status indicator shows availability**
- Open spawn dialog
- Assert: `data-testid="docker-status"` is visible
- If Docker available: green indicator
- If Docker unavailable: red indicator
- Tag: `@regression`

**T05: Local mode spawn starts a session**
- Open spawn dialog
- Ensure Local mode is selected
- Click Spawn
- Assert: a new session appears in the session list with "running" status
- Assert: terminal output area shows some content (prompt or initial output)
- Tag: `@regression`

**T06: Docker mode spawn starts a container session (@requires-docker)**
- Open spawn dialog
- Select Docker mode
- Provide a repo path (optional)
- Click Spawn
- Assert: a new session appears with "running" status
- Assert: terminal output appears from the Docker container
- Tag: `@requires-docker`

**T07: Session context fields are optional**
- Open spawn dialog
- Leave all context fields empty
- Click Spawn
- Assert: session starts successfully (no error from missing context)
- Tag: `@regression`

**T08: Quick-start presets pre-fill the form**
- Open spawn dialog
- Click "Raw Session" preset
- Assert: mode is "Local", command contains "claude", context fields are empty
- Tag: `@regression`

**T09: Issue Focus preset selects Docker mode**
- Open spawn dialog
- Click "Issue Focus" preset
- Assert: mode is "Docker"
- Assert: repo and issue fields are highlighted/focused
- Tag: `@regression`

**T10: Kill session stops the process**
- Start a local session
- Click "Kill" on the running session
- Assert: session status changes to "exited"
- Assert: an exit code is displayed
- Tag: `@regression`

**T11: Clear terminal resets output**
- Start a session and wait for some output
- Click `data-testid="clear-terminal-btn"` or press Cmd+K
- Assert: terminal content is cleared (no visible output)
- Assert: session is still running (not killed)
- Tag: `@regression`

**T12: Session history shows past sessions**
- Start and kill a session
- Expand the history panel
- Assert: at least one history entry is visible with mode, timing, and exit code
- Tag: `@regression`

**T13: Re-run from history pre-fills spawn dialog**
- Have at least one history entry
- Click "Re-run" on a history entry
- Assert: spawn dialog opens pre-filled with the same config
- Tag: `@regression`

**T14: Clear history removes all entries**
- Have at least one history entry
- Click "Clear History"
- Assert: history panel shows empty state
- Tag: `@regression`

---

### 3.7 F07 -- Monitoring Dashboard (`monitoring.spec.ts`)

**Route**: `/monitoring`
**Helper**: `launchMonitoring()`

#### Recommended `data-testid` attributes

| Component | Attribute |
|-----------|-----------|
| Summary card: Total Events | `data-testid="stat-total-events"` |
| Summary card: Active Agents | `data-testid="stat-active-agents"` |
| Summary card: Error Rate | `data-testid="stat-error-rate"` |
| Summary card: Total Cost | `data-testid="stat-total-cost"` |
| Agent selector dropdown | `data-testid="agent-selector"` |
| Event stream table | `data-testid="event-stream"` |
| Session list | `data-testid="session-list"` |
| Workflow view | `data-testid="workflow-view"` |
| Receiver status banner | `data-testid="receiver-status"` |

#### Tests

**T01: Monitoring page renders (smoke)**
- Navigate to `/monitoring`
- Assert: page heading or monitoring layout is visible
- Assert: summary cards area is visible
- Tag: `@smoke`

**T02: Four summary cards are displayed**
- Navigate to Monitoring
- Assert: `data-testid="stat-total-events"` is visible
- Assert: `data-testid="stat-active-agents"` is visible
- Assert: `data-testid="stat-error-rate"` is visible
- Assert: `data-testid="stat-total-cost"` is visible
- Tag: `@regression`

**T03: Summary cards show zero state initially**
- Navigate to Monitoring with no running executions
- Assert: Total Events shows "0"
- Assert: Active Agents shows "0"
- Assert: Error Rate shows "0%" or "0"
- Tag: `@regression`

**T04: Event stream table is visible**
- Navigate to Monitoring
- Assert: `data-testid="event-stream"` is visible
- Tag: `@regression`

**T05: Event stream shows empty state when no events**
- Navigate to Monitoring with no prior executions
- Assert: event stream shows "No events" or similar empty state
- Tag: `@regression`

**T06: Agent selector dropdown is present**
- Navigate to Monitoring
- Assert: `data-testid="agent-selector"` is visible
- Assert: default selection is "All agents" or similar
- Tag: `@regression`

**T07: Session list shows active and recent sessions**
- Navigate to Monitoring
- Assert: `data-testid="session-list"` is visible
- Tag: `@regression`

**T08: Telemetry receiver status (IPC main process test)**
- Use `electronApp.evaluate()` to check if the telemetry receiver is bound
- Assert: receiver is running on port 9292 (or configured port)
- Tag: `@regression`

**T09: Receiver unavailable banner shown when port in use**
- This test requires pre-occupying port 9292 (or skip if not feasible)
- Navigate to Monitoring
- Assert: a banner or notice about receiver unavailability appears
- Tag: `@regression` (skip if port cannot be pre-bound)

**T10: Events update cards in real time (integration with execution)**
- Start a mock-mode execution
- Navigate to Monitoring
- Wait for event count to increase from 0
- Assert: `data-testid="stat-total-events"` shows a number greater than 0
- Tag: `@regression`

**T11: Selecting an agent filters the event stream**
- Start execution to generate events
- Select a specific agent from the dropdown
- Assert: event stream entries are filtered (all show the selected agent)
- Tag: `@regression`

**T12: Monitoring page renders without console errors**
- Collect console errors during Monitoring page load
- Assert: no `console.error` messages
- Tag: `@smoke`

---

### 3.8 F08 -- Settings Redesign (`settings-redesign.spec.ts`)

**Route**: `/settings`
**Helper**: `launchSettings()`

#### Recommended `data-testid` attributes

| Component | Attribute |
|-----------|-----------|
| AI Providers tab | `data-testid="tab-providers"` |
| Environment tab | `data-testid="tab-environment"` |
| About tab | `data-testid="tab-about"` |
| Anthropic provider card | `data-testid="provider-anthropic"` |
| OpenAI provider card | `data-testid="provider-openai"` |
| Google provider card | `data-testid="provider-google"` |
| Azure provider card | `data-testid="provider-azure"` |
| API key input | `data-testid="api-key-input-{provider}"` |
| Save key button | `data-testid="save-key-btn-{provider}"` |
| Clear key button | `data-testid="clear-key-btn-{provider}"` |
| Key saved badge | `data-testid="key-saved-{provider}"` |
| Test connection button | `data-testid="test-connection-{provider}"` |
| Model dropdown | `data-testid="model-select-{provider}"` |
| Temperature slider | `data-testid="temp-slider-{provider}"` |
| Max tokens input | `data-testid="max-tokens-{provider}"` |
| Context window badge | `data-testid="context-window-{provider}"` |
| Docker socket input | `data-testid="docker-socket-path"` |
| Agent timeout input | `data-testid="agent-timeout"` |
| App version display | `data-testid="app-version"` |
| Electron version display | `data-testid="electron-version"` |
| Node version display | `data-testid="node-version"` |
| Encryption warning | `data-testid="encryption-warning"` |

#### Tests

**T01: Settings page renders with tabbed layout (smoke)**
- Navigate to `/settings`
- Assert: at least 3 tabs are visible: "AI Providers", "Environment", "About"
- Tag: `@smoke`

**T02: AI Providers tab shows 4 provider cards**
- Click "AI Providers" tab (or it is the default)
- Assert: cards for Anthropic, OpenAI, Google, Azure OpenAI are all visible
- Tag: `@regression`

**T03: Each provider card has API key input**
- On the AI Providers tab
- Assert: each provider card has a masked API key input field
- Assert: each card has a "Save Key" action
- Tag: `@regression`

**T04: Save API key shows "Key saved" badge**
- Enter a test key in the Anthropic API key field (e.g., "sk-test-1234567890")
- Click "Save Key"
- Assert: "Key saved" badge or checkmark appears
- Tag: `@regression`

**T05: API key is never displayed after save (security)**
- Save an API key for Anthropic
- Reload settings page (navigate away and back)
- Assert: the key input shows masked placeholder (e.g., dots) not the actual key value
- Tag: `@regression`

**T06: Clear API key removes it**
- Save an API key, then click "Clear" on that provider
- Assert: "Key saved" badge disappears
- Use `electronApp.evaluate()` to call `settings:get-key-status` for that provider
- Assert: `{ hasKey: false }`
- Tag: `@regression`

**T07: Test Connection button disabled without saved key**
- On a provider with no saved key
- Assert: "Test Connection" button is disabled
- Tag: `@regression`

**T08: Default model selection persists**
- Select "claude-opus-4-6" from the Anthropic model dropdown
- Save settings
- Navigate away and back to settings
- Assert: Anthropic model dropdown still shows "claude-opus-4-6"
- Tag: `@regression`

**T09: Context window badge updates with model selection**
- Select "claude-opus-4-6" from Anthropic model dropdown
- Assert: context window badge shows "200,000" or "200K"
- Tag: `@regression`

**T10: Temperature slider within valid range**
- Adjust the Anthropic temperature slider to 0.2
- Assert: the numeric display shows "0.2"
- Try to set temperature to a value beyond 1.0
- Assert: value is clamped to 1.0
- Tag: `@regression`

**T11: Max tokens input accepts valid values**
- Type "8192" in the Anthropic max tokens input
- Assert: the value is accepted
- Type "0" or a negative number
- Assert: value is rejected or clamped
- Tag: `@regression`

**T12: Azure provider has endpoint URL and deployment name fields**
- Locate the Azure OpenAI provider card
- Assert: "Endpoint URL" input field is visible
- Assert: "Deployment Name" input field is visible (not a model dropdown)
- Tag: `@regression`

**T13: Azure Test Connection disabled without endpoint**
- Ensure Azure has an API key saved but no endpoint URL
- Assert: "Test Connection" button for Azure is disabled
- Tag: `@regression`

**T14: Environment tab shows Docker and workspace fields**
- Click "Environment" tab
- Assert: "Docker Socket Path" field is visible with default `/var/run/docker.sock`
- Assert: "Agent Timeout" field is visible
- Tag: `@regression`

**T15: Agent Timeout persists after save**
- Set Agent Timeout to "600"
- Save settings
- Navigate away and back
- Assert: Agent Timeout field shows "600"
- Tag: `@regression`

**T16: About tab shows version information**
- Click "About" tab
- Assert: `data-testid="app-version"` shows a version string (not empty)
- Assert: `data-testid="electron-version"` shows a version string
- Assert: `data-testid="node-version"` shows a version string
- Tag: `@regression`

**T17: About tab version info from IPC**
- Use `electronApp.evaluate()` to invoke `settings:get-version` IPC
- Assert: response contains `appVersion`, `electronVersion`, `nodeVersion` strings
- Assert: none are empty
- Tag: `@regression`

**T18: API key encrypted at rest (main process test)**
- Save an API key for Anthropic
- Use `electronApp.evaluate()` to read the raw `api-keys.json` file
- Assert: the file does NOT contain the plaintext key
- Assert: the file contains a base64-encoded encrypted value
- Tag: `@regression`

**T19: safeStorage warning banner when encryption unavailable**
- This test checks the warning path. On systems where safeStorage IS available, verify the
  warning is NOT shown. Use `electronApp.evaluate()` to check `safeStorage.isEncryptionAvailable()`
- If available: Assert no `data-testid="encryption-warning"` is visible
- If unavailable: Assert warning banner is visible
- Tag: `@regression`

---

## 4. Cross-Feature Integration Tests (`integration.spec.ts`)

These tests validate end-to-end flows that span multiple features.

### T01: Design in Studio, Save as Template, Execute (F01 + F02 + F03)

**Steps:**
1. Navigate to Studio, add a Plan block, set a rule, save as template "Integration Test"
2. Navigate to Templates, verify "Integration Test" appears
3. Navigate to Execute, verify "Integration Test" appears in the picker
4. Select the template, mount a repo (mock or local path)
5. Start execution
6. Assert: execution walkthrough page appears with the Plan node

**Tag:** `@regression`

### T02: Template Pause hides from Execute (F02 + F03)

**Steps:**
1. Pre-create an active template "Pausable Workflow"
2. Navigate to Templates, toggle its status to Paused
3. Navigate to Execute
4. Assert: "Pausable Workflow" does NOT appear in the picker

**Tag:** `@regression`

### T03: Settings affect execution behavior (F08 + F03)

**Steps:**
1. Navigate to Settings, set a custom agent timeout or default repo path
2. Navigate to Execute, select a template
3. Assert: the repo path field pre-fills with the configured default (if F03 wires this)

**Tag:** `@regression`

### T04: Monitoring shows events during execution (F04 + F07)

**Steps:**
1. Start a mock-mode execution
2. While execution is running, navigate to Monitoring
3. Assert: at least one event appears in the event stream
4. Assert: summary card "Total Events" is > 0
5. Return to execution walkthrough
6. Assert: execution is still in progress or completed (not disrupted by navigation)

**Tag:** `@regression`

### T05: CLI session Docker mode with repo mount (F06 + F03)

**Steps:**
1. Navigate to Settings, configure Docker socket path
2. Navigate to CLI Sessions, open Spawn dialog
3. Select Docker mode, provide a repo path
4. Spawn session
5. Assert: session is running
6. Kill session
7. Assert: session history shows the Docker-mode entry

**Tag:** `@requires-docker`

### T06: Full pipeline: Studio Design to Monitor (F01 + F02 + F03 + F04 + F07)

**Steps:**
1. Studio: create a 2-block workflow with a Plan and a gated Plan block
2. Save as template "Full Pipeline Test"
3. Execute: select "Full Pipeline Test", mock repo, start
4. Wait for first block to complete
5. Step gate fires: review deliverables, click Continue
6. Wait for second block to complete
7. Navigate to Monitoring: verify events from both blocks appear

**Tag:** `@regression`

---

## 5. Mock Strategy

### 5.1 When to Mock Docker

**Most tests should NOT require Docker.** The Workflow Studio's `executionMockMode` setting
(default: `true`) uses in-process mock execution that simulates block progression, events, and
gate triggers without spawning any containers. This covers:

- All F01 (Studio) tests -- no execution involved
- All F02 (Templates) tests -- CRUD only
- F03 tests T01--T15 -- launcher UI (Docker clone can be tested via IPC mocks)
- All F04 (Multi-Step UX) tests -- mock mode execution
- F06 tests T01--T02, T05, T07--T14 -- local mode and UI tests
- All F07 (Monitoring) tests using mock mode events
- All F08 (Settings) tests -- no execution involved
- All integration tests except T05

### 5.2 Tests Requiring Real Docker (`@requires-docker`)

These tests validate container lifecycle management and must have Docker running:

- F05 ALL (parallel execution engine) -- T01 through T10
- F06 T06 (Docker-mode spawn)
- Integration T05 (CLI + Docker)

### 5.3 Injecting Test Fixtures via Main Process

Use `electronApp.evaluate()` to set up test state without going through the UI:

```typescript
// Example: Create a workflow template for testing
await electronApp.evaluate(async () => {
  const { ipcMain } = require('electron');
  // Trigger template:save programmatically
  // Note: actual implementation depends on how handlers are registered
});
```

For more complex fixtures, use the IPC channels directly through the preload API:

```typescript
// From the renderer page context
await page.evaluate(async () => {
  await window.electronAPI.template.save({
    id: 'test-template-001',
    metadata: { name: 'Test Template', tags: ['test'], status: 'active', ... },
    nodes: [...],
    transitions: [],
    gates: [],
    variables: [],
  });
});
```

### 5.4 Environment Variables for Test Mode

Set in the Playwright launch configuration:

```typescript
electronApp = await electron.launch({
  args: [APP_MAIN],
  env: {
    ...process.env,
    NODE_ENV: 'test',
    EXECUTION_MOCK_MODE: 'true',
    // Disable telemetry receiver to avoid port conflicts in parallel test runs
    TELEMETRY_RECEIVER_DISABLED: 'true',
  },
});
```

---

## 6. CI Pipeline Recommendations

### 6.1 PR Checks (Every Pull Request)

**Job: `e2e-smoke`**
- Duration target: < 3 minutes
- Build step: `npm run build`
- Test command: `npx playwright test --grep @smoke`
- Tests: ~12 smoke tests (one per feature + app launch)
- No Docker required
- No external dependencies

**Job: `e2e-core`**
- Duration target: < 10 minutes
- Build step: `npm run build`
- Test command: `npx playwright test --grep @regression --grep-invert "@requires-docker|@requires-claude|@requires-cursor"`
- Tests: ~85 regression tests (excluding Docker/Claude/Cursor)
- No Docker required

### 6.2 Nightly (Full Suite)

**Job: `e2e-full`**
- Duration target: < 30 minutes
- Build step: `npm run build`
- Test command: `npx playwright test`
- All tests including `@requires-docker`
- Docker daemon available in CI runner
- Retry: 2 (for Docker flakiness)

### 6.3 Manual (Cursor Agent Tests)

- Triggered manually when cursor agent changes are made
- Requires `docker compose up cursor-agent` before test run

### 6.4 Build Step

All E2E tests require the Electron app to be built first:

```yaml
- name: Build Electron app
  working-directory: apps/workflow-studio
  run: npm run build

- name: Run E2E tests
  working-directory: apps/workflow-studio
  run: npx playwright test
```

### 6.5 Artifact Retention

```yaml
- name: Upload test artifacts
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-results
    path: |
      apps/workflow-studio/test-results/
    retention-days: 7
```

Playwright is configured to capture screenshots on failure and video on failure
(already set in `playwright.config.ts`).

---

## 7. Playwright Config Updates

### 7.1 Updated `playwright.config.ts`

```typescript
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
      timeout: 120_000,  // 2 minutes for Docker operations
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
```

### 7.2 Project-Based Test Grouping

| Project | Command | Use Case |
|---------|---------|----------|
| `smoke` | `npx playwright test --project=smoke` | Quick validation (<1 min) |
| `regression` | `npx playwright test --project=regression` | PR checks (~10 min) |
| `docker` | `npx playwright test --project=docker` | Docker-dependent tests |
| `full` | `npx playwright test --project=full` | Complete nightly suite |

### 7.3 Tag Convention

Tags are applied via test title suffixes for Playwright grep:

```typescript
test('Studio page renders @smoke', async () => { ... });
test('Container pool pre-warms for parallel workflow @requires-docker', async () => { ... });
```

---

## 8. Test Count Summary

| Feature | Spec File | Smoke | Regression | Docker | Total |
|---------|-----------|-------|------------|--------|-------|
| F01 Studio Block Composer | `studio.spec.ts` | 2 | 13 | 0 | 15 |
| F02 Template Repository | `templates.spec.ts` | 1 | 13 | 0 | 14 |
| F03 Execute Launcher | `launcher.spec.ts` | 1 | 15 | 0 | 16 |
| F04 Multi-Step Execution UX | `multistep.spec.ts` | 1 | 14 | 0 | 15 |
| F05 Parallel Execution Engine | `parallel.spec.ts` | 0 | 1 | 9 | 10 |
| F06 CLI Session Enhancement | `cli-sessions.spec.ts` | 1 | 12 | 1 | 14 |
| F07 Monitoring Dashboard | `monitoring.spec.ts` | 2 | 10 | 0 | 12 |
| F08 Settings Redesign | `settings-redesign.spec.ts` | 1 | 18 | 0 | 19 |
| Cross-Feature Integration | `integration.spec.ts` | 0 | 5 | 1 | 6 |
| **Totals** | **9 spec files** | **9** | **101** | **11** | **121** |

**PR-safe tests (no Docker)**: 110
**Docker-required tests**: 11

---

## 9. Appendix: Existing Test Migration Notes

### 9.1 `settings.spec.ts` (Existing)

The existing settings spec tests the legacy flat settings page (Redis URL, Cursor Agent URL,
mock mode checkbox). After F08 is implemented, these tests will break because the UI changes
completely. The migration plan:

1. **Before F08 implementation**: Existing tests continue to pass
2. **During F08**: Create `settings-redesign.spec.ts` alongside the old spec
3. **After F08 completion**: Delete or archive `settings.spec.ts`, rename `settings-redesign.spec.ts` to `settings.spec.ts`

### 9.2 `execution.spec.ts` (Existing)

The existing execution spec tests the mock-mode flow with the current Execute page layout
(workflow list, Start Execution button). After F03 and F04 are implemented, some selectors
may change:

- "Start Execution" button may become "Start Workflow"
- Template picker replaces workflow list
- Repo mount section is new

**Recommended approach**: Update existing tests in-place as features land, rather than maintaining
parallel specs. The existing test structure is compatible with the progressive-disclosure design
of F03.

### 9.3 `app.spec.ts` (Existing)

The existing app smoke spec checks all navigation links. It needs updating to include
the new sidebar links:

- Add assertion for "Studio" nav link
- Add assertion for "Monitoring" nav link
- These links already exist in `App.tsx` but the spec only checks the original 5

```typescript
// Add to app.spec.ts
test('all nav links are present in sidebar', async () => {
  await expect(page.getByRole('link', { name: 'Designer' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Templates' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Studio' })).toBeVisible();       // NEW
  await expect(page.getByRole('link', { name: 'Execute' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'CLI Sessions' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Monitoring' })).toBeVisible();    // NEW
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
});
```
