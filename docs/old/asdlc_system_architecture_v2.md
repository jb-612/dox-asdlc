# aSDLC System Architecture v2.0

## Claude Technology Selection Matrix

### Understanding the Options

| Technology | What It Is | Best For | NOT For |
|------------|-----------|----------|---------|
| **Claude Agent SDK** | Claude Code CLI as a library | Complex coding tasks, file operations, multi-step reasoning | Simple API calls, non-coding workflows |
| **Client SDK** | API wrapper (Python/TS/Java) | Simple inference, structured I/O, batch processing | Agentic coding, tool use orchestration |
| **Messages API** | Direct REST/streaming API | Custom tool use, prompt caching, MCP connector | When SDK features suffice |
| **Claude Code CLI** | Terminal-based agent | Interactive developer experience | Programmatic automation |

### Key Insight

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TECHNOLOGY SELECTION PRINCIPLE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Agent SDK = Claude Code as a library                                        │
│              ├── Built-in tools: Bash, Read, Write, Edit, Glob, Grep        │
│              ├── Subagents for parallel/specialized work                     │
│              ├── Skills for specialized capabilities (.claude/skills/)       │
│              ├── Hooks for intercepting/controlling tool use                 │
│              ├── Sessions for state management                               │
│              └── File checkpointing for rollback                             │
│                                                                              │
│  Client SDK = Simple API calls                                               │
│              ├── No built-in tools                                           │
│              ├── You implement tool execution                                │
│              └── Best for structured input/output                            │
│                                                                              │
│  Messages API = Maximum control                                              │
│              ├── Prompt caching (90% cost reduction on repeated context)     │
│              ├── Extended thinking (budget_tokens for deep reasoning)        │
│              ├── MCP connector (remote tool servers)                         │
│              └── Batch processing (50% discount, async)                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Revised aSDLC Architecture

Based on Claude's capabilities, here's the optimal architecture:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            aSDLC SYSTEM ARCHITECTURE v2.0                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         ORCHESTRATION LAYER (Python)                           │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐             │ │
│  │  │  Workflow        │  │   HITL Gateway   │  │   Git Gateway    │             │ │
│  │  │  Coordinator     │  │   (FastAPI)      │  │   (GitPython)    │             │ │
│  │  │                  │  │                  │  │                  │             │ │
│  │  │  Redis Streams   │  │  WebSocket for   │  │  Artifact store  │             │ │
│  │  │  event routing   │  │  real-time UI    │  │  version control │             │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘             │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                         │                                            │
│         ┌───────────────────────────────┴───────────────────────────────┐           │
│         ▼                               ▼                               ▼           │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────────┐ │
│  │   AGENT SDK         │    │   CLIENT SDK        │    │   MESSAGES API          │ │
│  │   CONTAINERS        │    │   SERVICES          │    │   SERVICES              │ │
│  │   (Coding Tasks)    │    │   (Structured I/O)  │    │   (Optimized Inference) │ │
│  │                     │    │                     │    │                         │ │
│  │  ┌───────────────┐  │    │  ┌───────────────┐  │    │  ┌───────────────────┐  │ │
│  │  │ Discovery     │  │    │  │ Evaluator     │  │    │  │ RLM Service       │  │ │
│  │  │ Agent (SDK)   │  │    │  │ (Feedback)    │  │    │  │ (Extended Think)  │  │ │
│  │  ├───────────────┤  │    │  ├───────────────┤  │    │  ├───────────────────┤  │ │
│  │  │ Design        │  │    │  │ CI/CD         │  │    │  │ Batch Processor   │  │ │
│  │  │ Agent (SDK)   │  │    │  │ Agent         │  │    │  │ (50% discount)    │  │ │
│  │  ├───────────────┤  │    │  ├───────────────┤  │    │  ├───────────────────┤  │ │
│  │  │ Development   │  │    │  │ Security      │  │    │  │ RAG Query         │  │ │
│  │  │ Agent (SDK)   │  │    │  │ Scanner       │  │    │  │ (Prompt Cache)    │  │ │
│  │  ├───────────────┤  │    │  ├───────────────┤  │    │  └───────────────────┘  │ │
│  │  │ Test          │  │    │  │ SRE           │  │    │                         │ │
│  │  │ Agent (SDK)   │  │    │  │ Monitor       │  │    │                         │ │
│  │  └───────────────┘  │    │  └───────────────┘  │    │                         │ │
│  │                     │    │                     │    │                         │ │
│  │  Features:          │    │  Features:          │    │  Features:              │ │
│  │  • Subagents        │    │  • Structured out   │    │  • Prompt caching       │ │
│  │  • Skills           │    │  • Simple tools     │    │  • Extended thinking    │ │
│  │  • Hooks            │    │  • Batch capable    │    │  • MCP connector        │ │
│  │  • File checkpoint  │    │                     │    │  • Batch processing     │ │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────────────┘ │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              MCP TOOL SERVERS                                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │ │
│  │  │ Git MCP      │  │ Jira MCP     │  │ Slack MCP    │  │ Custom MCP   │       │ │
│  │  │ Server       │  │ Server       │  │ Server       │  │ Servers      │       │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              SHARED INFRASTRUCTURE                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │ │
│  │  │ Redis        │  │ PostgreSQL   │  │ Git Repos    │  │ ChromaDB     │       │ │
│  │  │ (Streams)    │  │ (State)      │  │ (Artifacts)  │  │ (Embeddings) │       │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details by Technology

### 1. Agent SDK Containers (Coding Tasks)

**Why Agent SDK**: These tasks require complex file operations, code generation, testing, and debugging — exactly what Claude Code was built for.

#### Discovery Agent

```python
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

# Discovery uses subagents for parallel work
async def run_discovery(epic_brief: str, repo_path: str):
    options = ClaudeAgentOptions(
        cwd=repo_path,
        setting_sources=["project"],  # Load CLAUDE.md and skills
        allowed_tools=["Read", "Glob", "Grep", "Write", "Task"],
        permission_mode="acceptEdits",
        
        # Define specialized subagents
        agents={
            "prd-writer": AgentDefinition(
                description="Writes product requirements documents",
                prompt="""You are a PRD specialist. Analyze the epic brief and 
                codebase to produce a comprehensive PRD.md that includes:
                - Problem statement
                - User stories
                - Acceptance criteria
                - Out of scope items
                Follow SDD principles: the spec is the product.""",
                tools=["Read", "Glob", "Grep", "Write"],
                model="sonnet"  # Cost-effective for this task
            ),
            "acceptance-writer": AgentDefinition(
                description="Writes acceptance test specifications",
                prompt="""You are an acceptance criteria specialist. Based on the
                PRD, create detailed test specifications that will validate
                the implementation meets requirements.""",
                tools=["Read", "Write"],
                model="sonnet"
            ),
        },
        
        # Hooks for HITL integration
        hooks={
            "PostToolUse": [HookMatcher(hooks=[log_artifact_creation])],
            "Stop": [HookMatcher(hooks=[notify_hitl_ready])]
        }
    )
    
    async for message in query(
        prompt=f"""Analyze this epic and create discovery artifacts:
        
        Epic Brief: {epic_brief}
        
        Steps:
        1. Use prd-writer subagent to create PRD.md
        2. Use acceptance-writer subagent to create test_specs.md
        3. Update spec_index.md with new artifacts
        """,
        options=options
    ):
        yield message
```

#### Development Agent (with TDD)

```python
async def run_development(task_spec: str, repo_path: str):
    options = ClaudeAgentOptions(
        cwd=repo_path,
        setting_sources=["project"],
        allowed_tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task"],
        permission_mode="acceptEdits",
        enable_file_checkpointing=True,  # Enable rollback on failure
        
        # TDD-focused subagents
        agents={
            "test-first": AgentDefinition(
                description="Writes failing tests before implementation",
                prompt="""You implement Test-Driven Development:
                1. Read the task specification
                2. Write a failing unit test that validates the requirement
                3. Run the test to confirm it fails
                Output the test file path when done.""",
                tools=["Read", "Write", "Bash"],
                model="sonnet"
            ),
            "implementer": AgentDefinition(
                description="Implements code to pass tests",
                prompt="""You implement code to make tests pass:
                1. Read the failing test
                2. Implement minimal code to pass
                3. Run tests until green
                4. Refactor if needed""",
                tools=["Read", "Write", "Edit", "Bash"],
                model="sonnet"
            ),
            "debugger": AgentDefinition(
                description="Fixes failing tests after multiple attempts",
                prompt="""You are a debugging specialist. When tests fail
                repeatedly, analyze the error, identify root cause, and fix.""",
                tools=["Read", "Write", "Edit", "Bash", "Grep"],
                model="opus"  # Use Opus for complex debugging
            ),
        },
        
        # Custom skill for project conventions
        # Located at .claude/skills/tdd-workflow/SKILL.md
    )
    
    async for message in query(
        prompt=f"""Implement this task using TDD:
        
        {task_spec}
        
        Workflow:
        1. Use test-first subagent to write failing test
        2. Use implementer subagent to make it pass
        3. If stuck after 3 attempts, use debugger subagent
        4. Commit changes with descriptive message
        """,
        options=options
    ):
        yield message
```

### 2. Client SDK Services (Structured Workflows)

**Why Client SDK**: These services need structured input/output, don't require file operations, and benefit from simpler orchestration.

#### Feedback Evaluator Service

```python
import anthropic
from pydantic import BaseModel

class FeedbackClassification(BaseModel):
    classification: str  # generalizable_high, generalizable_low, edge_case, ambiguous
    confidence: float
    proposed_rule: str | None
    affected_agents: list[str]
    evidence: list[str]

async def evaluate_feedback(feedback: dict, history: list[dict]) -> FeedbackClassification:
    client = anthropic.Anthropic()
    
    # Use structured output for reliable parsing
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2000,
        system="""You are a feedback evaluator for an agentic SDLC system.
        Analyze HITL feedback to determine if it represents a generalizable
        pattern that should become a rule, or an edge case.
        
        Classification criteria:
        - generalizable_high: Same issue 3+ times OR 2+ different reviewers
        - generalizable_low: Similar issue found, needs more data
        - edge_case: Unique situation, contradicts standards, or one-off
        - ambiguous: Contradicts prior approvals, needs human review
        """,
        messages=[{
            "role": "user",
            "content": f"""Analyze this feedback:
            
            Current Feedback:
            {json.dumps(feedback, indent=2)}
            
            Historical Similar Feedback:
            {json.dumps(history, indent=2)}
            
            Classify and propose rule if generalizable."""
        }],
        # Request structured JSON output
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "feedback_classification",
                "schema": FeedbackClassification.model_json_schema()
            }
        }
    )
    
    return FeedbackClassification.model_validate_json(response.content[0].text)
```

#### Security Scanner Service

```python
async def scan_for_vulnerabilities(code_diff: str, repo_context: str) -> dict:
    client = anthropic.Anthropic()
    
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=4000,
        system="""You are a security code reviewer. Analyze code changes for:
        - SQL injection
        - XSS vulnerabilities
        - Authentication/authorization issues
        - Secrets exposure
        - Dependency vulnerabilities
        
        Output severity: CRITICAL, HIGH, MEDIUM, LOW, INFO
        """,
        messages=[{
            "role": "user",
            "content": f"""Review this code change:
            
            Context: {repo_context}
            
            Diff:
            ```
            {code_diff}
            ```
            """
        }]
    )
    
    return parse_security_findings(response.content[0].text)
```

### 3. Messages API Services (Optimized Inference)

**Why Messages API**: Maximum control over caching, thinking, and batch processing for cost optimization.

#### RLM Service (Extended Thinking)

```python
# RLM = Recursive Language Model execution
# Uses Extended Thinking for deep reasoning on complex problems

async def rlm_deep_analysis(
    problem: str,
    context: str,
    thinking_budget: int = 10000  # tokens for thinking
) -> dict:
    """
    RLM service for problems requiring deep reasoning:
    - Architecture decisions
    - Complex debugging
    - Design trade-off analysis
    """
    async with anthropic.AsyncAnthropic() as client:
        response = await client.messages.create(
            model="claude-sonnet-4-5",  # Supports extended thinking
            max_tokens=16000,
            thinking={
                "type": "enabled",
                "budget_tokens": thinking_budget
            },
            messages=[{
                "role": "user",
                "content": f"""
                Problem: {problem}
                
                Context:
                {context}
                
                Analyze thoroughly. Consider:
                1. Multiple approaches
                2. Trade-offs of each
                3. Risks and mitigations
                4. Recommended solution with rationale
                """
            }]
        )
        
        # Extract thinking and response
        thinking_content = ""
        response_content = ""
        
        for block in response.content:
            if block.type == "thinking":
                thinking_content = block.thinking
            elif block.type == "text":
                response_content = block.text
        
        return {
            "thinking": thinking_content,
            "response": response_content,
            "thinking_tokens": response.usage.thinking_tokens,
            "total_tokens": response.usage.input_tokens + response.usage.output_tokens
        }
```

#### RAG Query Service (Prompt Caching)

```python
# Uses prompt caching for repeated context (90% cost reduction)

class RAGQueryService:
    def __init__(self, codebase_context: str):
        self.client = anthropic.Anthropic()
        self.codebase_context = codebase_context
        self.cache_initialized = False
    
    async def query(self, question: str) -> str:
        """Query with cached codebase context"""
        
        response = self.client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4000,
            system=[
                {
                    "type": "text",
                    "text": "You are a codebase expert. Answer questions based on the provided context."
                },
                {
                    "type": "text",
                    "text": self.codebase_context,
                    "cache_control": {"type": "ephemeral"}  # 5-min cache
                }
            ],
            messages=[{
                "role": "user",
                "content": question
            }]
        )
        
        # Log cache performance
        usage = response.usage
        if usage.cache_read_input_tokens > 0:
            print(f"Cache hit! Read {usage.cache_read_input_tokens} cached tokens")
        elif usage.cache_creation_input_tokens > 0:
            print(f"Cache miss. Cached {usage.cache_creation_input_tokens} tokens")
        
        return response.content[0].text
```

#### Batch Processing Service

```python
# 50% cost reduction for non-time-sensitive tasks

async def batch_process_reviews(review_requests: list[dict]) -> list[dict]:
    """Process multiple code reviews in batch for cost savings"""
    
    client = anthropic.Anthropic()
    
    # Create batch request
    batch_requests = []
    for i, req in enumerate(review_requests):
        batch_requests.append({
            "custom_id": f"review-{i}",
            "params": {
                "model": "claude-sonnet-4-5",
                "max_tokens": 2000,
                "messages": [{
                    "role": "user",
                    "content": f"Review this code:\n\n{req['code']}"
                }]
            }
        })
    
    # Submit batch (results within 24 hours)
    batch = client.batches.create(requests=batch_requests)
    
    # Poll for completion
    while batch.processing_status != "ended":
        await asyncio.sleep(60)
        batch = client.batches.retrieve(batch.id)
    
    # Retrieve results
    results = []
    for result in client.batches.results(batch.id):
        results.append({
            "custom_id": result.custom_id,
            "review": result.result.message.content[0].text
        })
    
    return results
```

---

## MCP Integration Strategy

### MCP Servers for Tool Abstraction

```python
# MCP provides tool abstraction between agents and external systems

# Option 1: Agent SDK with MCP servers
options = ClaudeAgentOptions(
    mcp_servers={
        "git": {
            "type": "stdio",
            "command": "mcp-server-git",
            "args": ["--repository", "/path/to/repo"]
        },
        "jira": {
            "type": "sse",
            "url": "https://jira-mcp.example.com/sse",
            "authorization_token": os.environ["JIRA_TOKEN"]
        }
    },
    allowed_tools=[
        "Read", "Write", "Bash",
        "mcp__git__commit",
        "mcp__git__branch",
        "mcp__jira__create_issue",
        "mcp__jira__update_status"
    ]
)

# Option 2: Messages API with MCP connector (beta)
response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1000,
    messages=[{"role": "user", "content": "Create a Jira ticket for this bug"}],
    mcp_servers=[{
        "type": "url",
        "url": "https://jira-mcp.example.com/sse",
        "name": "jira-mcp",
        "authorization_token": os.environ["JIRA_TOKEN"]
    }],
    tools=[{
        "type": "mcp_toolset",
        "mcp_server_name": "jira-mcp"
    }],
    headers={"anthropic-beta": "mcp-client-2025-11-20"}
)
```

---

## Skills Architecture

### Project Skills Directory

```
.claude/
├── skills/
│   ├── tdd-workflow/
│   │   └── SKILL.md           # TDD development methodology
│   ├── prd-writing/
│   │   └── SKILL.md           # PRD best practices
│   ├── architecture-review/
│   │   └── SKILL.md           # Architecture decision records
│   └── security-scan/
│       └── SKILL.md           # Security review checklist
├── agents/
│   ├── prd-agent.md           # PRD subagent definition
│   ├── test-agent.md          # Test-first subagent
│   └── debugger-agent.md      # Debugging specialist
└── CLAUDE.md                  # Project context and rules
```

### Example Skill: TDD Workflow

```markdown
# .claude/skills/tdd-workflow/SKILL.md

---
description: "Test-Driven Development workflow for implementing features"
---

# TDD Workflow Skill

When implementing any feature or fixing any bug, follow this workflow:

## 1. Understand Requirements
- Read the task specification completely
- Identify acceptance criteria
- Clarify any ambiguities before coding

## 2. Write Failing Test FIRST
```bash
# Create test file
touch tests/test_<feature>.py

# Write test that validates requirement
# Run to confirm it fails
pytest tests/test_<feature>.py -v
```

## 3. Implement Minimal Code
- Write only enough code to pass the test
- Do NOT add features not covered by tests
- Run tests after each change

## 4. Refactor
- Clean up code while keeping tests green
- Extract common patterns
- Improve naming

## 5. Repeat
- Next requirement → new failing test → implement → refactor

## Red Flags
- ❌ Writing implementation before tests
- ❌ Writing tests that pass immediately
- ❌ Skipping the refactor step
- ❌ Adding untested code
```

---

## Container Deployment Pattern

### Agent SDK Container

```dockerfile
# Dockerfile.agent-sdk

FROM python:3.11-slim

# Install Node.js (required by Claude Code CLI)
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY src/ /app/src/
COPY .claude/ /app/.claude/

WORKDIR /app

# Environment
ENV ANTHROPIC_API_KEY=""
ENV PYTHONPATH=/app

# Entry point
ENTRYPOINT ["python", "-m", "src.agent_runner"]
```

### Container Runner Service

```python
class AgentContainerRunner:
    """Manages Agent SDK container lifecycle"""
    
    async def run_agent(
        self,
        agent_type: str,  # discovery, design, development, test
        task: dict,
        repo_path: str
    ) -> AsyncIterator[dict]:
        """Spawn container, run agent, collect results"""
        
        container_id = f"{agent_type}-{task['id']}-{uuid4().hex[:8]}"
        
        # Spawn container
        container = await self.docker.containers.run(
            image=f"asdlc/{agent_type}-agent",
            name=container_id,
            volumes={
                repo_path: {"bind": "/workspace", "mode": "rw"},
                "/tmp/outputs": {"bind": "/outputs", "mode": "rw"}
            },
            environment={
                "ANTHROPIC_API_KEY": self.api_key,
                "TASK_JSON": json.dumps(task),
                "AGENT_TYPE": agent_type
            },
            detach=True,
            auto_remove=True,
            mem_limit="2g",
            cpu_period=100000,
            cpu_quota=100000  # 1 CPU
        )
        
        # Stream logs
        async for log in container.logs(stream=True, follow=True):
            yield {"type": "log", "content": log.decode()}
        
        # Collect results
        exit_code = await container.wait()
        results = json.load(open(f"/tmp/outputs/{container_id}/results.json"))
        
        yield {"type": "result", "exit_code": exit_code, "data": results}
```

---

## Workflow Coordination

### Event-Driven Orchestration with Redis Streams

```python
class WorkflowCoordinator:
    """Coordinates agent containers via Redis Streams"""
    
    STREAMS = {
        "discovery": "asdlc:phase:discovery",
        "design": "asdlc:phase:design",
        "development": "asdlc:phase:development",
        "validation": "asdlc:phase:validation",
        "deployment": "asdlc:phase:deployment",
        "hitl": "asdlc:hitl:requests"
    }
    
    async def handle_epic_created(self, epic: dict):
        """Start discovery phase"""
        await self.redis.xadd(
            self.STREAMS["discovery"],
            {
                "event": "PhaseStarted",
                "epic_id": epic["id"],
                "phase": "discovery",
                "payload": json.dumps(epic)
            }
        )
    
    async def handle_phase_completed(self, event: dict):
        """Transition to next phase or HITL gate"""
        phase = event["phase"]
        epic_id = event["epic_id"]
        
        # Check if HITL gate required
        if self.requires_hitl(phase):
            await self.request_hitl_gate(epic_id, phase, event["artifacts"])
        else:
            next_phase = self.get_next_phase(phase)
            await self.start_phase(epic_id, next_phase)
    
    async def handle_hitl_decision(self, decision: dict):
        """Resume workflow after HITL approval"""
        if decision["approved"]:
            next_phase = self.get_next_phase(decision["gate_type"])
            await self.start_phase(decision["epic_id"], next_phase)
        else:
            # Handle rejection - may need rework
            await self.handle_rejection(decision)
```

---

## Cost Optimization Summary

| Service | Technology | Cost Optimization |
|---------|-----------|-------------------|
| Coding Agents | Agent SDK | Subagents with Sonnet (cheaper than Opus) |
| Deep Reasoning | Messages API | Extended thinking with budget control |
| RAG Queries | Messages API | Prompt caching (90% reduction) |
| Bulk Reviews | Messages API | Batch processing (50% discount) |
| Feedback Eval | Client SDK | Structured output (no retry loops) |
| Security Scan | Client SDK | Simple inference, no tools needed |

### Estimated Token Costs per Epic

| Phase | Tokens (Est.) | Model | Cost (Est.) |
|-------|---------------|-------|-------------|
| Discovery | 50K input, 10K output | Sonnet | $0.30 |
| Design | 100K input, 20K output | Sonnet | $0.60 |
| Development (5 tasks) | 500K input, 100K output | Sonnet | $3.00 |
| Testing | 200K input, 40K output | Sonnet | $1.20 |
| Validation | 100K input, 20K output | Sonnet | $0.60 |
| **Total per Epic** | ~1M tokens | | **~$5.70** |

With prompt caching on repeated context: **~$2.50** (56% reduction)

---

## Alignment with BRD Requirements

| BRD Requirement | Solution |
|-----------------|----------|
| FR1. Cluster visualization | 5 clusters map to Agent SDK containers + Client SDK services |
| FR2. Agent listing | Defined as Agent SDK subagents + Skills |
| FR3. HITL gate ladder | HITL Gateway service with Redis Streams events |
| FR4. Git-first truth | Git Gateway service, all artifacts versioned |
| FR5. Knowledge bus | Redis Streams + MCP servers (abstracted) |
| FR6. RLM indication | Messages API with Extended Thinking |

---

## RLM Service Details

### What is RLM?

**RLM (Recursive Language Model)** = An execution pattern where the model iteratively reasons, takes actions, observes results, and continues until task completion.

In Claude's ecosystem, RLM is implemented through:

1. **Agent SDK agentic loop** - Built-in iterative reasoning with tool use
2. **Extended Thinking** - Deep reasoning before responding
3. **Subagents** - Delegating complex subtasks

### RLM vs RAG

| Aspect | RLM | RAG |
|--------|-----|-----|
| **Purpose** | Deep iterative reasoning | Context retrieval |
| **When to use** | Complex problems, debugging, design | Finding relevant information |
| **Claude feature** | Extended Thinking, Agent loop | Prompt Caching + embeddings |
| **Token cost** | Higher (thinking tokens) | Lower (cached retrieval) |

### RLM Service Implementation

```python
class RLMService:
    """
    RLM service for problems requiring iterative deep reasoning.
    Alternative to RAG when the problem needs analysis, not retrieval.
    """
    
    async def solve_complex_problem(
        self,
        problem: str,
        context: str,
        max_iterations: int = 5
    ) -> dict:
        """
        Use extended thinking for complex architectural or debugging problems.
        """
        
        # First, use extended thinking for deep analysis
        analysis = await self.deep_analyze(problem, context)
        
        # If solution requires implementation, spawn Agent SDK container
        if analysis.get("requires_implementation"):
            async for result in self.agent_runner.run_agent(
                agent_type="development",
                task={
                    "type": "implementation",
                    "spec": analysis["proposed_solution"],
                    "context": context
                },
                repo_path=context.get("repo_path")
            ):
                yield result
        else:
            yield {"type": "analysis", "content": analysis}
    
    async def deep_analyze(self, problem: str, context: str) -> dict:
        """Use extended thinking for analysis"""
        
        response = await self.client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=8000,
            thinking={
                "type": "enabled",
                "budget_tokens": 5000  # Control thinking cost
            },
            messages=[{
                "role": "user",
                "content": f"""
                Problem: {problem}
                Context: {context}
                
                Analyze this problem deeply. Consider multiple approaches,
                trade-offs, and provide a recommended solution.
                """
            }]
        )
        
        return self.parse_analysis(response)
```

---

## Summary: When to Use What

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TECHNOLOGY DECISION GUIDE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Task involves files, code, bash commands?                                   │
│  ├── YES → Agent SDK (built-in tools, subagents, skills)                    │
│  │         Examples: PRD writing, coding, testing, debugging                │
│  │                                                                          │
│  └── NO → Does it need structured input/output?                             │
│           ├── YES → Client SDK (simple, reliable)                           │
│           │         Examples: Feedback eval, security scan, Jira updates    │
│           │                                                                  │
│           └── NO → Does it need cost optimization?                          │
│                   ├── Repeated context → Messages API + Prompt Caching      │
│                   ├── Bulk processing → Messages API + Batch (50% off)      │
│                   ├── Deep reasoning → Messages API + Extended Thinking     │
│                   └── External tools → Messages API + MCP Connector         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```
