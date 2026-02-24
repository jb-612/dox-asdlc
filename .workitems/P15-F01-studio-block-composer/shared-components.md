# Shared Component Library — P15 Cross-Cutting Design

**Status:** Draft
**Date:** 2026-02-22
**Author:** Planner
**Addresses:** Decision 6 (Architect Synthesis), MT-16
**Features:** F01, F02, F04, F07, F08

---

## Overview

Both the frontend and backend design reviews identified shared UI patterns that are
duplicated across multiple P15 features. Building these as a shared component library
before feature work prevents inconsistent implementations and reduces total effort.

All shared components live in:
```
apps/workflow-studio/src/renderer/components/shared/
```

---

## Component Inventory

### 1. StatusBadge

A colored badge that displays a status string with consistent visual treatment across
the application.

**Used by:**
- F02 `TemplateManagerPage` — workflow status (`active` / `paused`)
- F04 `StepGatePanel` — block execution status (`running` / `completed` / `failed`)
- F07 `SessionList` — agent session status (`running` / `completed` / `failed`)
- F07 `SummaryCards` — error rate indicators

**File:** `components/shared/StatusBadge.tsx`

**Props:**
```typescript
interface StatusBadgeProps {
  /** The status text to display */
  status: string;
  /** Visual variant controlling the color scheme */
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  /** Badge size */
  size?: 'sm' | 'md';
}
```

**Variant mapping (recommended defaults):**

| Status | Variant |
|--------|---------|
| `active`, `running`, `completed` | `success` |
| `paused`, `waiting_gate`, `partial` | `warning` |
| `failed`, `error`, `aborted` | `error` |
| `pending`, `idle`, `dormant` | `neutral` |
| `starting`, `info` | `info` |

Components can override the variant explicitly, but should use a shared
`statusToVariant(status: string): StatusBadgeProps['variant']` utility to ensure
consistent colors across pages.

**Visual:**
```
[sm] Compact pill: "active" in green text with light green background
[md] Standard pill: same with slightly larger font and padding
```

---

### 2. VirtualizedEventLog

A scrollable, virtualized event list for displaying high-volume telemetry or execution
events. Uses windowing to handle thousands of events without DOM bloat.

**Used by:**
- F04 `EventLogPanel` — execution events during multi-step workflow
- F07 `EventStream` — real-time telemetry events from monitoring dashboard

**File:** `components/shared/VirtualizedEventLog.tsx`

**Props:**
```typescript
interface FormattedEvent {
  /** Icon: emoji or icon name */
  icon: string;
  /** Primary label, e.g., "Tool Call: Write" */
  label: string;
  /** Detail text, e.g., "src/workers/pool.ts" */
  detail: string;
  /** Formatted timestamp string */
  timestamp: string;
  /** Severity for row coloring */
  severity: 'info' | 'warning' | 'error';
}

interface VirtualizedEventLogProps<T> {
  /** Array of events to display */
  events: T[];
  /** Maximum height in pixels (default: 400) */
  maxHeight?: number;
  /** Auto-scroll to bottom on new events (default: true) */
  autoScroll?: boolean;
  /** Click handler for individual events */
  onEventClick?: (event: T) => void;
  /** Formatter that converts domain events to display format */
  formatter: (event: T) => FormattedEvent;
}
```

**Implementation notes:**
- Use a simple virtual scroll based on fixed row height (36px per event row)
- Render only visible rows + buffer (e.g., 10 rows above/below viewport)
- `autoScroll` keeps the list pinned to bottom when new events arrive; user scrolling
  up disables auto-scroll until they scroll back to bottom
- Generic type `T` allows reuse with both `ExecutionEvent` (F04) and `TelemetryEvent` (F07)

**Visual:**
```
+----------------------------------------------------------------------+
| 10:01:32  [icon] Tool Call: Write     src/workers/pool.ts       info |
| 10:01:33  [icon] Bash Command         npm test                  info |
| 10:01:35  [icon] Tool Call: Edit      src/core/utils.ts      warning |
| 10:01:40  [icon] Agent Error          Timeout after 30s        error |
+----------------------------------------------------------------------+
```

---

### 3. CardLayout

A standard card container with title, optional subtitle, action buttons, and badge slot.
Provides consistent visual treatment for list items across the app.

**Used by:**
- F02 `TemplateCard` — workflow template listing
- F07 `SummaryCards` — monitoring metric cards
- F08 `ProviderCard` — AI provider configuration cards

**File:** `components/shared/CardLayout.tsx`

**Props:**
```typescript
interface CardLayoutProps {
  /** Card title text */
  title: string;
  /** Optional subtitle / description */
  subtitle?: string;
  /** Action buttons rendered in the top-right corner */
  actions?: React.ReactNode;
  /** Badge rendered next to the title (e.g., StatusBadge) */
  badge?: React.ReactNode;
  /** Card body content */
  children: React.ReactNode;
}
```

**Visual:**
```
+----------------------------------------------------------------------+
| [badge] Title                                         [action] [action] |
| Subtitle text here                                                    |
|----------------------------------------------------------------------|
| Children content area                                                |
|                                                                      |
+----------------------------------------------------------------------+
```

**Implementation notes:**
- Use flexbox for title row (badge + title on left, actions on right)
- Consistent padding (16px), border radius (8px), subtle border or shadow
- No fixed width — fills parent container
- `children` can be anything: text, lists, forms, charts

---

### 4. ConfirmDialog

A modal confirmation dialog for destructive or significant actions. Supports danger
and warning variants.

**Used by:**
- F02 — delete template confirmation
- F04 — revise block confirmation ("Are you sure you want to revise this block?")

**File:** `components/shared/ConfirmDialog.tsx`

**Props:**
```typescript
interface ConfirmDialogProps {
  /** Whether the dialog is visible */
  open: boolean;
  /** Dialog title */
  title: string;
  /** Descriptive message explaining the action */
  message: string;
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Visual variant for the confirm button */
  variant?: 'danger' | 'warning';
  /** Called when user confirms the action */
  onConfirm: () => void;
  /** Called when user cancels or closes the dialog */
  onCancel: () => void;
}
```

**Visual:**
```
+----------------------------------------+
|  Delete Template                       |
|                                        |
|  Are you sure you want to delete       |
|  "My Workflow Template"? This action   |
|  cannot be undone.                     |
|                                        |
|           [Cancel]  [Delete] (red)     |
+----------------------------------------+
```

**Implementation notes:**
- Render as a modal overlay with backdrop
- `danger` variant: red confirm button
- `warning` variant: orange/yellow confirm button
- Escape key and backdrop click call `onCancel`
- Focus trap within the dialog when open

---

### 5. TagInput

A tag/chip input component for managing lists of string values. Supports add, remove,
and optional max tag limit.

**Used by:**
- F01 `WorkflowRulesBar` — workflow-level rules
- F02 `TemplateManagerPage` — template tags
- F03 `FileRestrictionsEditor` — file restriction glob patterns

**File:** `components/shared/TagInput.tsx`

**Props:**
```typescript
interface TagInputProps {
  /** Current list of tags */
  tags: string[];
  /** Called when tags change (add or remove) */
  onChange: (tags: string[]) => void;
  /** Placeholder text for the input field */
  placeholder?: string;
  /** Maximum number of tags allowed (undefined = unlimited) */
  maxTags?: number;
}
```

**Visual:**
```
+----------------------------------------------------------------------+
| [src/workers/**] [x]  [src/core/**] [x]  [Add pattern...         ]  |
+----------------------------------------------------------------------+
```

**Implementation notes:**
- Tags rendered as chips/pills with an `x` remove button
- Input field inline after the last chip
- Enter key or comma adds the current input as a new tag
- Duplicate tags are silently ignored
- When `maxTags` is reached, the input field is disabled with a tooltip
- Empty strings are ignored

---

## Shared Utility: `eventFormatter`

A utility function that converts telemetry and execution events into the `FormattedEvent`
interface consumed by `VirtualizedEventLog`.

**File:** `components/shared/eventFormatter.ts`

```typescript
import type { ExecutionEvent } from '../../../shared/types/execution';
import type { TelemetryEvent } from '../../../shared/types/monitoring';

export interface FormattedEvent {
  /** Icon: emoji or icon name */
  icon: string;
  /** Primary label, e.g., "Tool Call: Write" */
  label: string;
  /** Detail text, e.g., "src/workers/pool.ts" */
  detail: string;
  /** Formatted timestamp string */
  timestamp: string;
  /** Severity for row coloring */
  severity: 'info' | 'warning' | 'error';
}

/**
 * Format an ExecutionEvent (from F04 execution pipeline) for display.
 */
export function formatExecutionEvent(event: ExecutionEvent): FormattedEvent;

/**
 * Format a TelemetryEvent (from F07 monitoring pipeline) for display.
 */
export function formatTelemetryEvent(event: TelemetryEvent): FormattedEvent;
```

### Event Type to Display Mapping

**ExecutionEvent mapping:**

| EventType | Icon | Label | Detail Source |
|-----------|------|-------|--------------|
| `execution_started` | `>` | "Execution Started" | workflow name |
| `node_started` | `>` | "Block Started" | node label |
| `node_completed` | `v` | "Block Completed" | node label |
| `node_failed` | `x` | "Block Failed" | error message |
| `tool_call` | `T` | "Tool Call: {toolName}" | file path or args |
| `bash_command` | `$` | "Bash: {command}" | truncated command |
| `gate_waiting` | `?` | "Gate Waiting" | gate prompt |
| `gate_decided` | `!` | "Gate Decided" | decision |
| `block_revision` | `R` | "Block Revision" | revision count |
| `cli_output` | `.` | "CLI Output" | truncated output |
| `cli_error` | `x` | "CLI Error" | error message |

**TelemetryEvent mapping:**

| EventType | Icon | Label | Detail Source |
|-----------|------|-------|--------------|
| `tool_call` | `T` | "Tool: {toolName}" | file path from data |
| `bash_command` | `$` | "Bash: {command}" | truncated command from data |
| `lifecycle` | `L` | "Lifecycle: {stage}" | agent ID |
| `token_usage` | `#` | "Tokens: {input}+{output}" | cost estimate |
| `agent_start` | `>` | "Agent Started" | agent ID |
| `agent_complete` | `v` | "Agent Complete" | agent ID |
| `agent_error` | `x` | "Agent Error" | error from data |

### Severity Mapping

| Condition | Severity |
|-----------|----------|
| Event type contains `error` or `failed` | `error` |
| Event type contains `warning` or `revision` | `warning` |
| All others | `info` |

---

## Shared Utility: `statusToVariant`

**File:** `components/shared/statusUtils.ts`

```typescript
import type { StatusBadgeProps } from './StatusBadge';

/**
 * Maps a status string to a consistent StatusBadge variant.
 * Used across F02, F04, F07 for uniform status colors.
 */
export function statusToVariant(status: string): StatusBadgeProps['variant'] {
  switch (status) {
    case 'active':
    case 'running':
    case 'completed':
    case 'success':
      return 'success';
    case 'paused':
    case 'waiting_gate':
    case 'partial':
    case 'dormant':
      return 'warning';
    case 'failed':
    case 'error':
    case 'aborted':
    case 'terminated':
      return 'error';
    case 'starting':
    case 'idle':
      return 'info';
    default:
      return 'neutral';
  }
}
```

---

## File Structure

```
apps/workflow-studio/src/renderer/components/shared/
├── index.ts                    # Barrel export for all shared components
├── StatusBadge.tsx             # Status badge component
├── VirtualizedEventLog.tsx     # Windowed event list
├── CardLayout.tsx              # Standard card container
├── ConfirmDialog.tsx           # Confirmation modal
├── TagInput.tsx                # Tag/chip input
├── eventFormatter.ts           # ExecutionEvent + TelemetryEvent formatters
└── statusUtils.ts              # statusToVariant utility
```

---

## Dependencies

- No external dependencies required for these components
- `VirtualizedEventLog` uses a custom virtual scroll (no library needed for fixed-height rows)
- All components use standard React patterns (controlled components, composition)

---

## Build Order

These components should be built in Phase 0, before any feature implementation:

| Order | Component | Effort | Reason |
|-------|-----------|--------|--------|
| 1 | `StatusBadge` + `statusUtils` | 30min | Simplest; used by most features |
| 2 | `CardLayout` | 30min | Simple container; used by F02, F07, F08 |
| 3 | `TagInput` | 45min | Used by F01, F02, F03 |
| 4 | `ConfirmDialog` | 30min | Used by F02, F04 |
| 5 | `VirtualizedEventLog` + `eventFormatter` | 1.5hr | Most complex; virtual scroll logic |
| **Total** | | **~3hr** | |
