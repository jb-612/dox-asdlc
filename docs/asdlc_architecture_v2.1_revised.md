# aSDLC Revised Architecture v2.1

## Addressing Key Design Questions

### Q1: Why Agent SDK (Claude Code CLI) for All Agents?

**Answer: YES - Use Agent SDK for ALL agents that interact with files/code**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED AGENT SDK ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Agent SDK = Claude Code CLI as a Library                                           │
│                                                                                      │
│   ┌───────────────────────────────────────────────────────────────────────────────┐ │
│   │                          ALL AGENTIC CONTAINERS                               │ │
│   │                                                                                │ │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │ │
│   │   │  Discovery  │  │   Design    │  │ Development │  │    Test     │        │ │
│   │   │   Agent     │  │   Agent     │  │   Agent     │  │   Agent     │        │ │
│   │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │ │
│   │                                                                                │ │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │ │
│   │   │  Validator  │  │  Security   │  │  Evaluator  │  │  Reviewer   │        │ │
│   │   │   Agent     │  │   Agent     │  │   Agent     │  │   Agent     │        │ │
│   │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │ │
│   │                                                                                │ │
│   │   ALL use: claude_agent_sdk.query() with built-in tools + custom MCP tools   │ │
│   └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│   Why Agent SDK for everything?                                                      │
│   ✓ Built-in tools (Read, Write, Bash, Glob, Grep)                                  │
│   ✓ Subagents for delegation                                                        │
│   ✓ Skills for domain expertise                                                     │
│   ✓ Hooks for HITL integration                                                      │
│   ✓ Sessions for state management                                                   │
│   ✓ File checkpointing for rollback                                                 │
│   ✓ Todo tracking for progress                                                      │
│   ✓ Structured output via output_format                                             │
│   ✓ Custom tools via MCP                                                            │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Q2: How RLM/RAG/Batch Integrate Back into Agents?

**Answer: Via Custom MCP Tools that wrap API services**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    RLM/RAG/BATCH AS MCP TOOL SERVICES                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Agent SDK Container                    MCP Tool Servers (Internal Services)        │
│   ┌─────────────────────┐               ┌─────────────────────────────────────────┐ │
│   │                     │               │                                          │ │
│   │  Design Agent       │  MCP calls    │  ┌─────────────────────────────────────┐│ │
│   │  ┌───────────────┐  │───────────────│─▶│ RLM MCP Server                      ││ │
│   │  │ "I need deep  │  │               │  │                                      ││ │
│   │  │ analysis of   │  │               │  │ Tool: mcp__rlm__deep_analyze        ││ │
│   │  │ trade-offs"   │  │               │  │                                      ││ │
│   │  └───────────────┘  │               │  │ Internally calls Messages API        ││ │
│   │         │           │               │  │ with Extended Thinking enabled       ││ │
│   │         ▼           │               │  │                                      ││ │
│   │  Uses tool:         │               │  │ Returns: deep analysis result       ││ │
│   │  mcp__rlm__analyze  │               │  └─────────────────────────────────────┘│ │
│   │                     │               │                                          │ │
│   │  ┌───────────────┐  │               │  ┌─────────────────────────────────────┐│ │
│   │  │ "What does    │  │───────────────│─▶│ RAG MCP Server                      ││ │
│   │  │ codebase say  │  │               │  │                                      ││ │
│   │  │ about auth?"  │  │               │  │ Tool: mcp__rag__query               ││ │
│   │  └───────────────┘  │               │  │                                      ││ │
│   │         │           │               │  │ Internally:                         ││ │
│   │         ▼           │               │  │ - Embeddings lookup (ChromaDB)      ││ │
│   │  Uses tool:         │               │  │ - Messages API with prompt cache    ││ │
│   │  mcp__rag__query    │               │  │                                      ││ │
│   │                     │               │  │ Returns: relevant context + summary ││ │
│   │                     │               │  └─────────────────────────────────────┘│ │
│   └─────────────────────┘               │                                          │ │
│                                         └─────────────────────────────────────────┘ │
│                                                                                      │
│   The Agent autonomously decides when to call RLM vs RAG vs use built-in tools      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Q3: Streaming & Redis Integration

**Answer: Agent Runner wrapper connects Agent SDK streaming to Redis Streams**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    AGENT RUNNER: STREAMING TO REDIS                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Container: Agent SDK + Runner Wrapper                                              │
│                                                                                      │
│   ┌────────────────────────────────────────────────────────────────────────────────┐│
│   │                         AGENT RUNNER (Python)                                  ││
│   │                                                                                 ││
│   │   import asyncio                                                               ││
│   │   import redis.asyncio as redis                                                ││
│   │   from claude_agent_sdk import query, ClaudeAgentOptions                       ││
│   │                                                                                 ││
│   │   class AgentRunner:                                                           ││
│   │       def __init__(self, redis_url: str):                                      ││
│   │           self.redis = redis.from_url(redis_url)                               ││
│   │           self.stream_key = "asdlc:agent:events"                               ││
│   │                                                                                 ││
│   │       async def run(self, task: dict, options: ClaudeAgentOptions):            ││
│   │           """Run agent and stream all messages to Redis"""                     ││
│   │                                                                                 ││
│   │           # Agent SDK streaming                                                ││
│   │           async for message in query(                                          ││
│   │               prompt=task["spec"],                                             ││
│   │               options=options                                                  ││
│   │           ):                                                                   ││
│   │               # Publish each message to Redis Stream                           ││
│   │               await self.redis.xadd(                                           ││
│   │                   self.stream_key,                                             ││
│   │                   {                                                            ││
│   │                       "task_id": task["id"],                                   ││
│   │                       "message_type": type(message).__name__,                  ││
│   │                       "payload": json.dumps(serialize_message(message))        ││
│   │                   }                                                            ││
│   │               )                                                                ││
│   │                                                                                 ││
│   │               # Handle ResultMessage (completion)                              ││
│   │               if isinstance(message, ResultMessage):                           ││
│   │                   await self.publish_completion(task, message)                 ││
│   │                                                                                 ││
│   │       async def publish_completion(self, task, result):                        ││
│   │           await self.redis.xadd(                                               ││
│   │               "asdlc:phase:completed",                                         ││
│   │               {                                                                ││
│   │                   "epic_id": task["epic_id"],                                  ││
│   │                   "phase": task["phase"],                                      ││
│   │                   "status": "success" if not result.is_error else "failed",   ││
│   │                   "cost_usd": result.total_cost_usd,                           ││
│   │                   "session_id": result.session_id                              ││
│   │               }                                                                ││
│   │           )                                                                    ││
│   │                                                                                 ││
│   └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│   Stream Flow:                                                                       │
│                                                                                      │
│   Agent SDK query()  ──stream──▶  Agent Runner  ──xadd──▶  Redis Stream            │
│                                        │                        │                    │
│                                        │                        ▼                    │
│                                        │              ┌─────────────────┐           │
│                                        │              │ Coordinator     │           │
│                                        │              │ (Consumer)      │           │
│                                        │              └─────────────────┘           │
│                                        │                        │                    │
│                                        │                        ▼                    │
│                                        │              ┌─────────────────┐           │
│                                        │              │ HITL Gateway    │           │
│                                        │              │ (Consumer)      │           │
│                                        │              └─────────────────┘           │
│                                        │                        │                    │
│                                        │                        ▼                    │
│                                        │              ┌─────────────────┐           │
│                                        └──────────────│ SPA (WebSocket) │           │
│                                                       └─────────────────┘           │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Q4: Where to Use Claude Todo List?

**Answer: Development Agent for tracking TDD workflow steps**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    TODO TRACKING IN DEVELOPMENT AGENT                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   TodoWrite tool is built into Agent SDK - perfect for multi-step tasks             │
│                                                                                      │
│   Development Agent Task: "Implement OAuth token refresh"                            │
│                                                                                      │
│   ┌────────────────────────────────────────────────────────────────────────────────┐│
│   │ Agent creates todo list at start:                                              ││
│   │                                                                                 ││
│   │ TodoWrite([                                                                    ││
│   │   {content: "Read task spec and understand requirements", status: "pending"},  ││
│   │   {content: "Write failing test for token refresh", status: "pending"},        ││
│   │   {content: "Implement refresh logic", status: "pending"},                     ││
│   │   {content: "Run tests and verify green", status: "pending"},                  ││
│   │   {content: "Refactor and clean up", status: "pending"},                       ││
│   │   {content: "Update documentation", status: "pending"},                        ││
│   │   {content: "Commit changes", status: "pending"}                               ││
│   │ ])                                                                             ││
│   └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│   As agent progresses:                                                               │
│                                                                                      │
│   ┌────────────────────────────────────────────────────────────────────────────────┐│
│   │ [✓] Read task spec and understand requirements                                 ││
│   │ [✓] Write failing test for token refresh                                       ││
│   │ [→] Implement refresh logic                      ◀── in_progress              ││
│   │ [ ] Run tests and verify green                                                 ││
│   │ [ ] Refactor and clean up                                                      ││
│   │ [ ] Update documentation                                                       ││
│   │ [ ] Commit changes                                                             ││
│   └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│   Benefits:                                                                          │
│   • Agent maintains focus on current step                                            │
│   • Progress visible in real-time via Redis stream                                   │
│   • Recovery possible - resume from last completed step                              │
│   • HITL can see progress in SPA dashboard                                           │
│                                                                                      │
│   Where to use:                                                                      │
│   • Development Agent: TDD workflow steps                                            │
│   • Design Agent: Architecture decision steps                                        │
│   • Validation Agent: Test suite execution steps                                     │
│   • Security Agent: Scan checklist items                                             │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Revised Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            aSDLC COMPLETE ARCHITECTURE v2.1                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              USER INTERFACE LAYER                                          │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────────────┐ │ │
│  │  │   SPA (Next.js)                                                                       │ │ │
│  │  │   • Epic creation/management                                                          │ │ │
│  │  │   • HITL review interface (approve/reject/comment)                                    │ │ │
│  │  │   • Real-time agent progress (WebSocket from Redis)                                   │ │ │
│  │  │   • Todo list visualization                                                           │ │ │
│  │  │   • Artifact viewer (PRD, code diffs, test results)                                   │ │ │
│  │  └──────────────────────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                              │                                                   │
│                                              ▼                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                           ORCHESTRATION LAYER (Always Running)                             │ │
│  │                                                                                             │ │
│  │   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                        │ │
│  │   │ Workflow         │  │ HITL Gateway     │  │ Git Gateway      │                        │ │
│  │   │ Coordinator      │  │                  │  │                  │                        │ │
│  │   │                  │  │ • REST API       │  │ • Clone repos    │                        │ │
│  │   │ • Redis consumer │  │ • WebSocket      │  │ • Store artifacts│                        │ │
│  │   │ • Spawn Jobs     │  │ • Gate mgmt      │  │ • Version control│                        │ │
│  │   │ • Phase routing  │  │ • Feedback       │  │                  │                        │ │
│  │   └──────────────────┘  └──────────────────┘  └──────────────────┘                        │ │
│  │                                                                                             │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                              │                                                   │
│                                              ▼                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                        MCP TOOL SERVERS (Always Running Services)                          │ │
│  │                                                                                             │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │   │ RLM MCP     │  │ RAG MCP     │  │ Git MCP     │  │ Jira MCP    │  │ Slack MCP   │    │ │
│  │   │ Server      │  │ Server      │  │ Server      │  │ Server      │  │ Server      │    │ │
│  │   │             │  │             │  │             │  │             │  │             │    │ │
│  │   │ Extended    │  │ ChromaDB +  │  │ Git ops     │  │ Issue mgmt  │  │ Notifs      │    │ │
│  │   │ Thinking    │  │ Prompt      │  │             │  │             │  │             │    │ │
│  │   │ API calls   │  │ Caching     │  │             │  │             │  │             │    │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │ │
│  │                                                                                             │ │
│  │   Agents call these via: mcp__rlm__analyze, mcp__rag__query, mcp__git__commit, etc.       │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                              │                                                   │
│                                              ▼                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                     AGENT SDK CONTAINERS (Ephemeral Kubernetes Jobs)                       │ │
│  │                                                                                             │ │
│  │   ALL containers use: claude_agent_sdk.query() + Agent Runner wrapper                      │ │
│  │                                                                                             │ │
│  │   ┌───────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │   │                              PHASE AGENTS                                          │   │ │
│  │   │                                                                                    │   │ │
│  │   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │ │
│  │   │   │  Discovery  │  │   Design    │  │ Development │  │    Test     │             │   │ │
│  │   │   │   Agent     │  │   Agent     │  │   Agent     │  │   Agent     │             │   │ │
│  │   │   │             │  │             │  │             │  │             │             │   │ │
│  │   │   │ Subagents:  │  │ Subagents:  │  │ Subagents:  │  │ Subagents:  │             │   │ │
│  │   │   │ • PRD       │  │ • Surveyor  │  │ • Test-first│  │ • E2E       │             │   │ │
│  │   │   │ • Acceptance│  │ • Architect │  │ • Implement │  │ • Regression│             │   │ │
│  │   │   │             │  │ • Planner   │  │ • Debugger  │  │             │             │   │ │
│  │   │   │             │  │             │  │             │  │             │             │   │ │
│  │   │   │ MCP Tools:  │  │ MCP Tools:  │  │ MCP Tools:  │  │ MCP Tools:  │             │   │ │
│  │   │   │ • rag_query │  │ • rlm_analyze│ │ • git_commit│  │ • rag_query │             │   │ │
│  │   │   │ • jira_*    │  │ • rag_query │  │ • rag_query │  │ • jira_*    │             │   │ │
│  │   │   │             │  │             │  │             │  │             │             │   │ │
│  │   │   │ Todo Track: │  │ Todo Track: │  │ Todo Track: │  │ Todo Track: │             │   │ │
│  │   │   │ ✓ Used      │  │ ✓ Used      │  │ ✓ Used      │  │ ✓ Used      │             │   │ │
│  │   │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘             │   │ │
│  │   │                                                                                    │   │ │
│  │   └───────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                                             │ │
│  │   ┌───────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │   │                             QUALITY AGENTS                                         │   │ │
│  │   │                                                                                    │   │ │
│  │   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │ │
│  │   │   │  Validator  │  │  Security   │  │  Evaluator  │  │  Reviewer   │             │   │ │
│  │   │   │   Agent     │  │   Agent     │  │   Agent     │  │   Agent     │             │   │ │
│  │   │   │             │  │             │  │             │  │             │             │   │ │
│  │   │   │ • Run E2E   │  │ • SAST/SCA  │  │ • Feedback  │  │ • Code      │             │   │ │
│  │   │   │ • Report    │  │ • Vuln scan │  │   analysis  │  │   review    │             │   │ │
│  │   │   │             │  │             │  │ • Rule      │  │ • Standards │             │   │ │
│  │   │   │             │  │             │  │   proposals │  │   check     │             │   │ │
│  │   │   │             │  │             │  │             │  │             │             │   │ │
│  │   │   │ MCP Tools:  │  │ MCP Tools:  │  │ MCP Tools:  │  │ MCP Tools:  │             │   │ │
│  │   │   │ • rag_query │  │ • rlm_analyze│ │ • rag_query │  │ • rlm_analyze│            │   │ │
│  │   │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘             │   │ │
│  │   │                                                                                    │   │ │
│  │   └───────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                                             │ │
│  │   Container composition:                                                                   │ │
│  │   ┌────────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │   │ Each container = Agent Runner (Python) + Claude Code CLI runtime                   │  │ │
│  │   │                                                                                     │  │ │
│  │   │ Agent Runner responsibilities:                                                     │  │ │
│  │   │ • Load task from env/file                                                          │  │ │
│  │   │ • Configure Agent SDK options (tools, subagents, hooks, MCP servers)               │  │ │
│  │   │ • Stream messages to Redis via xadd()                                              │  │ │
│  │   │ • Handle completion/failure                                                        │  │ │
│  │   │ • Write artifacts to /outputs                                                      │  │ │
│  │   └────────────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                             │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                              │                                                   │
│                                              ▼                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              REDIS STREAMS (Event Bus)                                     │ │
│  │                                                                                             │ │
│  │   Streams:                                                                                 │ │
│  │   • asdlc:epic:events        - Epic lifecycle (created, updated, completed)               │ │
│  │   • asdlc:phase:discovery    - Discovery phase events                                     │ │
│  │   • asdlc:phase:design       - Design phase events                                        │ │
│  │   • asdlc:phase:development  - Development phase events                                   │ │
│  │   • asdlc:phase:validation   - Validation phase events                                    │ │
│  │   • asdlc:phase:deployment   - Deployment phase events                                    │ │
│  │   • asdlc:hitl:requests      - HITL gate requests                                         │ │
│  │   • asdlc:hitl:decisions     - HITL gate decisions                                        │ │
│  │   • asdlc:agent:progress     - Real-time agent progress (todo updates, tool calls)        │ │
│  │   • asdlc:feedback:events    - Feedback for evaluator                                     │ │
│  │                                                                                             │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                              │                                                   │
│                                              ▼                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                    INFRASTRUCTURE                                          │ │
│  │                                                                                             │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │   │   Redis     │  │ PostgreSQL  │  │    Git      │  │  ChromaDB   │  │   MinIO     │    │ │
│  │   │  (Streams)  │  │   (State)   │  │   (Repos)   │  │ (Embeddings)│  │  (Blobs)    │    │ │
│  │   │             │  │             │  │             │  │             │  │             │    │ │
│  │   │ • Events    │  │ • Epics     │  │ • Artifacts │  │ • Codebase  │  │ • Large     │    │ │
│  │   │ • Pub/Sub   │  │ • Gates     │  │ • Specs     │  │ • Docs      │  │   files     │    │ │
│  │   │             │  │ • Rules     │  │ • History   │  │ • Vectors   │  │             │    │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │ │
│  │                                                                                             │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. RLM MCP Server

```python
# mcp_servers/rlm_server.py

from mcp.server import Server
from mcp.types import Tool, TextContent
import anthropic

app = Server("rlm-server")

@app.tool()
async def deep_analyze(
    problem: str,
    context: str,
    thinking_budget: int = 10000
) -> list[TextContent]:
    """
    Use extended thinking for deep analysis.
    Call this for complex architectural decisions, debugging, or trade-off analysis.
    """
    client = anthropic.AsyncAnthropic()
    
    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=16000,
        thinking={
            "type": "enabled",
            "budget_tokens": thinking_budget
        },
        messages=[{
            "role": "user",
            "content": f"""
            Problem: {problem}
            
            Context: {context}
            
            Analyze deeply. Consider:
            1. Multiple approaches
            2. Trade-offs
            3. Risks
            4. Recommended solution
            """
        }]
    )
    
    # Extract thinking and response
    thinking = ""
    answer = ""
    for block in response.content:
        if block.type == "thinking":
            thinking = block.thinking
        elif block.type == "text":
            answer = block.text
    
    return [TextContent(
        type="text",
        text=f"""## Deep Analysis Result

### Thinking Process
{thinking[:2000]}... [truncated]

### Recommendation
{answer}

### Metadata
- Thinking tokens: {response.usage.thinking_tokens}
- Total cost: ${response.usage.input_tokens * 0.003 / 1000 + response.usage.output_tokens * 0.015 / 1000:.4f}
"""
    )]

if __name__ == "__main__":
    import asyncio
    from mcp.server.stdio import stdio_server
    asyncio.run(stdio_server(app))
```

### 2. RAG MCP Server

```python
# mcp_servers/rag_server.py

from mcp.server import Server
from mcp.types import Tool, TextContent
import anthropic
import chromadb

app = Server("rag-server")

# Persistent connections
chroma = chromadb.HttpClient(host="chromadb", port=8000)
anthropic_client = anthropic.AsyncAnthropic()

# Cached context (using prompt caching)
SYSTEM_CONTEXT = None  # Loaded on first request

@app.tool()
async def query_codebase(
    question: str,
    collection: str = "codebase",
    max_results: int = 10
) -> list[TextContent]:
    """
    Query the codebase using RAG.
    Uses embeddings for retrieval and prompt caching for cost efficiency.
    """
    global SYSTEM_CONTEXT
    
    # Get relevant chunks from ChromaDB
    collection = chroma.get_collection(collection)
    results = collection.query(
        query_texts=[question],
        n_results=max_results
    )
    
    # Build context from results
    context_chunks = "\n\n---\n\n".join([
        f"**File: {meta['file_path']}**\n```\n{doc}\n```"
        for doc, meta in zip(results['documents'][0], results['metadatas'][0])
    ])
    
    # Query with prompt caching
    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=4000,
        system=[
            {
                "type": "text",
                "text": "You are a codebase expert. Answer questions based on the retrieved context."
            },
            {
                "type": "text",
                "text": context_chunks,
                "cache_control": {"type": "ephemeral"}  # 5-min cache
            }
        ],
        messages=[{
            "role": "user",
            "content": question
        }]
    )
    
    usage = response.usage
    cache_status = "HIT" if usage.cache_read_input_tokens > 0 else "MISS"
    
    return [TextContent(
        type="text",
        text=f"""## RAG Query Result

{response.content[0].text}

### Sources
{chr(10).join([f"- {m['file_path']}" for m in results['metadatas'][0]])}

### Cache Status: {cache_status}
- Cached tokens: {usage.cache_read_input_tokens}
- New tokens: {usage.input_tokens}
"""
    )]

if __name__ == "__main__":
    import asyncio
    from mcp.server.stdio import stdio_server
    asyncio.run(stdio_server(app))
```

### 3. Agent Runner with Redis Streaming

```python
# agent_runner/runner.py

import asyncio
import json
import os
from datetime import datetime
from typing import AsyncIterator

import redis.asyncio as redis
from claude_agent_sdk import (
    query, 
    ClaudeAgentOptions, 
    AgentDefinition,
    HookMatcher,
    AssistantMessage,
    ResultMessage,
    ToolUseBlock,
    TextBlock
)

class AgentRunner:
    def __init__(self):
        self.redis = redis.from_url(os.environ["REDIS_URL"])
        self.task = json.loads(os.environ["TASK_JSON"])
        self.agent_type = os.environ["AGENT_TYPE"]
        
    async def run(self):
        """Main entry point - run agent and stream to Redis"""
        
        options = self.build_options()
        
        # Track progress
        progress_stream = f"asdlc:agent:progress:{self.task['id']}"
        
        async for message in query(
            prompt=self.task["spec"],
            options=options
        ):
            # Serialize and publish to Redis
            event = self.serialize_message(message)
            await self.redis.xadd(progress_stream, event)
            
            # Handle completion
            if isinstance(message, ResultMessage):
                await self.handle_completion(message)
    
    def build_options(self) -> ClaudeAgentOptions:
        """Build agent options based on agent type"""
        
        # Common MCP servers all agents can use
        mcp_servers = {
            "rlm": {
                "type": "stdio",
                "command": "python",
                "args": ["/mcp_servers/rlm_server.py"]
            },
            "rag": {
                "type": "stdio", 
                "command": "python",
                "args": ["/mcp_servers/rag_server.py"]
            },
            "git": {
                "type": "stdio",
                "command": "mcp-server-git",
                "args": ["--repository", "/workspace"]
            }
        }
        
        # Agent-specific configuration
        if self.agent_type == "development":
            return ClaudeAgentOptions(
                cwd="/workspace",
                setting_sources=["project"],
                allowed_tools=[
                    "Read", "Write", "Edit", "Bash", "Glob", "Grep",
                    "Task", "TodoWrite",
                    "mcp__rlm__deep_analyze",
                    "mcp__rag__query_codebase",
                    "mcp__git__commit", "mcp__git__branch"
                ],
                permission_mode="acceptEdits",
                enable_file_checkpointing=True,
                mcp_servers=mcp_servers,
                agents={
                    "test-first": AgentDefinition(
                        description="Write failing tests before implementation",
                        prompt="You implement TDD. Write a failing test first.",
                        tools=["Read", "Write", "Bash"],
                        model="sonnet"
                    ),
                    "implementer": AgentDefinition(
                        description="Implement code to pass tests",
                        prompt="Implement minimal code to pass the test.",
                        tools=["Read", "Write", "Edit", "Bash"],
                        model="sonnet"
                    ),
                    "debugger": AgentDefinition(
                        description="Debug complex failures",
                        prompt="You are a debugging expert. Analyze and fix.",
                        tools=["Read", "Write", "Edit", "Bash", "Grep", "mcp__rlm__deep_analyze"],
                        model="opus"  # Use Opus for hard problems
                    )
                },
                hooks={
                    "PostToolUse": [HookMatcher(hooks=[self.log_tool_use])],
                    "Stop": [HookMatcher(hooks=[self.on_completion])]
                }
            )
        
        elif self.agent_type == "design":
            return ClaudeAgentOptions(
                cwd="/workspace",
                setting_sources=["project"],
                allowed_tools=[
                    "Read", "Write", "Glob", "Grep",
                    "Task", "TodoWrite",
                    "mcp__rlm__deep_analyze",  # For architecture decisions
                    "mcp__rag__query_codebase"  # For codebase understanding
                ],
                permission_mode="acceptEdits",
                mcp_servers=mcp_servers,
                agents={
                    "surveyor": AgentDefinition(
                        description="Survey existing codebase architecture",
                        prompt="Analyze the codebase structure and patterns.",
                        tools=["Read", "Glob", "Grep", "mcp__rag__query_codebase"]
                    ),
                    "architect": AgentDefinition(
                        description="Design system architecture",
                        prompt="Design architecture for the requirements.",
                        tools=["Read", "Write", "mcp__rlm__deep_analyze"]
                    )
                }
            )
        
        # ... similar for other agent types
    
    def serialize_message(self, message) -> dict:
        """Convert message to Redis-friendly format"""
        
        if isinstance(message, AssistantMessage):
            content_summary = []
            for block in message.content:
                if isinstance(block, TextBlock):
                    content_summary.append({"type": "text", "preview": block.text[:200]})
                elif isinstance(block, ToolUseBlock):
                    content_summary.append({"type": "tool_use", "tool": block.name})
            
            return {
                "type": "assistant",
                "content": json.dumps(content_summary),
                "timestamp": datetime.utcnow().isoformat()
            }
        
        elif isinstance(message, ResultMessage):
            return {
                "type": "result",
                "is_error": str(message.is_error),
                "duration_ms": str(message.duration_ms),
                "total_cost_usd": str(message.total_cost_usd or 0),
                "session_id": message.session_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        return {"type": "unknown", "timestamp": datetime.utcnow().isoformat()}
    
    async def handle_completion(self, result: ResultMessage):
        """Publish completion event to phase stream"""
        
        phase_stream = f"asdlc:phase:{self.task['phase']}"
        
        await self.redis.xadd(phase_stream, {
            "event": "PhaseCompleted",
            "epic_id": self.task["epic_id"],
            "task_id": self.task["id"],
            "phase": self.task["phase"],
            "status": "success" if not result.is_error else "failed",
            "session_id": result.session_id,
            "cost_usd": str(result.total_cost_usd or 0),
            "duration_ms": str(result.duration_ms)
        })
    
    # Hook callbacks
    async def log_tool_use(self, input_data, tool_use_id, context):
        """Log tool usage for observability"""
        await self.redis.xadd(
            f"asdlc:agent:tools:{self.task['id']}",
            {
                "tool": input_data.get("tool_name", "unknown"),
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        return {}
    
    async def on_completion(self, input_data, tool_use_id, context):
        """Handle agent completion"""
        # Already handled in handle_completion
        return {}


if __name__ == "__main__":
    runner = AgentRunner()
    asyncio.run(runner.run())
```

### 4. Development Agent with Todo Tracking

```python
# Example prompt that uses TodoWrite

DEVELOPMENT_TASK_PROMPT = """
You are implementing: {task_description}

## First: Create your task checklist
Use TodoWrite to create a checklist of steps:

1. Read and understand requirements
2. Query codebase for related code (use mcp__rag__query_codebase)
3. Write failing test
4. Implement code to pass test
5. Run all tests
6. Refactor if needed
7. Update documentation
8. Commit changes

## Then: Execute each step
Update the todo list as you progress. Use:
- status: "pending" for not started
- status: "in_progress" for current step
- status: "completed" for finished steps

## Available Tools
- Built-in: Read, Write, Edit, Bash, Glob, Grep
- RAG: mcp__rag__query_codebase - for finding related code
- RLM: mcp__rlm__deep_analyze - for complex debugging (use sparingly)
- Git: mcp__git__commit, mcp__git__branch

## Subagents
If you get stuck debugging (3+ failed attempts), delegate to the debugger subagent.

Begin!
"""
```

---

## Summary of Changes

| Original Design | Revised Design |
|-----------------|----------------|
| Client SDK for Evaluator | Agent SDK (needs file reading) |
| Client SDK for Security | Agent SDK (needs to run SAST tools) |
| Separate RLM/RAG services | MCP servers callable from any agent |
| Unclear Redis integration | Agent Runner wrapper streams to Redis |
| No todo tracking | TodoWrite in all agents for progress |
| Batch API standalone | Batch used within MCP servers for bulk ops |

## When to Use What

| Need | Solution |
|------|----------|
| Deep reasoning (architecture, debugging) | `mcp__rlm__deep_analyze` (Extended Thinking) |
| Find info in codebase | `mcp__rag__query_codebase` (Prompt Caching) |
| File operations | Built-in tools (Read, Write, Edit) |
| Run commands | Built-in Bash tool |
| Track progress | TodoWrite tool |
| External systems | MCP servers (Git, Jira, Slack) |
| Bulk processing | Batch API within MCP servers |
