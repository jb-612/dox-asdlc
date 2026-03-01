---
id: P15-F13
parent_id: P15
type: tasks
version: 1
status: complete
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-26T00:00:00Z"
estimated_hours: 3
---

# Tasks: Monitoring & Settings Completion (P15-F13)

## Dependency Graph

```
T01, T02, T03 (parallel)
       |
T04 (integration test, needs T01+T02+T03)
```

## Tasks

### T01: Add workItemDirectory, telemetryReceiverPort, logLevel to Settings UI

- [x] Estimate: 1hr
- [ ] Notes:
  - RED: add tests to `test/renderer/components/settings/SettingsComponents.test.tsx`
    - Test: workItemDirectory field renders with browse button
    - Test: telemetryReceiverPort renders as numeric input
    - Test: telemetryReceiverPort rejects values outside 1024-65535
    - Test: logLevel renders as dropdown with 4 options
    - Test: changing logLevel calls onSettingsChange
  - GREEN: add fields to `src/renderer/components/settings/EnvironmentSection.tsx`
    - workItemDirectory: path input with browse button (same pattern as workflowDirectory)
    - telemetryReceiverPort: numeric input, min=1024, max=65535
    - logLevel: select dropdown with options: debug, info, warn, error
  - Dependencies: none

### T02: Add Docker connectivity test button

- [x] Estimate: 1hr
- [ ] Notes:
  - RED: add tests
    - Test: "Test Docker" button renders next to Docker Socket Path
    - Test: clicking button shows loading state
    - Test: successful test shows "Connected (version)" message
    - Test: failed test shows error message
  - GREEN: add test button to EnvironmentSection
    - Button next to dockerSocketPath field
    - Calls new IPC handler `SETTINGS_TEST_DOCKER`
    - Handler uses `CLISpawner.getDockerStatus()` (already exists)
    - Returns { ok, version?, error? }
  - Add IPC handler in `src/main/ipc/settings-handlers.ts`
  - Dependencies: none

### T03: Add validation for new settings fields

- [x] Estimate: 0.5hr
- [ ] Notes:
  - RED: test validation edge cases
    - Test: telemetryReceiverPort 0 -> rejected
    - Test: telemetryReceiverPort 80000 -> rejected
    - Test: logLevel 'verbose' -> rejected
  - GREEN: add validation in EnvironmentSection handlers
  - Dependencies: T01

### T04: Integration test for complete settings persistence

- [x] Estimate: 0.5hr
- [ ] Notes:
  - Test: change all 3 new fields -> save -> reload -> values persisted
  - Test: Docker test button returns result
  - Dependencies: T01, T02, T03

## Summary

| Phase | Tasks | Est. Hours |
|-------|-------|-----------|
| Settings fields + Docker test | T01-T03 | 2.5hr |
| Integration | T04 | 0.5hr |
| **Total** | **4 tasks** | **3hr** |
