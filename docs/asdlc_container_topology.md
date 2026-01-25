# aSDLC Container Topology & Coordination

## Container Types and Their Roles

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               aSDLC CONTAINER TOPOLOGY                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            ALWAYS RUNNING (Kubernetes Deployments)                         │ │
│  │                                                                                             │ │
│  │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │ │
│  │   │   Coordinator   │  │  HITL Gateway   │  │  Git Gateway    │  │   SPA Server    │     │ │
│  │   │   (Python)      │  │  (FastAPI)      │  │  (Python)       │  │   (Next.js)     │     │ │
│  │   │                 │  │                 │  │                 │  │                 │     │ │
│  │   │ • Redis Streams │  │ • WebSocket     │  │ • GitPython     │  │ • React UI      │     │ │
│  │   │ • Phase routing │  │ • REST API      │  │ • Artifacts     │  │ • HITL Review   │     │ │
│  │   │ • Container mgmt│  │ • Auth          │  │ • Versioning    │  │ • Dashboards    │     │ │
│  │   └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘     │ │
│  │                                                                                             │ │
│  │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                           │ │
│  │   │ Evaluator Svc   │  │ Security Svc    │  │  RLM Service    │                           │ │
│  │   │ (Client SDK)    │  │ (Client SDK)    │  │  (Messages API) │                           │ │
│  │   │                 │  │                 │  │                 │                           │ │
│  │   │ • Feedback eval │  │ • SAST/SCA      │  │ • Ext. Thinking │                           │ │
│  │   │ • Rule proposal │  │ • Vuln scanning │  │ • Prompt cache  │                           │ │
│  │   │ • Pattern detect│  │ • Compliance    │  │ • Deep analysis │                           │ │
│  │   └─────────────────┘  └─────────────────┘  └─────────────────┘                           │ │
│  │                                                                                             │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                          EPHEMERAL (Kubernetes Jobs / Pods)                                │ │
│  │                                                                                             │ │
│  │   ┌───────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │   │                      AGENT SDK CONTAINERS (Claude Code as Library)                 │   │ │
│  │   │                                                                                     │   │ │
│  │   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │ │
│  │   │   │  Discovery  │  │   Design    │  │ Development │  │    Test     │             │   │ │
│  │   │   │   Agent     │  │   Agent     │  │   Agent     │  │   Agent     │             │   │ │
│  │   │   │             │  │             │  │             │  │             │             │   │ │
│  │   │   │ Subagents:  │  │ Subagents:  │  │ Subagents:  │  │ Subagents:  │             │   │ │
│  │   │   │ • PRD       │  │ • Surveyor  │  │ • Test-first│  │ • E2E       │             │   │ │
│  │   │   │ • Acceptance│  │ • Architect │  │ • Implement │  │ • Regression│             │   │ │
│  │   │   │ • UI/UX     │  │ • Planner   │  │ • Debugger  │  │ • Perf      │             │   │ │
│  │   │   │             │  │             │  │ • Reviewer  │  │             │             │   │ │
│  │   │   │ Skills:     │  │ Skills:     │  │ Skills:     │  │ Skills:     │             │   │ │
│  │   │   │ • prd-write │  │ • arch-doc  │  │ • tdd-flow  │  │ • test-gen  │             │   │ │
│  │   │   │ • spec-fmt  │  │ • task-plan │  │ • debug     │  │ • coverage  │             │   │ │
│  │   │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘             │   │ │
│  │   │                                                                                     │   │ │
│  │   │   Built-in Tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch        │   │ │
│  │   │   MCP Tools: Git, Jira, Slack (via MCP servers)                                   │   │ │
│  │   │   Hooks: PreToolUse, PostToolUse (for HITL integration)                           │   │ │
│  │   └───────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                                             │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              MCP TOOL SERVERS (Sidecar/External)                           │ │
│  │                                                                                             │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │   │   Git MCP   │  │  Jira MCP   │  │  Slack MCP  │  │ Browser MCP │  │  Custom MCP │   │ │
│  │   │   (stdio)   │  │   (SSE)     │  │   (SSE)     │  │  (stdio)    │  │   (http)    │   │ │
│  │   │             │  │             │  │             │  │             │  │             │   │ │
│  │   │ • commit    │  │ • create    │  │ • post_msg  │  │ • navigate  │  │ • custom    │   │ │
│  │   │ • branch    │  │ • update    │  │ • read_ch   │  │ • screenshot│  │ • tooling   │   │ │
│  │   │ • diff      │  │ • transition│  │ • search    │  │ • click     │  │             │   │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  │                                                                                             │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                     INFRASTRUCTURE                                         │ │
│  │                                                                                             │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │   │   Redis     │  │ PostgreSQL  │  │    Git      │  │  ChromaDB   │  │   MinIO     │   │ │
│  │   │  (Streams)  │  │   (State)   │  │   (Repos)   │  │ (Embeddings)│  │  (Blobs)    │   │ │
│  │   │             │  │             │  │             │  │             │  │             │   │ │
│  │   │ • Events    │  │ • Epics     │  │ • Artifacts │  │ • RAG       │  │ • Large     │   │ │
│  │   │ • Queues    │  │ • Gates     │  │ • Specs     │  │ • Codebase  │  │   files     │   │ │
│  │   │ • Pub/Sub   │  │ • Feedback  │  │ • History   │  │ • Docs      │  │             │   │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  │                                                                                             │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Event Flow: Epic Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    EPIC LIFECYCLE EVENT FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   User creates Epic                                                                              │
│         │                                                                                        │
│         ▼                                                                                        │
│   ┌─────────────┐     ┌─────────────────────────────────────────────────────────────────────┐  │
│   │ SPA Gateway │────▶│ Redis Stream: asdlc:events:epic                                      │  │
│   └─────────────┘     │ Event: EpicCreated { epic_id, brief, repo_url, requestor }          │  │
│                       └─────────────────────────────────────────────────────────────────────┘  │
│                                        │                                                        │
│                                        ▼                                                        │
│                       ┌─────────────────────────────────────────────────────────────────────┐  │
│                       │ Coordinator (consumer group: coordinator-1)                          │  │
│                       │ Action: Spawn Discovery container                                    │  │
│                       └─────────────────────────────────────────────────────────────────────┘  │
│                                        │                                                        │
│         ┌──────────────────────────────┼──────────────────────────────────────┐               │
│         ▼                              ▼                                      ▼               │
│   ┌───────────────┐          ┌───────────────┐                      ┌───────────────┐        │
│   │  Discovery    │          │  Git Gateway  │                      │  HITL Gateway │        │
│   │  Container    │          │  (clone repo) │                      │  (gate ready) │        │
│   │               │          │               │                      │               │        │
│   │  Agent SDK    │◀────────▶│  Artifacts    │                      │  WebSocket    │        │
│   │  query()      │          │  Stored       │                      │  to SPA       │        │
│   └───────────────┘          └───────────────┘                      └───────────────┘        │
│         │                                                                   │                 │
│         │ Artifacts: PRD.md, test_specs.md                                 │                 │
│         ▼                                                                   ▼                 │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │ Redis Stream: asdlc:phase:discovery                                                      │ │
│   │ Event: PhaseCompleted { epic_id, phase: discovery, artifacts: [...] }                   │ │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                                       │
│                                        ▼                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │ Redis Stream: asdlc:hitl:requests                                                        │ │
│   │ Event: GateRequired { epic_id, gate: HITL-1, evidence: [PRD.md, test_specs.md] }        │ │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                                       │
│                                        ▼                                                       │
│   ┌───────────────┐          ┌─────────────────────────────────────────────────────────────┐ │
│   │  HITL Gateway │◀─────────│ Human reviews in SPA, clicks Approve                        │ │
│   │               │          │                                                              │ │
│   │  Decision     │          │ Feedback captured: { approved: true, comments: "...",       │ │
│   │  recorded     │          │                      time_spent: 420s, edits: null }        │ │
│   └───────────────┘          └─────────────────────────────────────────────────────────────┘ │
│         │                                                                                      │
│         ▼                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │ Redis Stream: asdlc:hitl:decisions                                                       │ │
│   │ Event: GateApproved { epic_id, gate: HITL-1, feedback_id: FB-123 }                      │ │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                                       │
│         ┌──────────────────────────────┴──────────────────────────────────────┐              │
│         ▼                                                                      ▼              │
│   ┌───────────────┐                                                    ┌───────────────┐     │
│   │  Coordinator  │                                                    │  Evaluator    │     │
│   │               │                                                    │  Service      │     │
│   │  Start Design │                                                    │               │     │
│   │  Phase        │                                                    │  Async        │     │
│   └───────────────┘                                                    │  feedback     │     │
│         │                                                              │  analysis     │     │
│         ▼                                                              └───────────────┘     │
│   [Continue to Design → Development → Validation → Deployment]                               │
│                                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Agent SDK Container Internal Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           AGENT SDK CONTAINER INTERNAL ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   Container: asdlc/development-agent                                                             │
│                                                                                                  │
│   ┌────────────────────────────────────────────────────────────────────────────────────────────┐│
│   │                                    AGENT RUNNER                                             ││
│   │                                                                                             ││
│   │   from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition, HookMatcher    ││
│   │                                                                                             ││
│   │   options = ClaudeAgentOptions(                                                            ││
│   │       cwd="/workspace",                                                                    ││
│   │       setting_sources=["project"],        # Load .claude/CLAUDE.md and skills             ││
│   │       allowed_tools=[                                                                      ││
│   │           "Read", "Write", "Edit", "Bash", "Glob", "Grep",  # Built-in                    ││
│   │           "Task",  # Enables subagents                                                     ││
│   │           "mcp__git__commit", "mcp__git__branch"  # MCP tools                             ││
│   │       ],                                                                                   ││
│   │       permission_mode="acceptEdits",      # Auto-approve file changes                     ││
│   │       enable_file_checkpointing=True,     # Enable rollback                               ││
│   │       mcp_servers={                                                                        ││
│   │           "git": {"type": "stdio", "command": "mcp-server-git", "args": [...]}           ││
│   │       },                                                                                   ││
│   │       agents={                            # Define subagents                              ││
│   │           "test-first": AgentDefinition(...),                                             ││
│   │           "implementer": AgentDefinition(...),                                            ││
│   │           "debugger": AgentDefinition(model="opus")  # Use Opus for hard problems        ││
│   │       },                                                                                   ││
│   │       hooks={                             # HITL integration                              ││
│   │           "PreToolUse": [HookMatcher(matcher="Write|Edit", hooks=[validate_path])],      ││
│   │           "PostToolUse": [HookMatcher(hooks=[log_artifact])],                            ││
│   │           "Stop": [HookMatcher(hooks=[notify_completion])]                               ││
│   │       }                                                                                    ││
│   │   )                                                                                        ││
│   │                                                                                             ││
│   │   async for message in query(prompt=TASK_SPEC, options=options):                          ││
│   │       emit_to_redis(message)  # Stream to coordinator                                     ││
│   │                                                                                             ││
│   └────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                  │
│   ┌────────────────────────────────────────────────────────────────────────────────────────────┐│
│   │                                    FILESYSTEM                                               ││
│   │                                                                                             ││
│   │   /workspace/                      (mounted from host, Git repo)                           ││
│   │   ├── .claude/                                                                              ││
│   │   │   ├── CLAUDE.md               # Project context, coding standards                      ││
│   │   │   ├── skills/                                                                          ││
│   │   │   │   ├── tdd-workflow/SKILL.md                                                        ││
│   │   │   │   └── code-review/SKILL.md                                                         ││
│   │   │   └── agents/                                                                          ││
│   │   │       └── debugger.md         # File-based agent definition (alternative)             ││
│   │   ├── src/                                                                                  ││
│   │   ├── tests/                                                                                ││
│   │   └── docs/                                                                                 ││
│   │                                                                                             ││
│   │   /outputs/                        (mounted, for results)                                  ││
│   │   ├── results.json                # Final status                                          ││
│   │   ├── artifacts/                  # Created/modified files                                ││
│   │   └── logs/                       # Execution logs                                        ││
│   │                                                                                             ││
│   └────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## RLM vs RAG Decision Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    RLM vs RAG DECISION FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   Problem arrives                                                                                │
│         │                                                                                        │
│         ▼                                                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ Does the problem require FINDING EXISTING INFORMATION in the codebase/docs?             │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│         │                                                                                        │
│         ├── YES ─────────────────────────────────────────────────────────────────┐              │
│         │                                                                         ▼              │
│         │                                              ┌───────────────────────────────────────┐│
│         │                                              │ RAG SERVICE (Messages API)            ││
│         │                                              │                                        ││
│         │                                              │ • ChromaDB for embeddings             ││
│         │                                              │ • Prompt caching (90% cost reduction) ││
│         │                                              │ • Simple retrieval + summarization    ││
│         │                                              │                                        ││
│         │                                              │ Cost: ~$0.10 per query (cached)       ││
│         │                                              └───────────────────────────────────────┘│
│         │                                                                                        │
│         │                                                                                        │
│         └── NO ──────────────────────────────────────────────────────────────────┐              │
│                                                                                   ▼              │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ Does the problem require DEEP REASONING (architecture, debugging, design trade-offs)?   │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│         │                                                                                        │
│         ├── YES ─────────────────────────────────────────────────────────────────┐              │
│         │                                                                         ▼              │
│         │                                              ┌───────────────────────────────────────┐│
│         │                                              │ RLM SERVICE (Messages API)            ││
│         │                                              │                                        ││
│         │                                              │ • Extended Thinking enabled           ││
│         │                                              │ • budget_tokens: 5000-20000           ││
│         │                                              │ • Deep analysis before responding     ││
│         │                                              │                                        ││
│         │                                              │ Use cases:                            ││
│         │                                              │ • Architecture decisions              ││
│         │                                              │ • Complex debugging                   ││
│         │                                              │ • Trade-off analysis                  ││
│         │                                              │ • Security vulnerability analysis     ││
│         │                                              │                                        ││
│         │                                              │ Cost: ~$0.50-2.00 per query           ││
│         │                                              └───────────────────────────────────────┘│
│         │                                                                                        │
│         │                                                                                        │
│         └── NO ──────────────────────────────────────────────────────────────────┐              │
│                                                                                   ▼              │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ Does the problem require TAKING ACTIONS (files, code, commands)?                        │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│         │                                                                                        │
│         ├── YES ─────────────────────────────────────────────────────────────────┐              │
│         │                                                                         ▼              │
│         │                                              ┌───────────────────────────────────────┐│
│         │                                              │ AGENT SDK CONTAINER                   ││
│         │                                              │                                        ││
│         │                                              │ • Built-in tools (Read, Write, Bash)  ││
│         │                                              │ • Subagents for specialization        ││
│         │                                              │ • Skills for domain knowledge         ││
│         │                                              │ • File checkpointing for rollback     ││
│         │                                              │                                        ││
│         │                                              │ Use cases:                            ││
│         │                                              │ • PRD writing                         ││
│         │                                              │ • Code implementation                 ││
│         │                                              │ • Test writing                        ││
│         │                                              │ • Bug fixing                          ││
│         │                                              │                                        ││
│         │                                              │ Cost: ~$0.50-5.00 per task            ││
│         │                                              └───────────────────────────────────────┘│
│         │                                                                                        │
│         │                                                                                        │
│         └── NO ──────────────────────────────────────────────────────────────────┐              │
│                                                                                   ▼              │
│                                                        ┌───────────────────────────────────────┐│
│                                                        │ CLIENT SDK (Structured I/O)           ││
│                                                        │                                        ││
│                                                        │ • Simple inference                    ││
│                                                        │ • Structured output (JSON)            ││
│                                                        │ • No tool use needed                  ││
│                                                        │                                        ││
│                                                        │ Use cases:                            ││
│                                                        │ • Feedback classification             ││
│                                                        │ • Text summarization                  ││
│                                                        │ • Format conversion                   ││
│                                                        │                                        ││
│                                                        │ Cost: ~$0.01-0.10 per call            ││
│                                                        └───────────────────────────────────────┘│
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Kubernetes Deployment Manifest (Example)

```yaml
# k8s/deployments.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: asdlc-coordinator
spec:
  replicas: 2
  selector:
    matchLabels:
      app: asdlc-coordinator
  template:
    metadata:
      labels:
        app: asdlc-coordinator
    spec:
      containers:
      - name: coordinator
        image: asdlc/coordinator:latest
        env:
        - name: REDIS_URL
          value: "redis://redis:6379"
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: anthropic-secret
              key: api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
apiVersion: batch/v1
kind: Job
metadata:
  name: agent-job-template
spec:
  template:
    spec:
      containers:
      - name: agent
        image: asdlc/development-agent:latest
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: anthropic-secret
              key: api-key
        - name: TASK_JSON
          value: "${TASK_JSON}"
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        - name: outputs
          mountPath: /outputs
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: repo-pvc
      - name: outputs
        emptyDir: {}
      restartPolicy: Never
  backoffLimit: 2
```

## Summary: Technology Selection

| Component | Technology | Why |
|-----------|-----------|-----|
| **Discovery Agent** | Agent SDK | File creation, subagents for parallel PRD/acceptance |
| **Design Agent** | Agent SDK | Architecture docs, task planning with codebase analysis |
| **Development Agent** | Agent SDK | TDD workflow, coding, debugging with checkpointing |
| **Test Agent** | Agent SDK | E2E test execution, Bash for running test suites |
| **Evaluator Service** | Client SDK | Structured I/O, no file ops, pattern matching |
| **Security Scanner** | Client SDK | Code analysis, structured vulnerability output |
| **RLM Service** | Messages API | Extended thinking for deep analysis |
| **RAG Service** | Messages API | Prompt caching for repeated codebase context |
| **Batch Processor** | Messages API | 50% discount for bulk reviews |
| **MCP Servers** | MCP Protocol | Tool abstraction for Git, Jira, Slack |
