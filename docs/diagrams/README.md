# aSDLC Architecture Diagrams

This folder contains Mermaid diagrams for all aspects of the aSDLC architecture.

## How to Use

### Option 1: Mermaid Live Editor
Copy the `.mmd` file content and paste into [Mermaid Live Editor](https://mermaid.live/)

### Option 2: VS Code Extension
Install the "Mermaid Preview" extension and open `.mmd` files

### Option 3: Generate SVG
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i diagram.mmd -o diagram.svg
```

### Option 4: GitHub/GitLab
Both platforms render Mermaid in markdown automatically:
```markdown
```mermaid
flowchart TD
    A --> B
```                      (close with three backticks)
```

---

## Diagram Index

### High-Level Architecture

| File | Description |
|------|-------------|
| `01-system-architecture.mmd` | Complete system overview with all components |
| `09-kubernetes-topology.mmd` | Kubernetes deployment structure |

### Coordinator & Orchestration

| File | Description |
|------|-------------|
| `02-coordinator-event-loop.mmd` | The Coordinator's main event loop |
| `03-a2a-orchestration-flow.mmd` | Agent-to-Agent transition flow |
| `05-hitl-flow.mmd` | Human-in-the-Loop approval process |

### Agent Internals

| File | Description |
|------|-------------|
| `04-agent-container-internals.mmd` | What's inside each agent container |
| `08-development-tdd-workflow.mmd` | TDD workflow in Development agent |
| `10-mcp-integration.mmd` | MCP tool integration architecture |

### Data & Communication

| File | Description |
|------|-------------|
| `06-rlm-vs-rag-decision.mmd` | When to use RLM vs RAG |
| `07-redis-streams-eventbus.mmd` | Redis Streams event bus structure |

### Sequence Diagrams

| File | Description |
|------|-------------|
| `11-sequence-a2a-transition.mmd` | Step-by-step A2A transition |
| `12-sequence-hitl-flow.mmd` | Step-by-step HITL approval |
| `13-sequence-mcp-calls.mmd` | MCP tool call sequences |

---

## Color Legend

The diagrams use consistent colors:

| Color | Meaning |
|-------|---------|
| 🔵 Blue (`#E6F0FF`, `#D0E8FF`) | Agent containers, Coordinator |
| 🟠 Orange (`#FFF7ED`, `#FEF3C7`) | HITL gates, decisions |
| 🟢 Green (`#DCFCE7`) | Approved, success, A2A auto |
| 🔴 Red (`#FEE2E2`) | Redis, rejected, errors |
| 🟣 Purple (`#F3E8FF`, `#faf5ff`) | Infrastructure, artifacts |
| 🟡 Yellow (`#FEF3C7`) | MCP servers, warnings |

---

## Quick Reference

### Complete Epic Flow
```
Epic Created
    │
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Discovery  │────▶│   Design    │────▶│ Development │
│   (HITL-1)  │     │   (HITL-2)  │     │   (AUTO)    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
    ┌──────────────────────────────────────────┘
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Test     │────▶│  Security   │────▶│  Validator  │
│   (AUTO)    │     │   (AUTO)    │     │   (HITL-5)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │ Deployment  │
                                        │   (HITL-6)  │
                                        └─────────────┘
                                               │
                                               ▼
                                          [Complete]
```

### Coordinator Core Loop
```python
while True:
    events = await redis.xread(streams, block=5000)
    for event in events:
        if event.type == "PhaseCompleted":
            if WORKFLOW[phase].transition == AUTO:
                k8s.create_job(next_agent)
            else:
                redis.xadd("hitl:requests", gate_data)
```
