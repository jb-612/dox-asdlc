---
id: P15-F13
parent_id: P15
type: user_stories
version: 1
status: draft
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-26T00:00:00Z"
---

# User Stories: Monitoring & Settings Completion (P15-F13)

## US-01: Configure All Settings via UI

**As a** Workflow Studio user,
**I want** all application settings to be configurable through the Settings page,
**So that** I don't need to edit JSON files manually.

### Acceptance Criteria

- [ ] Work Item Directory field with browse button in Environment section
- [ ] Telemetry Receiver Port numeric input with range validation (1024-65535)
- [ ] Log Level dropdown (debug, info, warn, error) in Environment section
- [ ] All three fields persist on save and reload

## US-02: Test Docker Connectivity

**As a** Workflow Studio user,
**I want** to test Docker connectivity from the Settings page,
**So that** I can verify Docker is available before running parallel workflows.

### Acceptance Criteria

- [ ] "Test Connection" button next to Docker Socket Path field
- [ ] Shows "Connected" with Docker version on success
- [ ] Shows error message on failure
- [ ] Button shows loading state during test
