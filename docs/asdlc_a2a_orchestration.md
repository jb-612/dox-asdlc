# Agent-to-Agent (A2A) Orchestration

## Key Insight

The Coordinator is the orchestration hub. Agents don't talk directly to each other - they publish completion events, and the Coordinator decides what happens next.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│   Agent A ──publish──▶ Redis Stream ──consume──▶ Coordinator ──spawn──▶ Agent B    │
│                                                                                      │
│   Agents don't need to know about each other.                                        │
│   Coordinator has the workflow logic.                                                │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Phase Transitions: HITL vs Auto (A2A)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         PHASE TRANSITION MATRIX                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   FROM              TO                  TYPE        GATE                            │
│   ─────────────────────────────────────────────────────────────────────────────────│
│   Epic Created  →   Discovery           Auto        HITL-0 (optional)              │
│   Discovery     →   Design              HITL        HITL-1 (Backlog Approval)      │
│   Design        →   Development         HITL        HITL-2 (Design Sign-off)       │
│   Development   →   Test                AUTO        No gate (A2A)                  │
│   Test          →   Security            AUTO        No gate (A2A)                  │
│   Security      →   Validator           AUTO        No gate (A2A)                  │
│   Validator     →   (Review)            HITL        HITL-4 (Quality Gate)          │
│   Review        →   Deployment          HITL        HITL-5 (Release Auth)          │
│   Deployment    →   Complete            HITL        HITL-6 (Production Sign-off)   │
│                                                                                      │
│   AUTO = Coordinator spawns next agent immediately                                   │
│   HITL = Coordinator waits for human approval before spawning                        │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Coordinator Workflow Logic

```python
# coordinator/workflow.py

from enum import Enum
from typing import Optional

class TransitionType(Enum):
    AUTO = "auto"      # A2A - spawn immediately
    HITL = "hitl"      # Wait for human approval

# Workflow definition
WORKFLOW = {
    "discovery": {
        "next": "design",
        "transition": TransitionType.HITL,
        "gate": "HITL-1",
        "gate_name": "Backlog Approval"
    },
    "design": {
        "next": "development",
        "transition": TransitionType.HITL,
        "gate": "HITL-2", 
        "gate_name": "Design Sign-off"
    },
    "development": {
        "next": "test",
        "transition": TransitionType.AUTO,  # ◀── A2A: No human needed
        "gate": None
    },
    "test": {
        "next": "security",
        "transition": TransitionType.AUTO,  # ◀── A2A: No human needed
        "gate": None
    },
    "security": {
        "next": "validator",
        "transition": TransitionType.AUTO,  # ◀── A2A: No human needed
        "gate": None
    },
    "validator": {
        "next": "deployment",
        "transition": TransitionType.HITL,
        "gate": "HITL-5",
        "gate_name": "Quality Gate"
    },
    "deployment": {
        "next": None,  # End of workflow
        "transition": TransitionType.HITL,
        "gate": "HITL-6",
        "gate_name": "Release Authorization"
    }
}


class WorkflowCoordinator:
    """
    Orchestrates agent-to-agent transitions.
    Consumes Redis streams, spawns agent containers.
    """
    
    def __init__(self, redis_client, k8s_client):
        self.redis = redis_client
        self.k8s = k8s_client
    
    async def run(self):
        """Main event loop - consume phase completion events"""
        
        streams = {
            "asdlc:phase:discovery": "$",
            "asdlc:phase:design": "$",
            "asdlc:phase:development": "$",
            "asdlc:phase:test": "$",
            "asdlc:phase:security": "$",
            "asdlc:phase:validator": "$",
            "asdlc:phase:deployment": "$",
            "asdlc:hitl:decisions": "$",  # HITL approval events
        }
        
        while True:
            # Block until events arrive
            events = await self.redis.xread(streams, block=5000)
            
            for stream, messages in events:
                for msg_id, data in messages:
                    await self.handle_event(stream, data)
    
    async def handle_event(self, stream: str, data: dict):
        """Handle a single event"""
        
        event_type = data.get("event")
        
        if event_type == "PhaseTaskCompleted":
            await self.handle_phase_completed(data)
        
        elif event_type == "GateApproved":
            await self.handle_gate_approved(data)
        
        elif event_type == "GateRejected":
            await self.handle_gate_rejected(data)
    
    async def handle_phase_completed(self, data: dict):
        """Agent completed its phase - decide what's next"""
        
        phase = data["phase"]
        epic_id = data["epic_id"]
        status = data["status"]
        
        # If failed, don't proceed
        if status != "success":
            await self.handle_phase_failed(data)
            return
        
        workflow_step = WORKFLOW.get(phase)
        if not workflow_step:
            return  # Unknown phase
        
        next_phase = workflow_step["next"]
        if not next_phase:
            # Workflow complete!
            await self.complete_epic(epic_id)
            return
        
        transition_type = workflow_step["transition"]
        
        if transition_type == TransitionType.AUTO:
            # ═══════════════════════════════════════════════════════
            # A2A: Spawn next agent immediately, no human needed
            # ═══════════════════════════════════════════════════════
            await self.spawn_next_phase(
                epic_id=epic_id,
                phase=next_phase,
                previous_artifacts=data.get("artifacts", {}),
                session_id=data.get("session_id")
            )
        
        elif transition_type == TransitionType.HITL:
            # ═══════════════════════════════════════════════════════
            # HITL: Request human approval before proceeding
            # ═══════════════════════════════════════════════════════
            await self.request_hitl_gate(
                epic_id=epic_id,
                current_phase=phase,
                next_phase=next_phase,
                gate_id=workflow_step["gate"],
                gate_name=workflow_step["gate_name"],
                artifacts=data.get("artifacts", {})
            )
    
    async def spawn_next_phase(
        self,
        epic_id: str,
        phase: str,
        previous_artifacts: dict,
        session_id: Optional[str] = None
    ):
        """Spawn the next agent container (A2A transition)"""
        
        # Get epic context from database
        epic = await self.get_epic(epic_id)
        
        # Build task for next agent
        task = {
            "id": f"task-{phase}-{uuid4().hex[:8]}",
            "epic_id": epic_id,
            "phase": phase,
            "spec": self.build_phase_spec(phase, epic, previous_artifacts),
            "previous_session": session_id,
            "previous_artifacts": previous_artifacts
        }
        
        # Create Kubernetes Job
        await self.create_agent_job(task, phase)
        
        # Log transition
        await self.redis.xadd(
            "asdlc:workflow:transitions",
            {
                "type": "A2A",
                "epic_id": epic_id,
                "from_phase": self.get_previous_phase(phase),
                "to_phase": phase,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
    
    async def request_hitl_gate(
        self,
        epic_id: str,
        current_phase: str,
        next_phase: str,
        gate_id: str,
        gate_name: str,
        artifacts: dict
    ):
        """Request HITL approval (gate transition)"""
        
        await self.redis.xadd(
            "asdlc:hitl:requests",
            {
                "event": "GateRequired",
                "epic_id": epic_id,
                "current_phase": current_phase,
                "next_phase": next_phase,
                "gate_id": gate_id,
                "gate_name": gate_name,
                "artifacts": json.dumps(artifacts),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
    
    async def handle_gate_approved(self, data: dict):
        """Human approved gate - spawn next phase"""
        
        await self.spawn_next_phase(
            epic_id=data["epic_id"],
            phase=data["next_phase"],
            previous_artifacts=json.loads(data.get("artifacts", "{}")),
            session_id=data.get("session_id")
        )
    
    async def handle_gate_rejected(self, data: dict):
        """Human rejected gate - retry current phase with feedback"""
        
        await self.spawn_next_phase(
            epic_id=data["epic_id"],
            phase=data["current_phase"],  # Same phase, retry
            previous_artifacts={
                "rejection_reason": data["rejection_reason"],
                "feedback": data["feedback"],
                "previous_attempt": json.loads(data.get("artifacts", "{}"))
            }
        )
    
    async def create_agent_job(self, task: dict, agent_type: str):
        """Create Kubernetes Job for agent"""
        
        job_name = f"agent-{task['id']}"
        
        job_manifest = {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {
                "name": job_name,
                "labels": {
                    "app": "asdlc-agent",
                    "phase": agent_type,
                    "epic": task["epic_id"]
                }
            },
            "spec": {
                "ttlSecondsAfterFinished": 3600,  # Cleanup after 1 hour
                "template": {
                    "spec": {
                        "containers": [{
                            "name": "agent",
                            "image": "asdlc/agent:latest",
                            "env": [
                                {"name": "TASK_JSON", "value": json.dumps(task)},
                                {"name": "AGENT_TYPE", "value": agent_type},
                                {"name": "REDIS_URL", "valueFrom": {
                                    "secretKeyRef": {"name": "asdlc-secrets", "key": "redis-url"}
                                }},
                                {"name": "ANTHROPIC_API_KEY", "valueFrom": {
                                    "secretKeyRef": {"name": "asdlc-secrets", "key": "anthropic-key"}
                                }}
                            ],
                            "resources": {
                                "requests": {"memory": "1Gi", "cpu": "500m"},
                                "limits": {"memory": "2Gi", "cpu": "1000m"}
                            },
                            "volumeMounts": [{
                                "name": "workspace",
                                "mountPath": "/workspace"
                            }]
                        }],
                        "volumes": [{
                            "name": "workspace",
                            "persistentVolumeClaim": {"claimName": f"workspace-{task['epic_id']}"}
                        }],
                        "restartPolicy": "Never"
                    }
                }
            }
        }
        
        await self.k8s.batch_v1.create_namespaced_job(
            namespace="asdlc",
            body=job_manifest
        )
    
    def build_phase_spec(
        self,
        phase: str,
        epic: dict,
        previous_artifacts: dict
    ) -> str:
        """Build the prompt/spec for a phase"""
        
        base_prompts = {
            "discovery": f"""
# Discovery Phase

Epic: {epic['title']}
Description: {epic['description']}

Create:
1. Product Requirements Document (PRD)
2. Acceptance criteria
3. User stories

Output files to /workspace/specs/
""",
            "design": f"""
# Design Phase

Epic: {epic['title']}

Previous artifacts:
{json.dumps(previous_artifacts, indent=2)}

Create:
1. Architecture document
2. API specifications  
3. Task breakdown

Use mcp__rag__query_codebase to understand existing patterns.
Use mcp__rlm__deep_analyze for architectural decisions.

Output files to /workspace/design/
""",
            "development": f"""
# Development Phase

Epic: {epic['title']}

Task breakdown from design phase:
{json.dumps(previous_artifacts.get('tasks', []), indent=2)}

Implement using TDD:
1. Write failing test
2. Implement code
3. Refactor

Use TodoWrite to track progress.
Use mcp__rag__query_codebase to find patterns.
Commit after each task with mcp__git__commit.

Output to /workspace/src/
""",
            "test": f"""
# Test Phase

Epic: {epic['title']}

Run comprehensive tests:
1. Unit tests (already written in TDD)
2. Integration tests
3. E2E tests

Use Bash to run test commands.
Generate coverage report.

Output test results to /workspace/test-results/
""",
            "security": f"""
# Security Phase

Epic: {epic['title']}

Run security scans:
1. Dependency audit (npm audit / pip-audit)
2. SAST scan (semgrep)
3. Secret detection

Use mcp__rlm__analyze_security_vulnerability for complex findings.

Output security report to /workspace/security/
""",
            "validator": f"""
# Validation Phase

Epic: {epic['title']}

Validate all quality gates:
1. All tests passing
2. Code coverage > 80%
3. No critical security issues
4. Documentation complete

Generate validation report for HITL review.

Output to /workspace/validation/
""",
            "deployment": f"""
# Deployment Phase

Epic: {epic['title']}

Prepare for deployment:
1. Build artifacts
2. Update deployment configs
3. Create release notes

DO NOT deploy without HITL approval.

Output to /workspace/deployment/
"""
        }
        
        return base_prompts.get(phase, f"# {phase.title()} Phase\n\nExecute {phase} tasks.")
```

---

## Visual: Complete A2A + HITL Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    COMPLETE WORKFLOW                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│   Epic                                                                                               │
│   Created                                                                                            │
│      │                                                                                               │
│      ▼                                                                                               │
│   ┌──────────────┐     ┌─────────┐     ┌──────────────┐     ┌─────────┐     ┌──────────────┐       │
│   │  Discovery   │────▶│ HITL-1  │────▶│    Design    │────▶│ HITL-2  │────▶│ Development  │       │
│   │    Agent     │     │  Gate   │     │    Agent     │     │  Gate   │     │    Agent     │       │
│   └──────────────┘     └─────────┘     └──────────────┘     └─────────┘     └──────────────┘       │
│                         (Human)                              (Human)               │                │
│                                                                                    │ AUTO           │
│                                                                                    ▼ (A2A)          │
│                                                                             ┌──────────────┐       │
│                                                                             │     Test     │       │
│                                                                             │    Agent     │       │
│                                                                             └──────────────┘       │
│                                                                                    │                │
│                                                                                    │ AUTO           │
│                                                                                    ▼ (A2A)          │
│                                                                             ┌──────────────┐       │
│                                                                             │   Security   │       │
│                                                                             │    Agent     │       │
│                                                                             └──────────────┘       │
│                                                                                    │                │
│                                                                                    │ AUTO           │
│                                                                                    ▼ (A2A)          │
│   ┌──────────────┐     ┌─────────┐     ┌──────────────┐     ┌─────────┐     ┌──────────────┐       │
│   │  Deployment  │◀────│ HITL-5  │◀────│  Validator   │◀────│ HITL-4  │◀────│   (Review)   │       │
│   │    Agent     │     │  Gate   │     │    Agent     │     │  Gate   │     │              │       │
│   └──────────────┘     └─────────┘     └──────────────┘     └─────────┘     └──────────────┘       │
│         │               (Human)                              (Human)                                │
│         ▼                                                                                           │
│   ┌─────────┐                                                                                       │
│   │ HITL-6  │                                                                                       │
│   │  Gate   │──────▶ DONE                                                                          │
│   └─────────┘                                                                                       │
│    (Human)                                                                                          │
│                                                                                                      │
│   Legend:                                                                                           │
│   ════════                                                                                          │
│   ───▶  AUTO (A2A): Coordinator spawns next agent immediately                                       │
│   ─┬─▶  HITL Gate: Coordinator waits for human approval                                            │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Sequence Diagram: A2A Transition (Dev → Test)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                     A2A SEQUENCE: Development → Test                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Dev Agent          Redis              Coordinator         K8s            Test Agent│
│       │                │                     │               │                 │     │
│       │  (working...)  │                     │               │                 │     │
│       │                │                     │               │                 │     │
│       │──XADD─────────▶│                     │               │                 │     │
│       │  PhaseCompleted│                     │               │                 │     │
│       │  phase: dev    │                     │               │                 │     │
│       │  status:success│                     │               │                 │     │
│       │                │                     │               │                 │     │
│       │  EXIT          │◀──XREAD─────────────│               │                 │     │
│       X                │   (blocking)        │               │                 │     │
│                        │                     │               │                 │     │
│                        │────event────────────▶               │                 │     │
│                        │                     │               │                 │     │
│                        │                     │ Check WORKFLOW│                 │     │
│                        │                     │ dev→test: AUTO│                 │     │
│                        │                     │               │                 │     │
│                        │                     │──Create Job──▶│                 │     │
│                        │                     │  agent-test-x │                 │     │
│                        │                     │               │                 │     │
│                        │                     │               │──Start──────────▶     │
│                        │                     │               │  Container      │     │
│                        │                     │               │                 │     │
│                        │◀──XADD──────────────────────────────────────────────────────│
│                        │  progress events    │               │                 │     │
│                        │                     │               │   (testing...)  │     │
│                        │                     │               │                 │     │
│                        │◀──XADD──────────────────────────────────────────────────────│
│                        │  PhaseCompleted     │               │                 │     │
│                        │  phase: test        │               │   EXIT          │     │
│                        │                     │               │                 X     │
│                        │                     │               │                       │
│                                                                                      │
│   Total time between agents: ~seconds (K8s job scheduling)                          │
│   No human involved, fully automated                                                │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Transition | Type | Mechanism |
|------------|------|-----------|
| Discovery → Design | HITL | Coordinator waits for `GateApproved` event |
| Design → Development | HITL | Coordinator waits for `GateApproved` event |
| **Development → Test** | **AUTO (A2A)** | **Coordinator spawns immediately** |
| **Test → Security** | **AUTO (A2A)** | **Coordinator spawns immediately** |
| **Security → Validator** | **AUTO (A2A)** | **Coordinator spawns immediately** |
| Validator → Deployment | HITL | Coordinator waits for `GateApproved` event |
| Deployment → Done | HITL | Coordinator waits for `GateApproved` event |

**The Coordinator is your A2A protocol.** It's the central orchestrator that:
1. Consumes completion events from Redis
2. Checks workflow rules (AUTO vs HITL)
3. Spawns next agent immediately for A2A transitions
4. Waits for human approval for HITL transitions
