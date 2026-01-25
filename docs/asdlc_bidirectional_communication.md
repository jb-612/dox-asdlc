# Agent SDK Bidirectional Communication Patterns

## The Problem

Claude Agent SDK is **run-to-completion**, not a long-running service:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│   query(prompt, options) ────▶ Agent loop ────▶ ResultMessage ────▶ Done           │
│                                                                                      │
│   There's no built-in way to:                                                        │
│   • Push new messages to a running agent                                             │
│   • Have the agent subscribe to Redis                                                │
│   • Inject events mid-execution                                                      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Three Patterns to Handle External Input

### Pattern 1: Ephemeral Containers (Recommended for aSDLC)

**How it works:** Agent runs task → exits → HITL happens externally → New container spawned with context

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         PATTERN 1: EPHEMERAL CONTAINERS                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Phase 1: Discovery                                                                 │
│   ┌─────────────────┐                                                               │
│   │ Discovery Agent │                                                               │
│   │ Container       │                                                               │
│   │                 │                                                               │
│   │ Task: Create PRD│──────▶ PRD.md created ──────▶ Container EXITS                │
│   │                 │                               (job completed)                 │
│   └─────────────────┘                                                               │
│                                        │                                            │
│                                        ▼                                            │
│                              ┌─────────────────┐                                    │
│                              │  Redis Stream   │                                    │
│                              │  PhaseCompleted │                                    │
│                              └─────────────────┘                                    │
│                                        │                                            │
│                                        ▼                                            │
│                              ┌─────────────────┐                                    │
│                              │   Coordinator   │                                    │
│                              │   (Consumer)    │                                    │
│                              │                 │                                    │
│                              │   Detects HITL  │                                    │
│                              │   gate required │                                    │
│                              └─────────────────┘                                    │
│                                        │                                            │
│                                        ▼                                            │
│                              ┌─────────────────┐                                    │
│                              │  HITL Gateway   │                                    │
│                              │                 │                                    │
│                              │  Human reviews  │◀──── SPA UI                       │
│                              │  PRD.md         │                                    │
│                              │                 │                                    │
│                              │  Clicks:        │                                    │
│                              │  [Approve] or   │                                    │
│                              │  [Request Fix]  │                                    │
│                              └─────────────────┘                                    │
│                                        │                                            │
│           ┌────────────────────────────┴────────────────────────────┐              │
│           │ If Approved                │ If Rejected                 │              │
│           ▼                            ▼                             │              │
│   ┌─────────────────┐        ┌─────────────────┐                    │              │
│   │   Coordinator   │        │   Coordinator   │                    │              │
│   │                 │        │                 │                    │              │
│   │ Spawn Design    │        │ Spawn Discovery │                    │              │
│   │ Agent container │        │ Agent container │                    │              │
│   │ (next phase)    │        │ WITH FEEDBACK   │◀── Key: feedback   │              │
│   └─────────────────┘        └─────────────────┘    injected in     │              │
│           │                          │              new prompt       │              │
│           ▼                          ▼                                              │
│   ┌─────────────────┐        ┌─────────────────┐                                   │
│   │  Design Agent   │        │ Discovery Agent │                                   │
│   │  (new container)│        │ (new container) │                                   │
│   │                 │        │                 │                                   │
│   │  Task: Create   │        │ Task: Fix PRD   │                                   │
│   │  architecture   │        │ based on:       │                                   │
│   │                 │        │ {feedback}      │                                   │
│   └─────────────────┘        └─────────────────┘                                   │
│                                                                                      │
│   COMMUNICATION FLOW:                                                                │
│   • Agent publishes TO Redis (streaming out) ✓                                      │
│   • Agent does NOT subscribe FROM Redis                                              │
│   • External input comes via NEW container with context in prompt                    │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```python
# coordinator/phase_manager.py

class PhaseManager:
    """Manages phase transitions and HITL gates"""
    
    async def handle_hitl_decision(self, decision: dict):
        """Called when human makes HITL decision"""
        
        if decision["approved"]:
            # Move to next phase - spawn new container
            next_phase = self.get_next_phase(decision["phase"])
            await self.spawn_agent(
                phase=next_phase,
                epic_id=decision["epic_id"],
                context={
                    "previous_artifacts": decision["artifacts"],
                    "hitl_comments": decision.get("comments", "")
                }
            )
        else:
            # Retry current phase with feedback
            await self.spawn_agent(
                phase=decision["phase"],  # Same phase
                epic_id=decision["epic_id"],
                context={
                    "previous_attempt": decision["artifacts"],
                    "rejection_reason": decision["rejection_reason"],
                    "reviewer_feedback": decision["feedback"],
                    "instruction": "Fix the issues and try again"
                }
            )
    
    async def spawn_agent(self, phase: str, epic_id: str, context: dict):
        """Spawn a new agent container with context"""
        
        task = {
            "id": f"task-{uuid4().hex[:8]}",
            "epic_id": epic_id,
            "phase": phase,
            "spec": self.build_prompt(phase, context),  # Context goes in prompt!
            "expected_artifacts": PHASE_ARTIFACTS[phase]
        }
        
        # Create Kubernetes Job
        job_manifest = {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {"name": f"agent-{task['id']}"},
            "spec": {
                "template": {
                    "spec": {
                        "containers": [{
                            "name": "agent",
                            "image": "asdlc/agent:latest",
                            "env": [
                                {"name": "TASK_JSON", "value": json.dumps(task)},
                                {"name": "AGENT_TYPE", "value": phase},
                                {"name": "REDIS_URL", "value": self.redis_url}
                            ],
                            "volumeMounts": [
                                {"name": "workspace", "mountPath": "/workspace"}
                            ]
                        }],
                        "restartPolicy": "Never"
                    }
                }
            }
        }
        
        await self.k8s.create_job(job_manifest)
    
    def build_prompt(self, phase: str, context: dict) -> str:
        """Build prompt with injected context"""
        
        base_prompt = PHASE_PROMPTS[phase]
        
        # Inject previous artifacts if available
        if context.get("previous_artifacts"):
            base_prompt += f"\n\n## Previous Artifacts\n{context['previous_artifacts']}"
        
        # Inject feedback if this is a retry
        if context.get("rejection_reason"):
            base_prompt += f"""

## IMPORTANT: Previous Attempt Was Rejected

Rejection Reason: {context['rejection_reason']}

Reviewer Feedback:
{context['reviewer_feedback']}

Please address these issues in your new attempt.
"""
        
        return base_prompt
```

---

### Pattern 2: Session Resumption (For Multi-Turn HITL Within a Phase)

**How it works:** Agent pauses via hook → Session saved → Human provides input → Agent resumed with session + new input

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         PATTERN 2: SESSION RESUMPTION                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   USE CASE: Agent needs human decision MID-TASK (not at phase boundary)             │
│                                                                                      │
│   Example: Development agent encounters ambiguous requirement                        │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   Development Agent                                                          │   │
│   │                                                                              │   │
│   │   1. Working on implementation...                                            │   │
│   │   2. Encounters ambiguity: "Should auth use JWT or sessions?"                │   │
│   │   3. Agent uses AskUserQuestion tool (built-in)                              │   │
│   │                                                                              │   │
│   │   ┌────────────────────────────────────────────────────────────────────┐    │   │
│   │   │ AskUserQuestion({                                                   │    │   │
│   │   │   question: "The spec is ambiguous. Should auth use JWT or sessions?",│   │   │
│   │   │   options: [                                                        │    │   │
│   │   │     {label: "JWT", description: "Stateless, better for microservices"},│  │   │
│   │   │     {label: "Sessions", description: "Server-side, simpler"}        │    │   │
│   │   │   ]                                                                 │    │   │
│   │   │ })                                                                  │    │   │
│   │   └────────────────────────────────────────────────────────────────────┘    │   │
│   │                                                                              │   │
│   │   4. PreToolUse hook intercepts, publishes to HITL stream                   │   │
│   │   5. Agent WAITS (blocked on hook response)                                  │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                        │                                            │
│                                        ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   HITL Gateway                                                               │   │
│   │                                                                              │   │
│   │   1. Receives question from Redis                                            │   │
│   │   2. Displays in SPA UI                                                      │   │
│   │   3. Human clicks "JWT"                                                      │   │
│   │   4. Response sent back to agent via hook mechanism                          │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                        │                                            │
│                                        ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   Development Agent (CONTINUES - same container, same session)              │   │
│   │                                                                              │   │
│   │   5. Hook returns with answer: "JWT"                                         │   │
│   │   6. Agent continues: "Okay, implementing JWT-based auth..."                 │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   NOTE: This uses the BUILT-IN hook system, not Redis subscription                  │
│   The hook acts as a synchronous bridge to external input                           │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```python
# agent_runner/hooks.py

import asyncio
from typing import Optional

class HITLHookHandler:
    """
    Handles HITL interactions via hooks.
    The hook BLOCKS until human responds (or timeout).
    """
    
    def __init__(self, redis_client, task_id: str, timeout: int = 3600):
        self.redis = redis_client
        self.task_id = task_id
        self.timeout = timeout  # 1 hour default
        self.response_channel = f"asdlc:hitl:response:{task_id}"
    
    async def handle_ask_user(
        self,
        input_data: dict,
        tool_use_id: str,
        context
    ) -> dict:
        """
        PreToolUse hook for AskUserQuestion tool.
        Publishes question to Redis, waits for human response.
        """
        
        if input_data.get("tool_name") != "AskUserQuestion":
            return {}  # Not our tool, allow it
        
        tool_input = input_data.get("tool_input", {})
        question = tool_input.get("question", "")
        options = tool_input.get("options", [])
        
        # Publish question to HITL stream
        question_id = f"q-{tool_use_id}"
        await self.redis.xadd(
            "asdlc:hitl:questions",
            {
                "question_id": question_id,
                "task_id": self.task_id,
                "tool_use_id": tool_use_id,
                "question": question,
                "options": json.dumps(options),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        
        # Wait for human response (BLOCKING)
        response = await self.wait_for_response(question_id)
        
        if response is None:
            # Timeout - deny the tool use
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": "HITL response timeout"
                }
            }
        
        # Return the human's answer to the agent
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                # The tool result will contain the human's answer
                "updatedInput": {
                    **tool_input,
                    "_human_response": response["answer"]
                }
            }
        }
    
    async def wait_for_response(self, question_id: str) -> Optional[dict]:
        """Wait for human response via Redis pub/sub"""
        
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(self.response_channel)
        
        try:
            async with asyncio.timeout(self.timeout):
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        data = json.loads(message["data"])
                        if data.get("question_id") == question_id:
                            return data
        except asyncio.TimeoutError:
            return None
        finally:
            await pubsub.unsubscribe(self.response_channel)


# In agent_runner/main.py

class AgentRunner:
    def build_options(self) -> ClaudeAgentOptions:
        
        hitl_handler = HITLHookHandler(self.redis, self.task_id)
        
        return ClaudeAgentOptions(
            # ... other options ...
            hooks={
                "PreToolUse": [
                    # HITL hook for AskUserQuestion
                    HookMatcher(
                        matcher="AskUserQuestion",
                        hooks=[hitl_handler.handle_ask_user],
                        timeout=3600  # 1 hour timeout for human response
                    )
                ]
            }
        )
```

**HITL Gateway - Sending Response:**

```python
# hitl_gateway/routes.py

from fastapi import FastAPI, WebSocket
import redis.asyncio as redis

app = FastAPI()
redis_client = redis.from_url(os.environ["REDIS_URL"])

@app.post("/hitl/respond/{task_id}")
async def respond_to_question(task_id: str, response: HITLResponse):
    """Human submits response to agent question"""
    
    channel = f"asdlc:hitl:response:{task_id}"
    
    # Publish response - agent's hook is waiting for this!
    await redis_client.publish(
        channel,
        json.dumps({
            "question_id": response.question_id,
            "answer": response.answer,
            "responder": response.user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    )
    
    return {"status": "sent"}
```

---

### Pattern 3: Long-Running Agent with Event Loop (Complex, Custom)

**How it works:** Custom wrapper maintains agent session, polls Redis for events, injects them

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    PATTERN 3: LONG-RUNNING WITH EVENT LOOP                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ⚠️  NOT RECOMMENDED: Complex, not native to SDK, potential state issues           │
│                                                                                      │
│   But if you MUST have a long-running agent that reacts to events:                  │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   Long-Running Agent Container                                               │   │
│   │                                                                              │   │
│   │   ┌──────────────────────────────────────────────────────────────────────┐  │   │
│   │   │                                                                       │  │   │
│   │   │   Event Loop (Custom Python)                                         │  │   │
│   │   │                                                                       │  │   │
│   │   │   while True:                                                        │  │   │
│   │   │       # Check for new events                                         │  │   │
│   │   │       events = await redis.xread(streams, block=5000)                │  │   │
│   │   │                                                                       │  │   │
│   │   │       for event in events:                                           │  │   │
│   │   │           if event.type == "NewTask":                                │  │   │
│   │   │               # Run agent with new task                              │  │   │
│   │   │               await run_agent_task(event.payload)                    │  │   │
│   │   │                                                                       │  │   │
│   │   │           elif event.type == "UpdateContext":                        │  │   │
│   │   │               # Agent already running? Can't inject mid-execution    │  │   │
│   │   │               # Would need to restart with new context               │  │   │
│   │   │               pass                                                   │  │   │
│   │   │                                                                       │  │   │
│   │   │           elif event.type == "CancelTask":                           │  │   │
│   │   │               # Cancel running agent (if supported)                  │  │   │
│   │   │               await cancel_agent()                                   │  │   │
│   │   │                                                                       │  │   │
│   │   └──────────────────────────────────────────────────────────────────────┘  │   │
│   │                                                                              │   │
│   │   Problems with this approach:                                               │   │
│   │   • Can't inject events INTO a running agent (SDK limitation)               │   │
│   │   • Must wait for agent to complete or use hooks                            │   │
│   │   • Adds complexity without much benefit                                     │   │
│   │   • Container stays running = higher cost                                    │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   VERDICT: Use Pattern 1 (ephemeral) or Pattern 2 (hooks) instead                   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Recommended Architecture for aSDLC

**Combine Pattern 1 + Pattern 2:**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       RECOMMENDED: HYBRID APPROACH                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   PHASE-LEVEL: Pattern 1 (Ephemeral Containers)                                      │
│   ────────────────────────────────────────────                                       │
│   • Each phase runs in its own container                                             │
│   • Container completes → HITL gate → New container for next phase                   │
│   • Feedback injected via prompt in new container                                    │
│                                                                                      │
│   MID-TASK: Pattern 2 (Hooks for AskUserQuestion)                                    │
│   ───────────────────────────────────────────────                                    │
│   • Agent can ask clarifying questions during execution                              │
│   • Hook blocks, publishes to Redis, waits for human response                        │
│   • Human responds via SPA, response flows back through hook                         │
│                                                                                      │
│                                                                                      │
│   COMPLETE FLOW:                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   ┌───────────────────┐                                                     │   │
│   │   │ Coordinator       │                                                     │   │
│   │   │ (always running)  │                                                     │   │
│   │   └─────────┬─────────┘                                                     │   │
│   │             │                                                                │   │
│   │             │ Spawn Job                                                     │   │
│   │             ▼                                                                │   │
│   │   ┌───────────────────┐      ┌───────────────────┐                         │   │
│   │   │ Development Agent │      │ Redis             │                         │   │
│   │   │ Container         │      │                   │                         │   │
│   │   │                   │      │ asdlc:hitl:       │                         │   │
│   │   │ 1. Start task     │──────│ questions         │───┐                     │   │
│   │   │                   │ pub  │                   │   │                     │   │
│   │   │ 2. Need decision  │      │ asdlc:hitl:       │   │                     │   │
│   │   │    (JWT/Session?) │◀─────│ response:{id}     │◀──│──┐                  │   │
│   │   │                   │ sub  │                   │   │  │                  │   │
│   │   │ 3. Continue with  │      │ asdlc:agent:      │   │  │                  │   │
│   │   │    answer         │──────│ progress          │   │  │                  │   │
│   │   │                   │ pub  │                   │   │  │                  │   │
│   │   │ 4. Task complete  │──────│ asdlc:phase:      │   │  │                  │   │
│   │   │                   │ pub  │ development       │   │  │                  │   │
│   │   │ 5. Exit           │      │                   │   │  │                  │   │
│   │   └───────────────────┘      └───────────────────┘   │  │                  │   │
│   │                                                       │  │                  │   │
│   │                              ┌───────────────────┐   │  │                  │   │
│   │                              │ HITL Gateway      │   │  │                  │   │
│   │                              │ (always running)  │◀──┘  │                  │   │
│   │                              │                   │      │                  │   │
│   │                              │ Display question  │      │                  │   │
│   │                              │ in SPA UI         │      │                  │   │
│   │                              │                   │      │                  │   │
│   │                              │ Human clicks JWT  │──────┘                  │   │
│   │                              │                   │   publish               │   │
│   │                              └───────────────────┘   response              │   │
│   │                                                                              │   │
│   │                              ┌───────────────────┐                          │   │
│   │                              │ Coordinator       │                          │   │
│   │                              │                   │◀── Sees PhaseCompleted   │   │
│   │                              │ Checks HITL gate  │                          │   │
│   │                              │ Waits for human   │                          │   │
│   │                              │ approval          │                          │   │
│   │                              │                   │                          │   │
│   │                              │ On approval:      │                          │   │
│   │                              │ Spawn next phase  │                          │   │
│   │                              │ container         │                          │   │
│   │                              └───────────────────┘                          │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary: How Communication Works

| Direction | Mechanism | Implementation |
|-----------|-----------|----------------|
| **Agent → Redis** | Streaming | `async for msg in query()` → `redis.xadd()` |
| **Human → Agent (phase boundary)** | New container | Coordinator spawns job with context in prompt |
| **Human → Agent (mid-task)** | Hooks | `AskUserQuestion` → Hook → Redis pub/sub → Hook returns |
| **Cancel running agent** | Not directly supported | Must wait for completion or set `max_turns` |

## What You Need to Build

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE YOU NEED TO BUILD                             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   1. COORDINATOR (Always Running)                                                    │
│      ├── Consumes Redis streams                                                      │
│      ├── Manages phase transitions                                                   │
│      ├── Spawns K8s Jobs for agents                                                  │
│      └── Injects context into new containers via TASK_JSON                          │
│                                                                                      │
│   2. HITL GATEWAY (Always Running)                                                   │
│      ├── REST API for SPA                                                           │
│      ├── WebSocket for real-time updates                                            │
│      ├── Subscribes to asdlc:hitl:questions                                         │
│      └── Publishes to asdlc:hitl:response:{task_id}                                 │
│                                                                                      │
│   3. AGENT RUNNER (In each container)                                               │
│      ├── Wraps Agent SDK streaming → Redis                                          │
│      ├── Implements HITL hooks for AskUserQuestion                                  │
│      └── Blocks on hook until human response via pub/sub                            │
│                                                                                      │
│   4. SPA (Frontend)                                                                  │
│      ├── WebSocket connection to HITL Gateway                                       │
│      ├── Displays agent questions                                                    │
│      ├── Submits responses via REST                                                 │
│      └── Shows phase gates for approval                                             │
│                                                                                      │
│   NOT NEEDED:                                                                        │
│   ❌ Redis subscription IN the agent container                                       │
│   ❌ Push messages TO running agent                                                  │
│   ❌ Long-running agent service                                                      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```
