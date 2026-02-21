# P14-F02: Electron Shell & IPC Bridge - User Stories

**Version:** 1.0
**Date:** 2026-02-21
**Status:** COMPLETE

---

## US-01: Electron Shell and Navigation

**As a** developer
**I want** a desktop application with a sidebar navigation and frameless title bar
**So that** I have a native-feeling workspace for designing and running workflows

### Acceptance Criteria

1. Electron app launches with frameless window showing custom title bar controls (minimize, maximize, close)
2. Sidebar provides navigation between Designer, Templates, Execute, CLI Sessions, and Settings pages
3. Active page is highlighted in the sidebar
4. Window dimensions and position persist across restarts
5. Renderer process has no direct access to Node.js APIs (contextIsolation enforced)
6. IPC bridge is available in the renderer via `window.electronAPI`
