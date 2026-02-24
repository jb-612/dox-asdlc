# Stateless Agent Contract — P15 Cross-Cutting Design

**Status:** Draft
**Date:** 2026-02-22
**Author:** Planner
**Addresses:** CRIT-1 (Architect Synthesis), MT-1
**Features:** F03, F04, F05

---

## Overview

This document defines the explicit input/output contract for stateless agent blocks
in the Workflow Studio execution pipeline. Every block — whether sequential or parallel —
follows this contract to ensure deterministic state passing, reproducible results, and
clean separation between blocks.

The core principle: **agents are stateless between invocations**. All state is passed
via the filesystem (bind-mounted workspace + `.output/` directory) and environment
variables. A block that starts in a fresh container or wakes from dormancy must produce
the same behavior given identical filesystem state.

---

## Input Contract

Each block receives the following inputs when it starts executing:

### 1. System Prompt Assembly

The full system prompt is assembled by the `ExecutionEngine` in this order:

```
[WorkflowDefinition.rules]              (workflow-level rules, injected into ALL blocks)
\n\n
[AgentNodeConfig.systemPromptPrefix]     (block-level harness prefix, e.g., "You are a senior planner...")
\n\n
[Agent task instruction]                 (the node's systemPrompt / task description)
\n\n
[File restriction instruction]           (if RepoMount.fileRestrictions is set)
    "Only modify files matching: [patterns]. Other files are read-only."
\n\n
[AgentNodeConfig.outputChecklist]        (rendered as numbered requirements list)
    "You must produce the following outputs:\n1) ...\n2) ..."
```

If any section is absent or empty, it is omitted (no blank lines injected).

### 2. Environment Variables

Set by `ContainerPool.createContainer()` or `CLISpawner.spawn()`:

| Variable | Type | Description |
|----------|------|-------------|
| `WORKFLOW_ID` | string | The `WorkflowDefinition.id` |
| `EXECUTION_ID` | string | The `Execution.id` for this run |
| `NODE_ID` | string | The `AgentNode.id` of the current block |
| `STEP_INDEX` | number | 0-based index in the execution sequence |
| `FILE_RESTRICTIONS` | JSON string | Array of glob patterns from `RepoMount.fileRestrictions`, e.g., `["src/workers/**", "src/core/**"]`. Empty array `[]` if unrestricted. |
| `TELEMETRY_ENABLED` | `"1"` or `"0"` | Whether telemetry hook should send events |
| `TELEMETRY_URL` | URL string | HTTP endpoint for telemetry events, e.g., `http://host.docker.internal:9292/telemetry` |
| `OUTPUT_DIR` | string | Path to the output directory, always `/workspace/.output` |
| `PREVIOUS_BLOCK_ID` | string or empty | The `NODE_ID` of the immediately preceding block (empty for first block) |

### 3. Working Directory

The working directory is always `/workspace` inside the container, bind-mounted from the
host repo path (`RepoMount.localPath`):

```
docker create ... -v <repoMount.localPath>:/workspace ...
```

The `/workspace` directory contains:
- The full repository tree (or the cloned subset)
- A `.output/` subdirectory (created by the execution engine before first block)

### 4. Previous Block Output

For sequential blocks, the previous block's structured output is available at:

```
/workspace/.output/block-<prevNodeId>.json
```

The agent can read this file to understand what the previous block produced.
The execution engine does NOT inject previous output into the system prompt automatically —
the agent discovers it via the filesystem. This keeps prompts focused and avoids
context window inflation.

---

## Output Contract

Each block produces two categories of output:

### 1. Modified Files in `/workspace`

For coding blocks (`dev`, `devops`), the primary output is file modifications in the
workspace. The execution engine detects changes by comparing file modification timestamps
before and after block execution.

### 2. Structured Output File

Every block MUST produce a structured output file at:

```
/workspace/.output/block-<nodeId>.json
```

Schema:

```json
{
  "blockId": "string",
  "blockType": "plan | dev | test | review | devops",
  "status": "completed | failed | partial",
  "deliverables": {},
  "summary": "string",
  "filesModified": ["string"],
  "filesCreated": ["string"],
  "timestamp": "ISO-8601"
}
```

Field definitions:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `blockId` | string | Yes | The `NODE_ID` of this block |
| `blockType` | enum | Yes | Maps from `AgentNodeType` via `BLOCK_TYPE_METADATA` |
| `status` | enum | Yes | `completed` = all outputs produced; `failed` = block errored; `partial` = some outputs produced |
| `deliverables` | `BlockDeliverables` | Yes | Union type from `execution.ts` — varies by block type |
| `summary` | string | Yes | Human-readable summary of what the block produced (1-3 sentences) |
| `filesModified` | string[] | Yes | Relative paths of files modified by this block (empty array if none) |
| `filesCreated` | string[] | Yes | Relative paths of files created by this block (empty array if none) |
| `timestamp` | string | Yes | ISO-8601 timestamp of block completion |

### Deliverables by Block Type

Maps to the `BlockDeliverables` union in `execution.ts`:

**Plan block (`PlanBlockDeliverables`):**
```json
{
  "blockType": "plan",
  "markdownDocument": "# Requirements\n...",
  "taskList": ["T01: ...", "T02: ..."]
}
```

**Code block (`CodeBlockDeliverables`):**
```json
{
  "blockType": "code",
  "filesChanged": ["src/workers/pool.ts", "src/workers/pool.test.ts"],
  "diffSummary": "Added ContainerPool class with 5 methods..."
}
```

**Generic block (`GenericBlockDeliverables`):**
```json
{
  "blockType": "generic",
  "summary": "Review completed with 3 findings..."
}
```

### Output File Creation

The execution engine is responsible for:
1. Creating `/workspace/.output/` before the first block runs
2. Validating the output file exists and parses correctly after each block
3. If the output file is missing or malformed, marking the block as `failed`

The agent is responsible for:
1. Writing the output file before exiting
2. Ensuring `filesModified` and `filesCreated` are accurate

---

## State Passing Rules

### Sequential Blocks (Same Container via Dormancy)

When containers are reused via the dormancy mechanism (`docker pause` / `docker unpause`):

1. The bind mount (`/workspace`) is shared — Block B sees all of Block A's file changes
2. The `.output/` directory accumulates: `block-A.json`, `block-B.json`, etc.
3. In-memory state from Block A is preserved (the container was paused, not stopped)
4. Environment variables are set once at container creation and persist across blocks

```
Block A runs  ->  writes /workspace/.output/block-A.json  ->  container paused
                                                                      |
Block B starts  <-  container unpaused  <-  sees block-A.json + file changes
```

### Sequential Blocks (New Container / Cold Start)

When a new container is created for a sequential block:

1. Same bind mount path — host filesystem persists between containers
2. `.output/` directory already contains previous blocks' output files
3. No in-memory state from previous blocks — true stateless behavior
4. Environment variables set fresh by `ContainerPool.createContainer()`

This is the "stateless" path. The block relies solely on:
- Filesystem state in `/workspace/`
- Output files in `/workspace/.output/`
- Environment variables

### Parallel Blocks (Fan-Out)

When multiple blocks execute concurrently in a `ParallelGroup`:

1. **Each block gets an isolated workspace** to prevent file conflicts
2. Isolation strategy (chosen at `ContainerPool.acquire()` time):

   | Strategy | Mechanism | Trade-off |
   |----------|-----------|-----------|
   | `git-worktree` (preferred) | `git worktree add /workspace-lane-<n> HEAD` | Lightweight; shares git objects; requires `.git` |
   | `temp-copy` (fallback) | `cp -r /workspace /tmp/workspace-lane-<n>` | Works for non-git repos; slower for large repos |

3. Each parallel container gets its own bind mount to the isolated workspace
4. The `.output/` directory is per-workspace: each block writes its own output file
5. Environment variables include the same `WORKFLOW_ID` and `EXECUTION_ID` but distinct `NODE_ID` and `STEP_INDEX`

### Parallel Blocks (Fan-In / Merge)

When all blocks in a `ParallelGroup` complete:

1. Collect all `.output/block-<nodeId>.json` files from each lane workspace
2. Copy output files to the main `/workspace/.output/` directory
3. Apply file changes based on the configured merge strategy

#### Merge Strategies

| Strategy | When Used | Behavior |
|----------|-----------|----------|
| `concatenate` | Review/analysis blocks (no file edits) | Combine `.output/` files from all lanes into main workspace. No file merge needed. |
| `workspace` | Coding blocks (default) | Apply file changes in completion order. If same file modified by 2+ lanes, detect conflict via file modification timestamps. |
| `fail-on-conflict` | Safety-critical workflows | If any file conflict detected (same file modified by 2+ lanes), pause execution and present conflict to user via HITL gate. |

#### Conflict Detection

A conflict occurs when:
- Two or more lanes modify the same file (relative path)
- Detection: compare `filesModified` arrays across all lane output files

When a conflict is detected under `workspace` strategy:
1. Apply changes in lane completion order (first to finish wins)
2. Emit `lane:conflict-detected` event to renderer with:
   ```json
   {
     "conflictingFile": "src/workers/pool.ts",
     "lanes": ["lane-a-nodeId", "lane-b-nodeId"],
     "resolution": "first-complete-wins",
     "appliedFrom": "lane-a-nodeId"
   }
   ```
3. User sees the conflict in the EventLogPanel but execution continues

When a conflict is detected under `fail-on-conflict` strategy:
1. Pause execution
2. Present conflict to user via block gate (F04 multi-step UX)
3. User chooses which lane's version to keep, or manually resolves

---

## Dormancy Behavior

### Container Paused (docker pause)

When a container goes dormant via `docker pause`:
- All processes are frozen (SIGSTOP to cgroup)
- Memory state is preserved (heap, stack, file descriptors)
- The container is NOT truly stateless — it retains in-memory state
- When woken (`docker unpause`), it resumes exactly where it left off
- This is the fast path for sequential block reuse

### Container Cold Start (new container)

When a new container starts for a block:
- No in-memory state from previous blocks
- The block relies solely on filesystem state:
  - `/workspace/` — repository files (modified by previous blocks)
  - `/workspace/.output/` — structured output files from previous blocks
- Environment variables provide execution context
- This is the true stateless path

### Implications for Block Implementation

Blocks MUST NOT rely on in-memory state between invocations. Even though dormancy
preserves memory, the execution engine may choose cold start at any time (e.g., if
the dormant container was terminated due to timeout). Therefore:

1. All inter-block communication goes through `/workspace/.output/` files
2. No global variables, caches, or in-memory databases survive between blocks
3. The system prompt and environment variables provide all necessary context
4. File system state in `/workspace/` is the canonical source of truth

---

## Type Additions to `execution.ts`

The following types should be added to `apps/workflow-studio/src/shared/types/execution.ts`:

```typescript
// ---------------------------------------------------------------------------
// Block output contract (P15 cross-cutting)
// ---------------------------------------------------------------------------

export type BlockType = 'plan' | 'dev' | 'test' | 'review' | 'devops';

export type BlockOutputStatus = 'completed' | 'failed' | 'partial';

export interface BlockOutput {
  blockId: string;
  blockType: BlockType;
  status: BlockOutputStatus;
  deliverables: BlockDeliverables;
  summary: string;
  filesModified: string[];
  filesCreated: string[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Merge strategy for parallel fan-in
// ---------------------------------------------------------------------------

export type MergeStrategy = 'concatenate' | 'workspace' | 'fail-on-conflict';

export interface LaneConflict {
  conflictingFile: string;
  lanes: string[];
  resolution: 'first-complete-wins' | 'user-resolved';
  appliedFrom?: string;
}

export interface FanInResult {
  mergeStrategy: MergeStrategy;
  blockOutputs: BlockOutput[];
  conflicts: LaneConflict[];
}
```

---

## Integration Points

### F03 (Execute Launcher)

- Sets `RepoMount.localPath` as the bind mount source for `/workspace`
- Passes `RepoMount.fileRestrictions` to the execution engine
- Creates `/workspace/.output/` before first block

### F04 (Multi-Step UX)

- Reads `BlockOutput` from `/workspace/.output/block-<nodeId>.json` after each block
- Renders `deliverables` in the `DeliverablesViewer` component
- Uses `summary` for the gate prompt ("Block produced: {summary}")
- `status === 'failed'` triggers error display instead of Continue/Revise choice

### F05 (Parallel Execution Engine)

- `ContainerPool.createContainer()` sets all environment variables
- `WorkflowExecutor.fanOut()` creates isolated workspaces per lane
- `WorkflowExecutor.fanIn()` executes merge strategy and collects `BlockOutput` files
- Conflict detection compares `filesModified` across lane outputs

### Execution Engine Changes

The `ExecutionEngine` must be updated to:

1. **Before first block:** Create `/workspace/.output/` directory
2. **Before each block:** Set `PREVIOUS_BLOCK_ID` environment variable
3. **After each block:** Read and validate `/workspace/.output/block-<nodeId>.json`
4. **On block failure:** If output file missing, create a synthetic `BlockOutput` with `status: 'failed'`
5. **Assemble system prompt:** Follow the prompt assembly order defined above
