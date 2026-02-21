# P14-F06: Templates, Polish & Packaging

**Version:** 1.0
**Date:** 2026-02-21
**Status:** NOT_STARTED

## Overview

Final deliverables for the Electron Workflow Studio: create 4 built-in workflow templates as validated JSON files, implement UI store with global keyboard shortcuts, perform integration testing and bug fixes across all features, and configure Electron build/packaging for distribution.

## Architecture

```
templates/
  11-step-default.json         -- Full 11-step aSDLC workflow with HITL gates
  quick-fix.json               -- 4-node minimal workflow
  design-review.json           -- Iterative design loop with feedback
  tdd-cycle.json               -- Test-code-refactor cycle

src/renderer/stores/
  uiStore.ts                   -- Sidebar state, active panel, dialog visibility

electron-builder.yml           -- Build configuration for host platform
resources/
  icon.png, icon.icns, icon.ico -- App icons
```

## Key Interfaces

### Built-in Templates
Each template is a valid WorkflowDefinition JSON that passes Zod schema validation. Templates include reasonable node positions for visual clarity and all required metadata (id, version, name, description, tags).

### UI Store
Manages: sidebar collapsed state, active panel, selected tab, dialog visibility. Global keyboard shortcuts: Ctrl+S (save), Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+O (open), Ctrl+N (new), Delete (remove selected), Escape (deselect).

### Electron Packaging
electron-builder config for host platform (macOS initially). App icons. Build scripts in package.json. node-pty native module rebuilt for Electron version.

## Dependencies

- **P14-F01** (Zod schemas for template validation)
- **P14-F02** (AppShell for keyboard shortcut integration)
- **P14-F03** (designer canvas, save/load, validation)
- **P14-F04** (execution walkthrough, template manager page, work item picker)
- **P14-F05** (CLI spawner, settings page)

## Status

**NOT_STARTED** -- 0/4 tasks complete. This is the only remaining P14 feature.
