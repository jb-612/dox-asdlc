# P14-F02: Electron Shell & IPC Bridge

**Version:** 1.0
**Date:** 2026-02-21
**Status:** COMPLETE

## Overview

Minimal working Electron application with Vite build (3 targets: main, preload, renderer), frameless window management, typed IPC bridge via contextBridge, stub IPC handlers returning mock data, React + Tailwind + Router setup, and the AppShell layout with TitleBar, Sidebar, and common components.

## Architecture

```
Electron Main Process (Node.js)
  +-- src/main/index.ts           -- App entry, BrowserWindow, lifecycle
  +-- src/main/ipc/index.ts       -- Register all IPC handlers
  +-- src/main/ipc/*-handlers.ts  -- Stub handlers returning mock data

Preload Script
  +-- src/preload/preload.ts      -- contextBridge exposing window.electronAPI

Renderer Process (Chromium)
  +-- src/renderer/main.tsx       -- React entry
  +-- src/renderer/App.tsx        -- Router with 5 routes
  +-- src/renderer/components/layout/
  |     AppShell.tsx, TitleBar.tsx, Sidebar.tsx
  +-- src/renderer/components/common/
        Badge, Button, Card, EmptyState, Spinner, SplitPane, SearchInput
```

### Security Model
- contextIsolation: true
- nodeIntegration: false
- All main process access through validated IPC invoke/handle pattern
- No @electron/remote module used

### Build Configuration
- `vite.config.main.ts` -- Main process (Node.js target)
- `vite.config.renderer.ts` -- Renderer (browser target, React + Tailwind)
- `vite.config.preload.ts` -- Preload (sandboxed Node.js target)

## Key Interfaces

### window.electronAPI
Typed bridge exposed via contextBridge with namespaced methods: workflow.save/load/list/delete, workItems.list/get, cli.spawn/kill/list/write/onData/onExit, execution.start/pause/resume/abort/onEvent, system.getPath/openFileDialog/saveFileDialog.

### AppShell Layout
Routes: /designer, /templates, /execute, /execute/:id, /cli, /settings. Sidebar navigation with active state highlighting and recent workflows section.

## Dependencies

- **P14-F01** (types, IPC channels, constants)

## Status

**COMPLETE** -- All 6 tasks (T06-T11) implemented in earlier phases.
