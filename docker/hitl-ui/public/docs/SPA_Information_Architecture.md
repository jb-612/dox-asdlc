# aSDLC SPA Information Architecture

## Document Version
- **Version**: 1.1
- **Last Updated**: 2026-01-22
- **Status**: Draft for Review

---

## Global Layout

### Top Bar
| Element | Description |
|---------|-------------|
| Session Selector | Environment, repository, epic selection |
| Global Search | Search artifacts, tasks, agents, decisions, feedback |
| Notifications | Gate requests, failed runs, budget alerts, rule proposals pending |
| User Menu | Role, API keys status, preferences, logout |

### Left Navigation
1. Documentation
2. Agent Cockpit
3. Discovery & Design Studio
4. HITL Gates
5. Artifacts
6. Budget & Reports
7. Admin & Configuration

### Right Utility Panel (collapsible)
- **Evidence Drawer**: Context for currently selected item (task, gate, agent run)
- **Quick Actions**: Approve, reject, rerun, export, open PR
- **Live Event Feed**: Real-time stream of system events (WebSocket)

### Bottom Status Bar
- Current Git SHA and branch
- Active workers count
- Pending gates count
- System health indicator

---

## Page 1: Documentation (Interactive aSDLC Methodology)

### Goal
Teach the methodology and make it actionable: every concept links to a real system object (spec index, gate, stream event, artifact, agent run).

### Core Widgets

#### 1.1 Interactive Blueprint Map
A clickable diagram of clusters (Governance, Discovery, Design, Development, Validation, Deployment).

Each cluster expands to show:
- Agents in that cluster
- Required artifacts
- Entry and exit events
- Related HITL gates
- Learned rules affecting this cluster (from Feedback Learning)

#### 1.2 Methodology Walkthrough (Stepper)
Steps: Spec Index → PRD → Acceptance → Architecture → Task Plan → TDD Loop → Validation → Release

Each step includes:
- "Why this exists"
- "Inputs and outputs"
- "What the human approves"
- "What can go wrong" and how the system mitigates it
- "Learned improvements" — rules generated from past feedback

#### 1.3 Interactive Glossary
Terms with "Show me in the system" deep links:
- Spec Index
- Context Pack
- Repo Mapper
- RLM (Recursive Language Model)
- Gate
- Evidence Bundle
- Patch-only Workflow
- Evaluator Agent
- Learned Rule

#### 1.4 Playground Mode (Safe Sandbox)
- Pre-canned demo session that replays a full run
- Users can scrub timeline and see artifacts change over time
- Includes example HITL decisions with feedback capture
- Shows how feedback becomes learned rules

### UX Patterns
- **Learn** tab: Conceptual content
- **Apply** tab: Live links to create an epic, open a gate, inspect artifacts

---

## Page 2: Agent Cockpit (Utilization and Workflow)

### Goal
Ops view: what is running, what is blocked, why, and what it costs.

### Layout

#### 2.1 Header KPIs
| Metric | Description |
|--------|-------------|
| Active Runs | Currently executing agent runs |
| Queued Events | Events waiting for worker pickup |
| Blocked Gates | HITL gates awaiting human decision |
| Failures (24h) | Failed runs in last 24 hours |
| Burn Rate | Tokens/hour and USD/hour |
| Pending Rules | Rule proposals awaiting meta-HITL approval |

#### 2.2 Worker Utilization Panel
Worker pool list showing:
- Worker ID
- Status (idle, busy, draining, offline)
- Current agent type
- Current task/epic
- Model and mode (Standard vs RLM)
- Resource utilization (CPU, memory if relevant)

Per-worker quick actions:
- Pause
- Drain (complete current task, then stop)
- Cancel task
- View logs

#### 2.3 Workflow Graph View
Sankey or node graph visualization:
- **Nodes**: Cluster stages, gates, agent types
- **Edges**: Event flow with volume indicators
- Clicking an edge filters the run list to runs currently traversing it
- Gate nodes show approval rate and average turnaround

#### 2.4 Runs Table
| Column | Description |
|--------|-------------|
| run_id | Unique identifier (link to detail) |
| Epic | Associated epic |
| Agent | Agent type |
| State | Running, completed, failed, blocked |
| Last Event | Most recent event |
| Elapsed | Time since start |
| Budget | Tokens and USD consumed |
| Evidence | Link to evidence bundle |

Filters: cluster, agent, status, model, repo, environment, date range

#### 2.5 Git Integration Panel
- Current branch per environment
- Pending commits in commit gateway queue
- Recent commits with agent attribution
- Branch protection status
- "Force sync" action for drift recovery
- Uncommitted artifact changes indicator

#### 2.6 Anomalies and Alerts
| Alert Type | Trigger |
|------------|---------|
| Subcall Explosion Risk | RLM subcalls approaching limit |
| Fail Count Exceeded | Same task failed > 4 times |
| Gate Pending > SLA | HITL gate waiting beyond threshold |
| Budget Threshold | Epic approaching budget limit |
| Redis Backlog | Event queue growing abnormally |
| Rule Effectiveness Drop | Learned rule showing negative impact |

### 2.7 Agent Run Detail View (Drill-down)

#### Timeline Tab
- Chronological events and tool calls
- Visual markers for: start, tool calls, subcalls, completion/failure

#### Inputs Tab
- Artifacts consumed
- Context packs used (with token counts)
- Configuration and parameters

#### Outputs Tab
- Created or updated artifacts
- Patches generated
- Test results

#### Evidence Tab
- Test reports with pass/fail summary
- Diffs with syntax highlighting
- Security scan results
- RLM trajectory (if applicable)

#### RLM Trajectory Viewer (for RLM runs)
```
┌─────────────────────────────────────────────────────────────────┐
│  RLM Run: run_abc123                          [Expand All]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Root Call: "Fix failing test in parser module"                │
│  │                                                              │
│  ├── Subcall 1: "Analyze test failure" ✓                       │
│  │   ├── Tool: read_file(tests/test_parser.py)                 │
│  │   ├── Tool: read_file(test_output.log)                      │
│  │   ├── Tool: grep_codebase("IndexError")                     │
│  │   └── Result: Identified off-by-one error in line 142       │
│  │                                                              │
│  ├── Subcall 2: "Generate fix" ✓                               │
│  │   ├── Tool: read_file(src/parser.py)                        │
│  │   ├── Tool: edit_file(src/parser.py, lines 140-145)         │
│  │   └── Result: Patch generated (3 lines changed)             │
│  │                                                              │
│  └── Subcall 3: "Verify fix" ✓                                 │
│      ├── Tool: run_tests(tests/test_parser.py)                 │
│      └── Result: All 24 tests pass                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Tokens: 12,340 │ Subcalls: 3/10 │ Duration: 47s │ Cost: $0.18 │
└─────────────────────────────────────────────────────────────────┘
```

#### Actions
- Rerun with same inputs
- Rerun with different model
- Rerun with RLM enabled/disabled
- Escalate to human review
- Export run data

---

## Page 3: Discovery & Design Studio (Chat-Driven Workflow)

### Goal
A controlled chat experience that produces structured outputs: PRD, acceptance tests, architecture draft, task plan—and pushes them into the pipeline.

### Route Structure
- `/studio/discovery` — PRD and acceptance criteria
- `/studio/design` — Architecture and task planning
- `/studio/context` — Context pack queries

### 3.1 Discovery Chat (`/studio/discovery`)

#### Target Outputs
- PRD draft (product_reqs.md)
- Scope boundaries
- Stakeholders
- Acceptance criteria skeleton (test_specs.md)

#### Assistant Behavior
- Asks structured questions following PRD template
- Maintains visible "Working Outline" panel
- Validates completeness against schema
- Warns if scope is ambiguous or too broad

#### Working Outline Panel (live updating)
```
┌─────────────────────────────────────┐
│  PRD Working Outline                │
├─────────────────────────────────────┤
│  ✓ Problem Statement                │
│  ✓ Target Users                     │
│  ⏳ Success Metrics (in progress)   │
│  ○ Scope Boundaries                 │
│  ○ Acceptance Criteria              │
│  ○ Non-functional Requirements      │
├─────────────────────────────────────┤
│  Completeness: 40%                  │
│  [Preview PRD] [Save Draft]         │
└─────────────────────────────────────┘
```

### 3.2 Design Chat (`/studio/design`)

#### Target Outputs
- Architecture document sections
- Interface contracts
- Context pack requests to Repo Mapper
- Task plan decomposition

#### Context-Aware Features
- "Load relevant context" button queries Repo Mapper
- Shows which files are in current context window
- Warns if context is stale (files changed since load)

### 3.3 Context Inquiry (`/studio/context`)

#### Query Interface
Natural language queries:
- "Build context pack for authentication module"
- "Show dependency map for OrderService"
- "Summarize files related to payment processing"
- "What tests cover the parser module?"

#### Response Format
- Bounded context pack preview
- File list with relevance scores
- Token count and cost estimate
- Citations (file path, line ranges)
- "Add to current session" action

### 3.4 Output Quickview Panel (Right Side)

Generated artifacts appear as cards:

```
┌─────────────────────────────────────┐
│  📄 PRD.md                          │
│  Status: Draft                      │
│  Validation: ✓ Schema valid         │
│              ⚠ Missing 2 sections   │
├─────────────────────────────────────┤
│  [Diff] [Download] [Save to Repo]   │
│  [Submit to PRD Agent]              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📄 Test_Specs.md                   │
│  Status: Not started                │
│  Validation: ○ Pending              │
├─────────────────────────────────────┤
│  [Generate from PRD]                │
└─────────────────────────────────────┘
```

Each card shows:
- Artifact name and type
- Validation status (schema checks, required sections)
- Diff view (changes from last version)
- Actions: Download, Save to repo, Submit to next agent, Open gate request

### 3.5 Guardrails in UI

| Guardrail | Implementation |
|-----------|----------------|
| No code writing | Submit buttons disabled until prerequisite artifacts exist |
| Evidence required | Warning when pushing to next stage without required attachments |
| Model selection | Defaults to standard mode; RLM requires explicit toggle with cost warning |
| Scope creep | Warning if PRD scope expands significantly after initial draft |

### 3.6 Model and Cost Selector
```
┌─────────────────────────────────────────────┐
│  Model: [Claude Sonnet ▼]                   │
│  Mode:  ○ Standard  ● RLM                   │
│                                             │
│  ⚠ RLM mode enabled                         │
│  Estimated cost: $0.50 - $2.00 per task     │
│  Subcall limit: 10                          │
│                                             │
│  [Confirm RLM Mode]                         │
└─────────────────────────────────────────────┘
```

---

## Page 4: HITL Gates (Human Approvals)

### Goal
Make approvals fast, auditable, evidence-driven, and learning-enabled.

### 4.1 Gate Queue View (`/gates`)

| Column | Description |
|--------|-------------|
| Gate Type | HITL-1, HITL-2, HITL-3, HITL-DEPLOY, HITL-RULE |
| Epic | Associated epic |
| Stage | Current workflow stage |
| Submitted By | Agent that triggered the gate |
| Age | Time since submission |
| SLA Status | On track, Warning, Breached |
| Artifacts | Checklist of required artifacts (✓/○) |
| Similar Rejections | Count of similar past rejections (from Evaluator) |

Filters: gate type, environment, repo, severity, SLA status, has similar rejections

### 4.2 Gate Detail View (`/gates/:gate_id`)

#### Required Artifacts Panel
- Render markdown with syntax highlighting
- Show diffs since last approval (side-by-side or unified)
- Validation status per artifact
- "View in Artifacts" link

#### Evidence Bundle Panel
- Test results summary with expandable raw logs
- Security scan results
- Patch diffs with file list
- Context pack contents (if relevant)
- RLM trajectory summary (if RLM was used)

#### Similar Past Feedback Panel (from Evaluator Agent)
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠ Similar Rejections Found (3)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Pattern: "Acceptance criteria too vague"                       │
│  Occurrences: 3 times in last 30 days                          │
│  Affected agents: PRD Agent, Acceptance Agent                  │
│                                                                 │
│  Examples:                                                      │
│  • EPIC-031: "Criteria lacks measurable outcomes"              │
│  • EPIC-038: "No verification method specified"                │
│  • EPIC-041: "Subjective terms used"                           │
│                                                                 │
│  Suggested action: Check acceptance criteria for specificity   │
│                                                                 │
│  [View Pattern Details] [Ignore for this review]               │
└─────────────────────────────────────────────────────────────────┘
```

#### Decision Panel
```
┌─────────────────────────────────────────────────────────────────┐
│  Decision                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ○ Approve                                                      │
│    └─ Optional constraints:                                     │
│       □ Budget cap: [____] tokens                              │
│       □ Additional tests required: [____________]              │
│       □ Expires after: [__] hours                              │
│                                                                 │
│  ○ Approve with Changes                                         │
│    └─ Correction diff will be captured for learning            │
│                                                                 │
│  ○ Reject                                                       │
│    └─ Reason code: [Select reason ▼]                           │
│       • Quality: Output does not meet standards                │
│       • Completeness: Missing required content                 │
│       • Scope: Out of scope or scope creep                     │
│       • Technical: Technical approach is flawed                │
│       • Other: [________________]                              │
│    └─ Next action: [Select action ▼]                           │
│       • Rerun agent with same inputs                           │
│       • Rerun agent with modified inputs                       │
│       • Request more information                               │
│       • Manual edit required                                   │
│       • Escalate to admin                                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Feedback for Learning                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tags: □ Quality  □ Completeness  □ Scope  □ Style  □ Other    │
│                                                                 │
│  Correction summary (for Approve with Changes):                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Describe what you changed and why...                    │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Severity: ○ Low  ○ Medium  ○ High  ○ Critical                 │
│                                                                 │
│  □ This feedback should be considered for system improvement   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Review duration: 4m 32s (auto-tracked)                        │
│                                                                 │
│  [Submit Decision]                                              │
└─────────────────────────────────────────────────────────────────┘
```

#### Audit Log Panel
| Timestamp | Actor | Action | Details |
|-----------|-------|--------|---------|
| 2026-01-22 14:32 | PRD Agent | Submitted | Gate opened |
| 2026-01-22 14:45 | reviewer@example.com | Viewed | Spent 4m 32s |
| 2026-01-22 14:50 | reviewer@example.com | Approved | With changes |
| 2026-01-22 14:50 | System | Feedback captured | FB-142 created |

### 4.3 Meta-HITL: Rule Proposal Review (`/gates?type=HITL-RULE`)

For reviewing learned rules before deployment:

```
┌─────────────────────────────────────────────────────────────────┐
│  Rule Proposal: RULE-2026-0142                                  │
│  Classification: GENERALIZABLE_HIGH                             │
│  Confidence: 89%                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Proposed Rule:                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ When generating acceptance criteria, each criterion     │   │
│  │ MUST include:                                           │   │
│  │ - A measurable outcome (number, percentage, or binary)  │   │
│  │ - The verification method (manual, automated, inspect)  │   │
│  │ - Avoid subjective terms ("fast", "user-friendly")      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Affected Agents: PRD Agent, Acceptance Agent                  │
│  Insertion Point: System prompt, "Output Guidelines" section   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Evidence (3 feedback records)                                  │
├─────────────────────────────────────────────────────────────────┤
│  • FB-101: "Acceptance criteria too vague" (EPIC-031)          │
│  • FB-107: "No measurable outcomes" (EPIC-038)                 │
│  • FB-112: "Subjective terms used" (EPIC-041)                  │
│                                                                 │
│  [View Full Feedback] [View Correction Diffs]                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Impact Analysis                                                │
├─────────────────────────────────────────────────────────────────┤
│  • Estimated rejection rate reduction: 15%                     │
│  • Affected gates per month: ~40                               │
│  • No conflicts with existing rules detected                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Decision                                                       │
├─────────────────────────────────────────────────────────────────┤
│  ○ Approve — Deploy rule to affected agents                    │
│  ○ Modify — Edit rule before approving                         │
│  ○ Reject — Reason: [________________]                         │
│                                                                 │
│  [Submit Decision]                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Page 5: Artifacts (Specs, Patches, Reports)

### Goal
Treat documents as first-class objects with full provenance and history.

### 5.1 Spec Index Browser (`/artifacts/spec-index`)

Interactive tree view of spec_index.md:

```
┌─────────────────────────────────────────────────────────────────┐
│  Spec Index: EPIC-042                                           │
│  Progress: 6/9 artifacts complete                               │
│  Current Stage: Development                                     │
│  Blocking: interface_contracts.md pending HITL-2               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📁 Discovery                                                   │
│  │  ├── 📄 PRD.md ✓ approved (HITL-1, 2026-01-20)             │
│  │  └── 📄 Test_Specs.md ✓ approved (HITL-1, 2026-01-20)      │
│  │                                                              │
│  📁 Design                                                      │
│  │  ├── 📄 architecture.md ✓ approved (HITL-2, 2026-01-21)    │
│  │  ├── 📄 interface_contracts.md ⏳ pending HITL-2            │
│  │  └── 📄 legacy_audit.md ✓ approved (HITL-2, 2026-01-21)    │
│  │                                                              │
│  📁 Development                                                 │
│  │  ├── 📄 task_plan.md ✓ approved (HITL-3, 2026-01-21)       │
│  │  ├── 📄 task_001.md 🔄 in progress (Coding Agent)          │
│  │  ├── 📄 task_002.md ○ not started                          │
│  │  └── 📄 task_003.md ○ not started                          │
│  │                                                              │
│  📁 Validation                                                  │
│  │  └── 📄 release_notes.md ○ not started                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Legend: ✓ approved  ⏳ pending  🔄 in progress  ○ not started │
│  [Export Bundle] [View Timeline] [Compare with Previous Epic]  │
└─────────────────────────────────────────────────────────────────┘
```

Click any artifact to open detail view.

### 5.2 Artifact Explorer (`/artifacts`)

| Column | Description |
|--------|-------------|
| Name | Artifact filename |
| Type | PRD, Test Spec, Architecture, Task, Patch, Report |
| Epic | Associated epic |
| Status | Draft, Pending Review, Approved, Superseded |
| Created | Timestamp and producing agent |
| Approved | Gate and timestamp (if applicable) |
| Git SHA | Commit hash |

Filters: epic, type, status, date range, producing agent, approving gate

### 5.3 Artifact Detail View (`/artifacts/:artifact_id`)

#### Content Tab
- Rendered markdown with syntax highlighting
- Table of contents navigation
- Validation status (schema checks)

#### History Tab
- Version timeline
- Click any version to view
- Compare any two versions (diff view)

#### Provenance Tab
- Which run created this artifact
- Input artifacts used
- Which gate approved it
- Who approved it and when
- Feedback associated with this artifact

#### Context Pack Tab (for artifacts with context)
- Files included in context when artifact was created
- Token count breakdown
- "Regenerate with current context" action

#### Actions
- Download (markdown, PDF)
- Export with evidence bundle
- View in Git
- Create new version
- Submit to gate

### 5.4 Context Pack Inspector (`/artifacts/context-packs`)

View and manage context packs:

```
┌─────────────────────────────────────────────────────────────────┐
│  Context Pack: cp_abc123                                        │
│  Created: 2026-01-21 14:32 by Repo Mapper                      │
│  Cache Status: Valid (expires in 2h)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Query: "Authentication module for OAuth implementation"        │
│                                                                 │
│  Files (12 files, 8,432 tokens):                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Relevance │ File                      │ Lines   │ Tokens│   │
│  ├───────────┼───────────────────────────┼─────────┼───────┤   │
│  │ 0.95      │ src/auth/oauth.py         │ 1-245   │ 1,840 │   │
│  │ 0.91      │ src/auth/tokens.py        │ 1-180   │ 1,320 │   │
│  │ 0.87      │ tests/test_oauth.py       │ 1-312   │ 2,100 │   │
│  │ 0.82      │ src/auth/middleware.py    │ 45-120  │ 580   │   │
│  │ ...       │ ...                       │ ...     │ ...   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Used by runs: run_abc, run_def, run_ghi (3 cache hits)        │
│                                                                 │
│  [View Contents] [Regenerate] [Export] [Delete]                │
└─────────────────────────────────────────────────────────────────┘
```

### 5.5 Export Options

Export bundle for an epic includes:
- All spec documents
- All decisions and approvals
- Evidence bundles
- Feedback records
- Release notes
- Git history extract

Formats: ZIP, PDF compilation, Markdown bundle

---

## Page 6: Budget & Reports

### Goal
Operational and financial governance: cost, latency, success rates, bottlenecks, and learning effectiveness.

### 6.1 Budget Dashboard (`/budget`)

#### Burn Rate Panel
| Period | Tokens | Cost (USD) |
|--------|--------|------------|
| This hour | 45,230 | $0.68 |
| Today | 892,100 | $13.38 |
| This week | 4,234,500 | $63.52 |
| This month | 18,456,000 | $276.84 |

#### Cost Breakdown
Slice by:
- Epic
- Agent type
- Model (Sonnet, Opus, Haiku)
- Mode (Standard vs RLM)
- RLM subcalls vs root calls

#### Efficiency Metrics
| Metric | Value | Trend |
|--------|-------|-------|
| Cost per accepted change | $4.23 | ↓ 12% |
| Cost per shipped release | $89.50 | ↓ 8% |
| Tokens per task | 12,340 | → stable |
| RLM subcall ratio | 2.3 avg | ↓ 5% |

#### Budget Alerts
- Projected overrun for EPIC-042 (85% consumed, 60% complete)
- Abnormal RLM subcall count in run_xyz (8/10 limit)
- Model cost increase detected (Opus usage up 30%)

### 6.2 Reports Dashboard (`/budget/reports`)

#### SLA Compliance
| Gate Type | Target | Actual | Compliance |
|-----------|--------|--------|------------|
| HITL-1 | < 4 hours | 2.3 hours avg | 94% |
| HITL-2 | < 8 hours | 5.1 hours avg | 91% |
| HITL-3 | < 2 hours | 1.4 hours avg | 97% |

#### Quality Metrics
| Metric | Value | Trend |
|--------|-------|-------|
| Test pass rate (first run) | 78% | ↑ 5% |
| Rejection rate at gates | 23% | ↓ 8% |
| Revert rate (post-deploy) | 2.1% | ↓ 1% |
| Post-deploy incidents | 0.3 per release | → stable |

#### Productivity Metrics
| Metric | Value |
|--------|-------|
| Avg cycle time (discovery → deploy) | 4.2 days |
| Tasks completed per day | 8.3 |
| Epics shipped this month | 12 |

### 6.3 Feedback Learning Effectiveness (`/budget/learning`)

#### Rule Effectiveness
| Rule ID | Deployed | Before | After | Improvement | Status |
|---------|----------|--------|-------|-------------|--------|
| RULE-0142 | 2026-01-15 | 32% reject | 18% reject | +44% ✓ | Active |
| RULE-0138 | 2026-01-10 | 28% reject | 26% reject | +7% ⚠ | Under review |
| RULE-0135 | 2026-01-05 | 15% reject | 14% reject | +7% ⚠ | Under review |

#### Learning Pipeline Health
| Metric | Value |
|--------|-------|
| Feedback captured (30 days) | 234 |
| Patterns detected | 18 |
| Rules proposed | 8 |
| Rules approved | 5 |
| Rules rejected | 2 |
| Pending approval | 1 |

#### Edge Cases Documented
| Category | Count |
|----------|-------|
| Data quality issues | 12 |
| Reviewer preference | 8 |
| One-off situations | 15 |

### 6.4 Run Cost Drill-down

Per-run cost breakdown:
- Root call tokens
- Subcall tokens (RLM)
- Tool execution time
- Queue wait time
- Context pack generation cost

---

## Page 7: Admin & Configuration

### 7.1 Environments (`/admin/environments`)

| Environment | Repository | Branch | Commit Gateway | Status |
|-------------|------------|--------|----------------|--------|
| Development | github.com/org/repo | develop | Enabled | ✓ Active |
| Staging | github.com/org/repo | staging | Enabled | ✓ Active |
| Production | github.com/org/repo | main | Enabled (protected) | ✓ Active |

Configuration per environment:
- Git repo URL and credentials
- Branch protection rules
- Commit gateway settings
- Allowed models
- Budget limits

### 7.2 Agent Registry (`/admin/agents`)

| Agent | Model | Fallback | Tools | Timeout | Budget | RLM |
|-------|-------|----------|-------|---------|--------|-----|
| PRD Agent | Sonnet | Haiku | read, write | 5m | 50K tokens | No |
| Coding Agent | Sonnet | - | read, write, execute | 10m | 100K tokens | Yes |
| Reviewer Agent | Opus | Sonnet | read, analyze | 8m | 80K tokens | No |

Per-agent configuration:
- Model selection and fallback chain
- Tool allowlist
- Timeout and retry settings
- Budget per invocation
- RLM enable flag and subcall limit
- **Learned rules** (injected from Feedback Learning)

### 7.3 Tool Registry (`/admin/tools`)

#### Bash Wrappers
| Tool | Path | Schema | Timeout |
|------|------|--------|---------|
| lint | /tools/lint.sh | lint_schema.json | 60s |
| test | /tools/test.sh | test_schema.json | 300s |
| build | /tools/build.sh | build_schema.json | 600s |

#### Future MCP Mappings
| Tool Name | MCP Method | Status |
|-----------|------------|--------|
| file_read | mcp.fs.read | Planned |
| file_write | mcp.fs.write | Planned |
| git_commit | mcp.git.commit | Planned |

### 7.4 Knowledge Store (`/admin/knowledge`)

| Setting | Value |
|---------|-------|
| Provider | ChromaDB (prototype) / Pinecone (enterprise) |
| Embedding model | text-embedding-3-small |
| Index count | 3 (code, docs, feedback) |
| Total vectors | 1,234,567 |
| Retention policy | 90 days for context packs |

Actions:
- Reindex repository
- Clear stale context packs
- View index statistics

### 7.5 Security & Access Control (`/admin/security`)

#### Roles
| Role | Permissions |
|------|-------------|
| Viewer | Read artifacts, view runs, view dashboards |
| Operator | Viewer + run agents, manage context packs |
| Approver | Operator + approve gates (HITL-1, 2, 3) |
| Admin | Approver + approve rules (HITL-RULE) + configuration |

#### Permission Matrix
| Action | Viewer | Operator | Approver | Admin |
|--------|--------|----------|----------|-------|
| View artifacts | ✓ | ✓ | ✓ | ✓ |
| Run agents | - | ✓ | ✓ | ✓ |
| Approve gates | - | - | ✓ | ✓ |
| Approve rules | - | - | - | ✓ |
| Edit configuration | - | - | - | ✓ |
| Deploy to production | - | - | - | ✓ |

### 7.6 Policy (`/admin/policy`)

| Policy | Value |
|--------|-------|
| Max failures before escalation | 4 |
| Required evidence per gate | Configurable per gate type |
| Allowed models (production) | Sonnet, Opus |
| Max budget per epic | $500 |
| Max RLM subcalls | 10 |
| Gate SLA (HITL-1) | 4 hours |
| Gate SLA (HITL-2) | 8 hours |
| Gate SLA (HITL-3) | 2 hours |
| Rule proposal auto-expire | 7 days |

### 7.7 Feedback Learning Configuration (`/admin/feedback`)

| Setting | Value |
|---------|-------|
| Similarity threshold | 0.8 |
| Min occurrences for GENERALIZABLE_HIGH | 3 |
| Min reviewers for high confidence | 2 |
| Rule stabilization period | 7 days |
| Rule effectiveness threshold | 10% improvement |
| Max rules per agent | 20 |
| Auto-archive ineffective rules after | 30 days |

Actions:
- View pending rule proposals
- View active rules by agent
- View edge case archive
- Export feedback data
- Reset learning (caution)

---

## Navigation & Route Map

### Primary Routes
| Route | Page |
|-------|------|
| `/docs` | Documentation |
| `/cockpit` | Agent Cockpit |
| `/studio/discovery` | Discovery Chat |
| `/studio/design` | Design Chat |
| `/studio/context` | Context Inquiry |
| `/gates` | HITL Gates Queue |
| `/gates/:gate_id` | Gate Detail |
| `/artifacts` | Artifact Explorer |
| `/artifacts/spec-index` | Spec Index Browser |
| `/artifacts/context-packs` | Context Pack Inspector |
| `/artifacts/:artifact_id` | Artifact Detail |
| `/budget` | Budget Dashboard |
| `/budget/reports` | Reports |
| `/budget/learning` | Learning Effectiveness |
| `/admin` | Admin Overview |
| `/admin/environments` | Environment Config |
| `/admin/agents` | Agent Registry |
| `/admin/tools` | Tool Registry |
| `/admin/knowledge` | Knowledge Store |
| `/admin/security` | Security & Access |
| `/admin/policy` | Policy Settings |
| `/admin/feedback` | Feedback Learning Config |

### Secondary Routes (Deep Links)
| Route | Target |
|-------|--------|
| `/runs` | Runs List (in Cockpit) |
| `/runs/:run_id` | Run Detail |
| `/feedback/:feedback_id` | Feedback Record |
| `/rules/:rule_id` | Rule Detail |

---

## Cross-Cutting UI Components

### Core Components
| Component | Description |
|-----------|-------------|
| MarkdownRenderer | Render markdown with diff mode, syntax highlighting |
| EvidenceBundleViewer | Display test results, diffs, reports |
| WorkflowGraphViewer | Sankey/node graph for workflow visualization |
| RunTimeline | Chronological events and tool calls |
| ArtifactCard | Preview, validate, export, submit actions |
| PolicyBadge | Shows active guardrails for current context |
| FeedbackCapture | Structured feedback form for HITL decisions |
| RLMTrajectoryViewer | Hierarchical view of RLM subcalls |
| ContextPackPreview | File list with relevance and token counts |
| GitStatusIndicator | Current branch, SHA, pending commits |
| LiveEventFeed | WebSocket-driven event stream |
| RuleProposalCard | Rule proposal with evidence and decision actions |

### Interaction Patterns

#### Immutable Audit Trail
Every action writes an audit event:
```
UI Action → API Call → Event Stream → Persisted Audit Record
```

#### Idempotent Actions
- "Submit to next agent" shows stable request ID
- Prevents duplicate clicks with loading state
- Retry-safe with idempotency keys

#### Optimistic Updates
- UI updates immediately on action
- Rolls back if API call fails
- Shows sync indicator during pending operations

#### Real-Time Updates
- WebSocket connection for live data
- Run status changes reflect immediately
- Gate queue updates in real-time
- Event feed streams continuously

---

## Data Objects

### Core Objects
```typescript
interface Session {
  id: string;
  repo: string;
  environment: 'dev' | 'staging' | 'prod';
  created_by: string;
  current_git_sha: string;
  current_branch: string;
}

interface Epic {
  id: string;
  title: string;
  state: 'discovery' | 'design' | 'development' | 'validation' | 'deployment' | 'complete';
  gates_status: Record<string, GateStatus>;
  budget_consumed: number;
  budget_limit: number;
}

interface Run {
  id: string;
  epic_id: string;
  agent_type: string;
  model: string;
  mode: 'standard' | 'rlm';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked';
  stage: string;
  start_time: string;
  end_time?: string;
  metrics: RunMetrics;
  cost: CostBreakdown;
}

interface AgentInvocation {
  id: string;
  run_id: string;
  agent_type: string;
  model: string;
  mode: 'standard' | 'rlm';
  tool_calls: ToolCall[];
  subcalls?: AgentInvocation[];  // For RLM
  inputs: string[];  // Artifact IDs
  outputs: string[];  // Artifact IDs
  tokens_used: number;
  duration_ms: number;
}

interface Gate {
  id: string;
  type: 'HITL-1' | 'HITL-2' | 'HITL-3' | 'HITL-DEPLOY' | 'HITL-RULE';
  epic_id: string;
  required_artifacts: ArtifactRef[];
  evidence_refs: string[];
  status: 'pending' | 'approved' | 'rejected';
  decision?: GateDecision;
  similar_rejections_count: number;
}

interface Artifact {
  id: string;
  path: string;
  type: 'prd' | 'test_spec' | 'architecture' | 'task' | 'patch' | 'report';
  epic_id: string;
  git_sha: string;
  producing_run_id: string;
  approved_by_gate?: string;
  status: 'draft' | 'pending' | 'approved' | 'superseded';
  validation_status: ValidationResult;
}

interface Worker {
  id: string;
  status: 'idle' | 'busy' | 'draining' | 'offline';
  current_task?: string;
  current_agent?: string;
  model?: string;
  utilization: ResourceMetrics;
}

interface Budget {
  epic_id: string;
  limit_tokens: number;
  limit_usd: number;
  used_tokens: number;
  used_usd: number;
  alerts: BudgetAlert[];
}
```

### Feedback Learning Objects
```typescript
interface Feedback {
  id: string;
  gate_id: string;
  epic_id: string;
  task_id?: string;
  decision: 'approved' | 'rejected' | 'approved_with_changes';
  reviewer_id: string;
  timestamp: string;
  review_duration_seconds: number;
  correction_diff_path?: string;
  reviewer_comment?: string;
  tags: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  agent_output_sha: string;
  approved_output_sha?: string;
}

interface RuleProposal {
  id: string;
  feedback_ids: string[];
  classification: 'generalizable_high' | 'generalizable_low';
  confidence: number;
  affected_agents: string[];
  rule_type: 'negative_example' | 'positive_example' | 'guideline' | 'constraint';
  rule_content: string;
  insertion_point: string;
  evidence_summary: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  decided_at?: string;
  decided_by?: string;
}

interface ActiveRule {
  id: string;
  proposal_id: string;
  affected_agents: string[];
  rule_content: string;
  deployed_at: string;
  effectiveness: RuleEffectiveness;
}

interface RuleEffectiveness {
  rejection_rate_before: number;
  rejection_rate_after: number;
  sample_size_before: number;
  sample_size_after: number;
  improvement_percent: number;
  status: 'stabilizing' | 'effective' | 'ineffective' | 'under_review';
}

interface ContextPack {
  id: string;
  query: string;
  run_id: string;
  files: ContextFile[];
  total_tokens: number;
  created_at: string;
  cache_key: string;
  cache_hits: number;
  expires_at: string;
}

interface ContextFile {
  path: string;
  line_start: number;
  line_end: number;
  relevance_score: number;
  tokens: number;
}
```

---

## MVP Release Scope

### Phase 1: Core Workflow (MVP)
| Page | Priority | Rationale |
|------|----------|-----------|
| HITL Gates | P0 | Core human oversight - must have |
| Agent Cockpit | P0 | Operational visibility - must have |
| Studio (Discovery only) | P0 | Start the pipeline - must have |
| Artifacts (read-only) | P0 | View outputs - must have |

### Phase 2: Enhanced Workflow
| Page | Priority | Rationale |
|------|----------|-----------|
| Studio (Design + Context) | P1 | Complete design workflow |
| Artifacts (full CRUD) | P1 | Manage artifacts |
| Documentation | P1 | Onboarding and training |
| Budget (basic) | P1 | Cost visibility |

### Phase 3: Advanced Features
| Page | Priority | Rationale |
|------|----------|-----------|
| Feedback Learning UI | P2 | Continuous improvement |
| Budget (full reports) | P2 | Detailed analytics |
| Admin (full config) | P2 | Self-service configuration |
| RLM Trajectory Viewer | P2 | Advanced debugging |

### Interim Solutions (Before UI)
| Feature | Interim Solution |
|---------|------------------|
| Documentation | Static markdown in repo |
| Admin config | YAML/JSON config files |
| Budget tracking | CLI dashboard or Grafana |
| Feedback capture | Basic form, no similarity detection |

---

## Appendix: Design Decisions

### Why "Studio" Instead of "Interaction Design"?
- "Interaction Design" sounds like a UX discipline
- "Studio" conveys a workspace for creating artifacts
- Clearer mental model: Discovery Studio, Design Studio

### Why Separate Meta-HITL for Rules?
- System changes require different review than artifact changes
- Higher privilege level (Admin only)
- Different evidence (feedback patterns vs artifacts)
- Separate queue prevents mixing concerns

### Why Track Review Duration?
- Long reviews may indicate confusion or poor evidence
- Short approvals with later rejections indicate rubber-stamping
- Data for improving evidence bundles
- Fairness metric for SLA compliance

### Why Maximum 20 Rules Per Agent?
- Prompt length constraints
- Cognitive load for understanding agent behavior
- Forces consolidation of similar rules
- Prevents rule proliferation over time
