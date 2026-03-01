---
id: P15-F17
parent_id: P15
type: user_stories
version: 1
status: draft
created_by: planner
created_at: "2026-03-01T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
---

# User Stories: CI/CD Integration (P15-F17)

## US-01: Headless Workflow Execution

**As a** CI pipeline author,
**I want** to run Studio workflows from the command line without Electron,
**So that** I can integrate agentic workflows into GitHub Actions or any CI system.

### Acceptance Criteria
- [ ] `dox run --workflow <id-or-path>` loads and executes a workflow headlessly
- [ ] Exit code reflects outcome: 0=completed, 1=failed, 2=aborted, 3=invalid input, 4=gate-blocked
- [ ] `--var KEY=VAL` passes variables into the workflow execution
- [ ] `--json` flag outputs NDJSON events to stdout for machine parsing
- [ ] Without `--json`, human-readable log lines printed to stderr
- [ ] `DOX_VAR_<name>` environment variables injected as workflow variables
- [ ] `--repo <path>` sets the working directory for CLI-spawned agents
- [ ] `--mock` flag enables mock execution mode for testing

## US-02: Gate Handling in Headless Mode

**As a** CI pipeline author,
**I want** HITL gates handled automatically in headless mode,
**So that** workflows don't hang waiting for human input in CI.

### Acceptance Criteria
- [ ] Default: all gates auto-continue in headless mode
- [ ] `--gate-mode=fail` causes immediate exit (code 4) when a gate is reached
- [ ] Gate decisions logged as events in NDJSON output
- [ ] No PTY/terminal interaction required in headless mode

## US-03: Webhook-Triggered Execution

**As a** DevOps engineer,
**I want** to trigger workflow execution via HTTP webhook,
**So that** GitHub push/PR events can automatically start workflows.

### Acceptance Criteria
- [ ] `dox webhook` starts a lightweight HTTP server on configured port
- [ ] `POST /api/v1/trigger/:workflowId` triggers a workflow run
- [ ] Request authenticated via HMAC-SHA256 (`X-Dox-Signature` header)
- [ ] Unauthenticated requests rejected with 401
- [ ] Response includes `{ executionId, status: 'started' }` on success
- [ ] Returns 429 if an execution is already in progress
- [ ] Returns 404 if workflow ID not found

## US-04: GitHub Event Integration

**As a** DevOps engineer,
**I want** the webhook server to parse GitHub event payloads,
**So that** repo, branch, and PR context is automatically extracted.

### Acceptance Criteria
- [ ] `X-GitHub-Event` header detected and parsed
- [ ] Push events extract `ref`, `repository.full_name`, `head_commit.id`
- [ ] Pull request events extract `number`, `head.ref`, `base.ref`
- [ ] Extracted fields injected as workflow variables (`github_ref`, `github_repo`, etc.)
- [ ] Generic JSON payloads (no GitHub header) pass body as `payload` variable

## US-05: GitHub Actions YAML Export

**As a** workflow designer,
**I want** to export a Studio workflow as a GitHub Actions YAML file,
**So that** I can commit it to a repo and run it natively in GHA.

### Acceptance Criteria
- [ ] Export produces valid `.github/workflows/<name>.yml` content
- [ ] Each sequential node maps to a GHA step using `dox run`
- [ ] Parallel groups map to GHA matrix or parallel jobs
- [ ] Gate/manual blocks include `# MANUAL: requires human review` comment
- [ ] Configurable trigger events (push, pull_request, workflow_dispatch)
- [ ] Output YAML passes basic syntax validation

## US-06: Workflow JSON Export with Versioning

**As a** workflow designer,
**I want** to export workflows as version-stamped portable JSON,
**So that** I can share them across machines or check them into source control.

### Acceptance Criteria
- [ ] JSON export includes `exportedAt` timestamp in metadata
- [ ] Existing `WorkflowFileService.save()` handles serialization
- [ ] Import validated by existing Zod schema on load (no separate validation needed)
- [ ] `dox export --workflow <id> --format json|gha` CLI command available
