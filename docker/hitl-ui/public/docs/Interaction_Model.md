# aSDLC Interaction Model

## Document Version
- **Version**: 1.0
- **Last Updated**: 2026-01-22
- **Status**: Approved

---

## Overview

aSDLC supports three interaction modes, each serving distinct user needs:

| Mode | Primary Purpose | Target Users |
|------|-----------------|--------------|
| **SPA** | Structured workflow with rich evidence display | All users |
| **CLI** | Automation, scripting, quick actions | Developers, CI/CD |
| **VS Code** | IDE-integrated navigation and viewing | Developers |

### Core Principle

aSDLC is a **workflow orchestration system**, not a coding assistant. This distinction drives design decisions:

- **Not like Claude Code**: aSDLC writes code, humans approve (not pair programming)
- **Not like Cursor**: aSDLC produces complete artifacts (not inline suggestions)
- **Like a factory floor**: Control system for an automated production line

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION MODES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │     SPA      │    │     CLI      │    │   VS Code    │                  │
│  │   (Primary)  │    │  (Automation)│    │  (Optional)  │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Unified REST/WebSocket API                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                 aSDLC Server (Multi-Container)                       │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │   │
│  │  │Orchestrator│  │  Workers  │  │   Redis   │  │  HITL API │        │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mode 1: SPA (Primary Interface)

### Target Users
- Product Managers (Discovery, PRD review)
- Developers (HITL approvals, monitoring)
- QA Engineers (Test spec review, validation gates)
- Ops/SRE (Cockpit, budget, deployment gates)
- Admins (Configuration, rule management)

### Strengths

| Task | Why SPA Wins |
|------|--------------|
| HITL Gates | Rich evidence display, side-by-side diffs, structured feedback capture |
| Discovery Chat | Multi-turn conversation with visible artifact generation |
| Design Chat | Context pack visualization, architecture diagrams |
| Monitoring | Real-time dashboards, workflow graphs, alerting |
| Feedback Learning | Rule proposal review with evidence, effectiveness metrics |
| Multi-stakeholder | Non-developers can participate without IDE |

### When to Use
- Starting a new epic (Discovery → Design)
- Reviewing and approving gates
- Monitoring active runs
- Investigating failures
- Configuring the system
- Reviewing learned rules

### Reference
See `SPA_Information_Architecture.md` for complete specification.

---

## Mode 2: CLI (Automation & Power Users)

### Target Users
- Developers in terminal workflow
- CI/CD pipelines
- Scripts and automation
- Quick status checks

### Installation

```bash
# PyPI
pip install asdlc-cli

# Homebrew (macOS/Linux)
brew install asdlc/tap/asdlc

# Binary download
curl -fsSL https://asdlc.dev/install.sh | sh
```

### Configuration

```bash
# Initialize configuration
asdlc init

# Creates ~/.asdlc/config.yaml:
# server: https://asdlc.example.com
# default_env: dev
# default_repo: myorg/myrepo
```

### Command Reference

#### Authentication
```bash
asdlc auth login                    # Interactive login
asdlc auth login --token=TOKEN      # Token-based (CI/CD)
asdlc auth status                   # Show current auth
asdlc auth logout                   # Clear credentials
```

#### Context Management
```bash
asdlc context set --repo=myrepo --env=dev
asdlc context show
asdlc context list                  # Available repos/envs
```

#### Epic Lifecycle
```bash
asdlc epic create "Feature title"   # Returns EPIC-XXX
asdlc epic status EPIC-043          # Current state, progress
asdlc epic list                     # All epics
asdlc epic list --state=active      # Filter by state
asdlc epic list --mine              # Epics I created
```

#### Workflow Triggers
```bash
asdlc run discovery EPIC-043        # Start discovery phase
asdlc run design EPIC-043           # Start design phase  
asdlc run develop EPIC-043          # Start development
asdlc run validate EPIC-043         # Start validation
asdlc run deploy EPIC-043           # Start deployment (requires approval)
```

#### Gate Operations
```bash
asdlc gates list                    # Pending gates
asdlc gates list --type=HITL-1      # Filter by type
asdlc gates show GATE-123           # Gate details + evidence summary

# Quick approval (simple cases only)
asdlc gates approve GATE-123
asdlc gates approve GATE-123 --comment="LGTM"

# Rejection
asdlc gates reject GATE-123 --reason="Missing test coverage"

# Complex review → open in browser
asdlc gates approve GATE-123 --open
```

#### Run Management
```bash
asdlc runs list                     # Active runs
asdlc runs list --epic=EPIC-043     # Filter by epic
asdlc runs show RUN-456             # Run details
asdlc runs logs RUN-456             # Stream logs (live)
asdlc runs logs RUN-456 --follow    # Tail mode
asdlc runs cancel RUN-456           # Cancel a run
asdlc runs rerun RUN-456            # Rerun with same inputs
```

#### Artifact Management
```bash
asdlc artifacts list EPIC-043                    # List artifacts
asdlc artifacts show EPIC-043/PRD.md             # View content
asdlc artifacts diff EPIC-043/PRD.md             # Show changes
asdlc artifacts history EPIC-043/PRD.md          # Version history
asdlc artifacts export EPIC-043 -o ./bundle.zip  # Export bundle
```

#### Budget & Status
```bash
asdlc budget status                 # Overall spend
asdlc budget status EPIC-043        # Per-epic spend
asdlc budget alert                  # Show active alerts

asdlc status                        # System health summary
asdlc workers list                  # Worker pool status
```

#### Quick Commands
```bash
asdlc watch EPIC-043                # Live tail of epic activity
asdlc open EPIC-043                 # Open epic in SPA
asdlc open GATE-123                 # Open gate in SPA
asdlc open RUN-456                  # Open run in SPA
```

### Interactive TUI Mode

```bash
asdlc tui
```

```
┌─ aSDLC Terminal ─────────────────────────────────────────────┐
│                                                               │
│  EPIC-043: User Authentication                               │
│  Stage: Development (3/7 tasks complete)                     │
│                                                               │
│  ┌─ Pending Gates ─────────────────────────────────────────┐ │
│  │  GATE-127  HITL-3  Task Plan Review     2h ago         │ │
│  │  > Press Enter to review, 'a' to approve, 'r' to reject │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ Active Runs ───────────────────────────────────────────┐ │
│  │  RUN-891  Coding Agent  task_004  Running (2m)         │ │
│  │  RUN-892  UTest Agent   task_004  Queued               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  [g]ates  [r]uns  [a]rtifacts  [b]udget  [q]uit             │
└───────────────────────────────────────────────────────────────┘
```

Navigation:
- Arrow keys / j/k: Navigate lists
- Enter: Select / drill down
- Esc / q: Back / quit
- ?: Help

### CI/CD Integration

#### GitHub Actions
```yaml
name: aSDLC Validation
on:
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install aSDLC CLI
        run: pip install asdlc-cli
      
      - name: Authenticate
        run: asdlc auth login --token=${{ secrets.ASDLC_TOKEN }}
      
      - name: Check Required Gates
        run: |
          EPIC_ID=$(cat .asdlc-epic)
          asdlc gates check --epic=$EPIC_ID --required=HITL-3
      
      - name: Validate Artifacts
        run: asdlc artifacts validate --epic=$EPIC_ID
```

#### GitLab CI
```yaml
asdlc-validate:
  stage: validate
  script:
    - pip install asdlc-cli
    - asdlc auth login --token=$ASDLC_TOKEN
    - asdlc gates check --epic=$EPIC_ID --required=HITL-3
```

### Output Formats

```bash
# Default: human-readable
asdlc epic status EPIC-043

# JSON (for scripting)
asdlc epic status EPIC-043 --output=json

# YAML
asdlc epic status EPIC-043 --output=yaml

# Quiet (exit code only)
asdlc gates check GATE-123 --quiet
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Authentication error |
| 3 | Not found |
| 4 | Validation failed |
| 5 | Gate not approved |

---

## Mode 3: VS Code Extension (Optional)

### Target Users
- Developers who prefer IDE workflow
- Code review and patch inspection
- Task-level context viewing

### Installation

```
ext install asdlc.vscode-asdlc
```

### Features

#### Sidebar Panel
```
┌─ aSDLC ──────────────────────────────┐
│                                       │
│  ▼ EPIC-043: User Auth               │
│    ├── 📄 PRD.md ✓                   │
│    ├── 📄 Test_Specs.md ✓            │
│    ├── 📄 Architecture.md ✓          │
│    └── 📁 Tasks                       │
│        ├── task_001 ✓                │
│        ├── task_002 ✓                │
│        ├── task_003 🔄 (in progress) │
│        └── task_004 ○                │
│                                       │
│  ▼ Pending Gates (1)                 │
│    └── GATE-127: Task Plan Review    │
│        [Open in SPA]                 │
│                                       │
│  ▼ Active Runs (2)                   │
│    ├── RUN-891: Coding Agent         │
│    └── RUN-892: UTest Agent          │
│                                       │
└───────────────────────────────────────┘
```

#### Artifact Viewing
- Click artifact → opens in editor with syntax highlighting
- Diffs shown with VS Code's built-in diff viewer
- CodeLens links to related files in codebase

#### Task Context Panel
When viewing a task file, shows:
- Context pack summary (files, tokens)
- Agent output (patches, tests)
- Status and actions
- Link to full view in SPA

#### Notifications
- Badge on sidebar when gates are pending
- Notification when runs complete
- Alert on failures

#### Commands (Cmd/Ctrl+Shift+P)
```
aSDLC: Open Epic in SPA
aSDLC: Open Current Gate
aSDLC: Show Run Logs
aSDLC: Refresh Status
aSDLC: Switch Epic
```

### Design Principles

The VS Code extension is a **viewer and navigator**, not a coding assistant:

| Does | Does NOT |
|------|----------|
| Show artifact tree | Generate code inline |
| Display diffs | Autocomplete suggestions |
| Link to SPA | Provide chat interface |
| Show run status | Edit artifacts directly |
| Notify on events | Replace SPA functionality |

---

## Capability Matrix

| Capability | SPA | CLI | VS Code |
|------------|:---:|:---:|:-------:|
| Discovery Chat | ✅ | ❌ | ❌ |
| Design Chat | ✅ | ❌ | ❌ |
| HITL Gate Review (full) | ✅ | ❌ | ❌ |
| HITL Gate Approve (simple) | ✅ | ✅ | ❌ |
| Feedback Capture | ✅ | ⚠️ | ❌ |
| Monitoring Dashboard | ✅ | ⚠️ | ⚠️ |
| Workflow Graph | ✅ | ❌ | ❌ |
| Artifact Viewing | ✅ | ✅ | ✅ |
| Artifact Diffing | ✅ | ✅ | ✅ |
| Run Logs | ✅ | ✅ | ⚠️ |
| Trigger Workflows | ✅ | ✅ | ⚠️ |
| CI/CD Integration | ❌ | ✅ | ❌ |
| Scripting/Automation | ❌ | ✅ | ❌ |
| Admin Configuration | ✅ | ⚠️ | ❌ |
| Multi-stakeholder | ✅ | ❌ | ❌ |

Legend: ✅ Primary | ⚠️ Limited | ❌ Not supported

---

## Implementation Phases

### Phase 1: SPA + CLI (MVP)
| Interface | Scope |
|-----------|-------|
| SPA | Full implementation per SPA_Information_Architecture.md |
| CLI | Core commands: auth, context, epic, gates, runs, artifacts, status |

### Phase 2: CLI Enhancement
| Scope |
|-------|
| TUI mode |
| Full budget commands |
| Advanced filtering |
| Shell completions (bash, zsh, fish) |

### Phase 3: VS Code Extension
| Scope |
|-------|
| Sidebar navigation |
| Artifact viewer |
| Deep links to SPA |
| Notifications |

---

## API Contract

All interfaces share the same backend API:

### REST Endpoints
```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/status

GET    /api/epics
POST   /api/epics
GET    /api/epics/:id
PATCH  /api/epics/:id

POST   /api/epics/:id/runs
GET    /api/runs
GET    /api/runs/:id
POST   /api/runs/:id/cancel
GET    /api/runs/:id/logs

GET    /api/gates
GET    /api/gates/:id
POST   /api/gates/:id/decision

GET    /api/artifacts
GET    /api/artifacts/:id
GET    /api/artifacts/:id/diff
GET    /api/artifacts/:id/history

GET    /api/budget
GET    /api/budget/epics/:id

GET    /api/workers
GET    /api/status
```

### WebSocket Channels
```
/ws/events              # Global event feed
/ws/runs/:id/logs       # Run log streaming
/ws/gates               # Gate notifications
/ws/epic/:id            # Epic-specific events
```

### Authentication
- Token-based (JWT)
- Tokens obtained via `/api/auth/login`
- Passed as `Authorization: Bearer <token>`
- CLI stores token in `~/.asdlc/credentials`

---

## What NOT to Build

| Anti-pattern | Rationale |
|--------------|-----------|
| Full HITL review in CLI | Evidence review needs rich UI |
| Chat interface in VS Code | Context switching worse than tab switching |
| Code autocomplete | aSDLC is orchestration, not pair programming |
| Standalone desktop app | Web + CLI covers all cases |
| Mobile app | Workflow tasks need full screen |
