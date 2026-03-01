---
id: P15-F13
parent_id: P15
type: design
version: 1
status: approved
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-28T00:00:00Z"
dependencies:
  - P15-F07
  - P15-F08
tags:
  - monitoring
  - settings
  - phase-2
  - polish
---

# Design: Monitoring & Settings Completion (P15-F13)

## Overview

Phase 1 shipped a nearly complete Monitoring dashboard and Settings page. The exploration
audit found that all major components are implemented with live data (no mocks). Only
minor gaps remain:

1. Three settings fields defined in `AppSettings` but not exposed in the Settings UI
2. Docker connectivity test button missing from Environment tab

## What Already Exists (Complete — No Work Needed)

### Monitoring (All Complete)
| Component | Status |
|-----------|--------|
| MonitoringPage (2-column layout) | Complete with live status badge |
| TelemetryReceiver (HTTP POST /telemetry) | Complete and wired to IPC |
| MonitoringStore (Zustand) | Complete with selectors and filtering |
| EventStream (9-column table) | Complete with expandable rows, real events |
| ContainerPoolPanel | Complete with live container states |
| WorkflowView | Complete with active workflow tracking |
| SessionList | Complete with sorting and status badges |
| SummaryCards (4 metrics) | Complete |
| All monitoring tests | 500+ lines of test code |

### Settings (Mostly Complete)
| Component | Status |
|-----------|--------|
| SettingsPage (3 tabs) | Complete |
| ProviderCard (AI provider config) | Complete with test connection |
| ModelParamsForm (temp/maxTokens) | Complete with validation |
| EnvironmentSection (12 settings) | Complete (3 fields missing) |
| AboutSection | Complete |
| Provider test connection IPC | Complete for Anthropic/OpenAI/Google/Azure |
| Settings validation | Complete for all exposed fields |
| Settings tests | 90+ test cases |

## Scope (3 Items)

### 1. Expose Missing Settings in UI

Three `AppSettings` fields are defined but lack UI inputs:

| Field | Type | Default | Where to Add |
|-------|------|---------|--------------|
| `workItemDirectory` | `string` | `'.workitems'` | EnvironmentSection, browse button |
| `telemetryReceiverPort` | `number` | `9292` | EnvironmentSection, numeric input |
| `logLevel` | `string` | `'info'` | EnvironmentSection, dropdown (debug/info/warn/error) |

### 2. Docker Connectivity Test Button

`CLISpawner.getDockerStatus()` exists and is callable via IPC, but there's no UI button.
Add a "Test Connection" button next to the Docker Socket Path field in EnvironmentSection,
matching the existing pattern from ProviderCard's test connection button.

### 3. Settings Field Validation

- `telemetryReceiverPort`: validate range 1024-65535
- `logLevel`: validate against allowed enum values
- `workItemDirectory`: validate directory exists (or allow creation)

## File Changes

### Modified Files
```
src/renderer/components/settings/EnvironmentSection.tsx  # Add 3 fields + Docker test button
src/main/ipc/settings-handlers.ts                       # Add Docker test IPC handler
```

### Test Changes
```
test/renderer/components/settings/SettingsComponents.test.tsx  # Add tests for new fields
test/main/settings-handlers.test.ts                            # Add Docker test handler test
```

## Estimated Effort

~3 hours total:
- 1hr: Add 3 settings fields to EnvironmentSection
- 1hr: Docker connectivity test button + IPC handler
- 1hr: Tests for all new UI elements
