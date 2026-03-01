import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition, HITLGateDefinition, AgentNode, WorkflowPlan, ParallelLane } from '../../shared/types/workflow';
import type {
  BlockResult,
  Execution,
  ExecutionStatus,
  NodeExecutionStatus,
  NodeExecutionState,
  ExecutionEvent,
  ExecutionEventType,
  FileDiff,
  ParallelBlockResult,
} from '../../shared/types/execution';
import { WorkflowExecutor } from './workflow-executor';
import type { ExecutorContainerPool } from './workflow-executor';
import { ExecutorEngineAdapter } from './executor-engine-adapter';
import type { WorkItemReference } from '../../shared/types/workitem';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { EngineHost } from '../../cli/types';
import type { CLISpawner } from './cli-spawner';
import type { RedisEventClient } from './redis-client';
import { captureGitDiff } from './diff-capture';
import { computeProgressiveTimeout } from './retry-utils';
import { evaluateExpression } from './expression-evaluator';
import type { ExecutionHistoryService } from './execution-history-service';
import type { ExecutionHistoryEntry } from '../../shared/types/execution';
import type { AnalyticsService } from './analytics-service';
import type { ExecutionCostSummary } from '../../shared/types/analytics';

/** Validate a node ID to prevent path traversal in file operations. */
function isValidNodeId(nodeId: string): boolean {
  return /^[\w-]{1,128}$/.test(nodeId);
}

/** Strip null bytes and truncate a prompt field to prevent injection. */
function sanitizePromptField(field: string, maxLen = 4096): string {
  return field.replace(/\0/g, '').slice(0, maxLen);
}

// ---------------------------------------------------------------------------
// ExecutionEngine
//
// Executes a workflow DAG node-by-node using topological sort. Supports two
// execution modes:
//
//   1. MOCK MODE (mockMode: true)
//      Simulates agent work with random 1-3 second delays. Useful for UI
//      development and demo purposes.
//
//   2. REAL CLI MODE (default, mockMode: false)
//      Spawns actual CLI processes via CLISpawner for each agent node.
//      Monitors process exit codes to determine node success/failure.
//      Supports configurable timeout per node.
//
// HITL gates pause the traversal until the renderer submits a decision via
// IPC regardless of mode.
// ---------------------------------------------------------------------------

export interface ExecutionEngineOptions {
  mockMode?: boolean;
  cliSpawner?: CLISpawner;
  redisClient?: RedisEventClient;
  nodeTimeoutMs?: number;
  remoteAgentUrl?: string;
  /** Working directory for CLI spawner (from repoMount.localPath) */
  workingDirectory?: string;
  /** File restriction glob patterns (from repoMount.fileRestrictions) */
  fileRestrictions?: string[];
  /** Whether the repo is mounted read-only (T23) */
  readOnly?: boolean;
  /** Execution history service for persistent history (P15-F14) */
  historyService?: ExecutionHistoryService;
  /** Resolver for loading sub-workflow definitions by ID (P15-F15) */
  workflowResolver?: (workflowId: string) => WorkflowDefinition | null;
  /** Current sub-workflow nesting depth (P15-F15, internal) */
  subWorkflowDepth?: number;
  /** Analytics service for cost tracking persistence (P15-F16) */
  analyticsService?: AnalyticsService;
  /** Headless gate handler: returns decision string for HITL gates (P15-F17) */
  gateHandler?: (gateId: string, prompt: string) => string;
}

export class ExecutionEngine {
  private execution: Execution | null = null;
  private isPaused = false;
  private isAborted = false;
  private host: EngineHost | null = null;

  /** Whether to use mock execution (true) or real CLI spawning (false, default). */
  private mockMode: boolean;
  /** CLI process spawner, required when mockMode is false. */
  private cliSpawner: CLISpawner | null;
  /** Optional Redis client for monitoring event streams. */
  private redisClient: RedisEventClient | null;
  /** Default timeout for CLI node execution in milliseconds. */
  private nodeTimeoutMs: number;
  /** Optional URL for remote agent execution (e.g. Cursor agent container). */
  private remoteAgentUrl: string | null;
  /** Working directory for CLI spawner (repo mount path). */
  private workingDirectory: string | null;
  /** File restriction patterns for the execution. */
  private fileRestrictions: string[];
  /** Whether the repo is mounted read-only. */
  private readOnly: boolean;
  /** Optional history service for persisting execution results (P15-F14). */
  private historyService: ExecutionHistoryService | null;
  /** Resolver for loading sub-workflow definitions by ID (P15-F15). */
  private workflowResolver: ((workflowId: string) => WorkflowDefinition | null) | null;
  /** Current sub-workflow nesting depth (P15-F15). */
  private subWorkflowDepth: number;
  /** Analytics service for cost tracking persistence (P15-F16). */
  private analyticsService: AnalyticsService | null;
  /** Headless gate handler (P15-F17). */
  private gateHandler: ((gateId: string, prompt: string) => string) | null;
  /** Node IDs to skip during resume replay (P15-F14). */
  private resumeSkipNodeIds: Set<string> | null = null;
  /** Node IDs to skip due to condition branch routing (P15-F15). */
  private conditionSkipNodeIds = new Set<string>();

  /**
   * Optional container pool for parallel execution (P15-F09 T07).
   * When set and the workflow has parallelGroups, execution routes
   * through WorkflowExecutor instead of sequential node walking.
   */
  public containerPool: ExecutorContainerPool | null = null;

  /** Pending gate resolvers keyed by nodeId. */
  private gateResolvers = new Map<string, (decision: string) => void>();

  /** Pending CLI exit resolvers keyed by CLI session ID. */
  private cliExitResolvers = new Map<string, (exitCode: number) => void>();

  /** Maps CLI session IDs to node IDs for exit handling. */
  private sessionToNode = new Map<string, string>();

  constructor(host: EngineHost, options?: ExecutionEngineOptions) {
    // Adapt BrowserWindow shape ({ webContents: { send } }) to EngineHost
    const bw = host as unknown as { webContents?: { send: (...a: unknown[]) => void } };
    if (bw.webContents && typeof bw.webContents.send === 'function') {
      this.host = { send: (ch: string, ...args: unknown[]) => bw.webContents!.send(ch, ...args) };
    } else {
      this.host = host;
    }
    this.mockMode = options?.mockMode ?? false;
    this.cliSpawner = options?.cliSpawner ?? null;
    this.redisClient = options?.redisClient ?? null;
    this.nodeTimeoutMs = options?.nodeTimeoutMs ?? 300000; // 5 minute default
    this.remoteAgentUrl = options?.remoteAgentUrl ?? null;
    this.workingDirectory = options?.workingDirectory ?? null;
    this.fileRestrictions = options?.fileRestrictions ?? [];
    this.readOnly = options?.readOnly ?? false;
    this.historyService = options?.historyService ?? null;
    this.workflowResolver = options?.workflowResolver ?? null;
    this.subWorkflowDepth = options?.subWorkflowDepth ?? 0;
    this.analyticsService = options?.analyticsService ?? null;
    this.gateHandler = options?.gateHandler ?? null;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Start executing a workflow.
   *
   * Creates the Execution state, topologically sorts the DAG, and walks
   * through each node sequentially. For every node that has a gate
   * attached, the engine pauses and waits for a decision from the renderer.
   *
   * In mock mode, nodes are simulated with a 1-3 second random delay.
   * In real mode, CLI processes are spawned for each agent node.
   */
  async start(
    workflow: WorkflowDefinition,
    workItem?: WorkItemReference,
  ): Promise<Execution> {
    // Reset control flags
    this.isPaused = false;
    this.isAborted = false;
    this.gateResolvers.clear();
    this.cliExitResolvers.clear();
    this.sessionToNode.clear();
    this.conditionSkipNodeIds.clear();

    // Create execution state
    const executionId = uuidv4();
    const traceId = uuidv4();
    const now = new Date().toISOString();

    this.execution = {
      id: executionId,
      workflowId: workflow.id,
      workflow,
      workItem,
      status: 'running',
      nodeStates: {},
      events: [],
      variables: {},
      startedAt: now,
      traceId,
    };

    // Initialize variables from workflow defaults (P15-F15)
    for (const v of workflow.variables) {
      if (v.defaultValue !== undefined) {
        this.execution.variables[v.name] = v.defaultValue;
      }
    }

    // Initialize all node states to pending
    for (const node of workflow.nodes) {
      this.execution.nodeStates[node.id] = {
        nodeId: node.id,
        status: 'pending',
      };
    }

    this.emitEvent('execution_started', undefined, 'Execution started');
    this.sendStateUpdate();

    // Get topological order
    const sorted = this.topologicalSort(workflow);
    if (!sorted) {
      this.setStatus('failed');
      this.emitEvent(
        'execution_failed',
        undefined,
        'Workflow contains cycles and cannot be executed',
      );
      this.sendStateUpdate();
      return this.execution;
    }

    // Parallel detection (P15-F09 T07): if the workflow has parallelGroups,
    // route to the parallel execution path via WorkflowExecutor.
    if (workflow.parallelGroups && workflow.parallelGroups.length > 0) {
      if (this.containerPool) {
        return this.startParallel(workflow);
      } else {
        this.setStatus('failed');
        this.execution.completedAt = new Date().toISOString();
        this.emitEvent(
          'execution_failed',
          undefined,
          'Docker required for parallel execution — container pool not available',
        );
        this.sendStateUpdate();
        return this.execution;
      }
    }

    // Execute nodes in order (sequential path)
    for (const nodeId of sorted) {
      if (this.isAborted) break;

      // Honour pause: spin until resumed or aborted
      while (this.isPaused && !this.isAborted) {
        await this.sleep(100);
      }
      if (this.isAborted) break;

      const node = workflow.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      // Resume replay: skip pre-completed nodes (P15-F14)
      if (this.resumeSkipNodeIds?.has(nodeId)) {
        this.updateNodeState(nodeId, 'completed', { completedAt: new Date().toISOString() });
        this.emitEvent('node_skipped', nodeId, `Skipped (resume): ${node.label}`);
        continue;
      }

      // Condition branch routing: skip nodes not chosen by a condition (P15-F15)
      if (this.conditionSkipNodeIds.has(nodeId)) {
        this.updateNodeState(nodeId, 'skipped');
        this.emitEvent('node_skipped', nodeId, `Skipped: ${node.label} (condition branch not taken)`);
        continue;
      }

      // Evaluate transition conditions: skip this node if no incoming
      // transition is satisfied (root nodes with no incoming edges always run).
      if (!this.shouldExecuteNode(nodeId, workflow)) {
        this.updateNodeState(nodeId, 'skipped');
        this.emitEvent('node_skipped', nodeId, `Skipped: ${node.label} (transition condition not met)`);
        continue;
      }

      this.execution.currentNodeId = nodeId;

      // Check if this node has a HITL gate
      const gate = workflow.gates.find((g) => g.nodeId === nodeId);
      if (gate) {
        const shouldContinue = await this.handleGate(gate, nodeId);
        if (!shouldContinue || this.isAborted) break;
      }

      // Execute node using the appropriate mode
      this.updateNodeState(nodeId, 'running', { startedAt: new Date().toISOString() });
      this.emitEvent('node_started', nodeId, `Started: ${node.label}`);

      // Control-flow node dispatch (P15-F15)
      if (node.kind === 'control' && node.config.blockType === 'condition') {
        this.executeConditionNode(nodeId, node);
        continue;
      }
      if (node.kind === 'control' && node.config.blockType === 'forEach') {
        await this.executeForEachNode(nodeId, node, workflow);
        continue;
      }
      if (node.kind === 'control' && node.config.blockType === 'subWorkflow') {
        await this.executeSubWorkflowNode(nodeId, node);
        continue;
      }

      if (node.config.backend === 'codex') {
        this.updateNodeState(nodeId, 'failed', {
          completedAt: new Date().toISOString(),
          error: 'Codex backend not yet supported',
        });
        this.emitEvent('node_failed', nodeId, 'Codex backend not yet supported');
      } else if (node.config.backend === 'cursor') {
        await this.executeNodeRemote(nodeId, node);
      } else if (this.mockMode) {
        await this.executeNodeMock(nodeId);
      } else {
        await this.executeNodeReal(nodeId, node);
      }

      // If aborted during execution, we already handled state
      if (this.isAborted) break;
    }

    // Check if any node failed during execution
    const hasFailedNodes = this.execution.nodeStates &&
      Object.values(this.execution.nodeStates).some((ns) => ns.status === 'failed');

    // Final status
    if (this.isAborted) {
      this.setStatus('aborted');
      this.execution.completedAt = new Date().toISOString();
      this.emitEvent('execution_aborted', undefined, 'Execution aborted by user');
    } else if (hasFailedNodes) {
      this.setStatus('failed');
      this.execution.completedAt = new Date().toISOString();
      this.emitEvent(
        'execution_failed',
        undefined,
        'Execution failed due to node failure(s)',
      );
    } else if (this.execution.status !== 'failed') {
      this.setStatus('completed');
      this.execution.completedAt = new Date().toISOString();
      this.emitEvent(
        'execution_completed',
        undefined,
        'Execution completed successfully',
      );
    }

    this.execution.currentNodeId = undefined;
    this.sendStateUpdate();

    // Save to execution history (P15-F14)
    await this.saveToHistory();

    // Save analytics data (P15-F16)
    await this.saveToAnalytics();

    return this.execution;
  }

  /** Save current execution to history service (P15-F14). */
  private async saveToHistory(): Promise<void> {
    if (!this.historyService || !this.execution) return;

    const retryStats: Record<string, number> = {};
    for (const [nodeId, state] of Object.entries(this.execution.nodeStates)) {
      if (state.retryCount && state.retryCount > 0) {
        retryStats[nodeId] = state.retryCount;
      }
    }

    const entry: ExecutionHistoryEntry = {
      id: this.execution.id,
      workflowId: this.execution.workflowId,
      workflowName: this.execution.workflow.metadata.name,
      workflow: this.execution.workflow,
      workItem: this.execution.workItem,
      status: this.execution.status,
      startedAt: this.execution.startedAt,
      completedAt: this.execution.completedAt,
      nodeStates: this.execution.nodeStates,
      retryStats,
    };

    await this.historyService.addEntry(entry);
  }

  /** Save execution cost summary to analytics service (P15-F16). */
  private async saveToAnalytics(): Promise<void> {
    if (!this.analyticsService || !this.execution) return;

    const startMs = new Date(this.execution.startedAt).getTime();
    const endMs = this.execution.completedAt
      ? new Date(this.execution.completedAt).getTime()
      : Date.now();

    const summary: ExecutionCostSummary = {
      executionId: this.execution.id,
      workflowId: this.execution.workflowId,
      workflowName: this.execution.workflow.metadata.name,
      status: this.execution.status,
      startedAt: this.execution.startedAt,
      completedAt: this.execution.completedAt,
      durationMs: endMs - startMs,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      blockCosts: [],
    };

    try {
      await this.analyticsService.saveExecution(summary);
      this.host?.send(IPC_CHANNELS.ANALYTICS_DATA_UPDATED);
    } catch {
      // Analytics persistence is best-effort; don't fail the execution
    }
  }

  // -----------------------------------------------------------------------
  // Control-flow node handlers (P15-F15)
  // -----------------------------------------------------------------------

  /** Execute a condition node: evaluate expression, route branches. CC=3 */
  private executeConditionNode(nodeId: string, node: import('../../shared/types/workflow').AgentNode): void {
    const config = node.config.conditionConfig;
    if (!config) {
      this.updateNodeState(nodeId, 'failed', {
        completedAt: new Date().toISOString(),
        error: 'Missing conditionConfig',
      });
      this.emitEvent('node_failed', nodeId, 'Missing conditionConfig');
      return;
    }

    const result = evaluateExpression(config.expression, this.execution.variables);
    this.execution.variables[`__condition_${nodeId}`] = result;

    if (result) {
      this.conditionSkipNodeIds.add(config.falseBranchNodeId);
    } else {
      this.conditionSkipNodeIds.add(config.trueBranchNodeId);
    }

    this.updateNodeState(nodeId, 'completed', { completedAt: new Date().toISOString() });
    this.emitEvent('node_completed', nodeId, `Condition evaluated: ${result}`);
  }

  /** Execute a ForEach node: iterate collection, run body nodes per item. CC=5 */
  private async executeForEachNode(
    nodeId: string,
    node: import('../../shared/types/workflow').AgentNode,
    workflow: WorkflowDefinition,
  ): Promise<void> {
    const config = node.config.forEachConfig;
    if (!config) {
      this.updateNodeState(nodeId, 'failed', {
        completedAt: new Date().toISOString(),
        error: 'Missing forEachConfig',
      });
      this.emitEvent('node_failed', nodeId, 'Missing forEachConfig');
      return;
    }

    // Mark body nodes so main loop skips them
    for (const bodyId of config.bodyNodeIds) {
      this.conditionSkipNodeIds.add(bodyId);
    }

    const collection = this.execution.variables[config.collectionVariable];
    const items = Array.isArray(collection) ? collection : [];
    const maxIter = config.maxIterations ?? 100;

    if (items.length === 0) {
      this.updateNodeState(nodeId, 'completed', { completedAt: new Date().toISOString() });
      this.emitEvent('node_completed', nodeId, 'ForEach: empty collection, skipped body');
      return;
    }

    const iterCount = Math.min(items.length, maxIter);
    for (let i = 0; i < iterCount; i++) {
      if (this.isAborted) break;

      this.execution.variables[config.itemVariable] = items[i];
      this.execution.variables['__forEach_index'] = i;
      this.emitEvent('node_progress', nodeId, `ForEach iteration ${i + 1}/${iterCount}`);

      // Execute each body node in mock mode for this iteration
      for (const bodyNodeId of config.bodyNodeIds) {
        if (this.isAborted) break;
        if (this.mockMode) {
          await this.executeNodeMock(bodyNodeId);
        }
      }
    }

    this.updateNodeState(nodeId, 'completed', { completedAt: new Date().toISOString() });
    this.emitEvent('node_completed', nodeId, `ForEach completed: ${iterCount} iterations`);
  }

  /** Execute a SubWorkflow node: load + run child workflow. CC=4 */
  private async executeSubWorkflowNode(
    nodeId: string,
    node: import('../../shared/types/workflow').AgentNode,
  ): Promise<void> {
    const config = node.config.subWorkflowConfig;
    if (!config) {
      this.updateNodeState(nodeId, 'failed', {
        completedAt: new Date().toISOString(),
        error: 'Missing subWorkflowConfig',
      });
      this.emitEvent('node_failed', nodeId, 'Missing subWorkflowConfig');
      return;
    }

    if (this.subWorkflowDepth >= 3) {
      this.updateNodeState(nodeId, 'failed', {
        completedAt: new Date().toISOString(),
        error: 'Maximum sub-workflow nesting depth (3) exceeded',
      });
      this.emitEvent('node_failed', nodeId, 'Max depth exceeded');
      return;
    }

    const resolved = this.workflowResolver?.(config.workflowId) ?? null;
    if (!resolved) {
      this.updateNodeState(nodeId, 'failed', {
        completedAt: new Date().toISOString(),
        error: `Sub-workflow not found: ${config.workflowId}`,
      });
      this.emitEvent('node_failed', nodeId, `Sub-workflow not found: ${config.workflowId}`);
      return;
    }

    // Deep-clone to avoid mutating the resolver's cached workflow
    const childWorkflow = structuredClone(resolved);

    // Create child engine with incremented depth
    const childEngine = new ExecutionEngine(this.host!, {
      mockMode: this.mockMode,
      workflowResolver: this.workflowResolver ?? undefined,
      subWorkflowDepth: this.subWorkflowDepth + 1,
    });

    // Map input variables
    if (config.inputMappings) {
      for (const [parentVar, childVar] of Object.entries(config.inputMappings)) {
        const childVarDef = childWorkflow.variables.find(v => v.name === childVar);
        if (childVarDef) {
          childVarDef.defaultValue = this.execution.variables[parentVar];
        }
      }
    }

    const childResult = await childEngine.start(childWorkflow);

    // Map output variables back
    if (config.outputMappings) {
      for (const [childVar, parentVar] of Object.entries(config.outputMappings)) {
        this.execution.variables[parentVar] = childResult.variables[childVar];
      }
    }

    if (childResult.status === 'completed') {
      this.updateNodeState(nodeId, 'completed', { completedAt: new Date().toISOString() });
      this.emitEvent('node_completed', nodeId, `SubWorkflow completed: ${childWorkflow.metadata.name}`);
    } else {
      this.updateNodeState(nodeId, 'failed', {
        completedAt: new Date().toISOString(),
        error: `Sub-workflow ${config.workflowId} ${childResult.status}`,
      });
      this.emitEvent('node_failed', nodeId, `SubWorkflow failed: ${childWorkflow.metadata.name}`);
    }
  }

  /** Pause the execution. Nodes in progress will finish but no new node starts. */
  pause(): void {
    if (this.execution && this.execution.status === 'running') {
      this.isPaused = true;
      this.setStatus('paused');
      this.emitEvent('execution_paused', undefined, 'Execution paused');
      this.sendStateUpdate();
    }
  }

  /** Resume a paused execution. */
  resume(): void {
    if (this.execution && this.execution.status === 'paused') {
      this.isPaused = false;
      this.setStatus('running');
      this.emitEvent('execution_resumed', undefined, 'Execution resumed');
      this.sendStateUpdate();
    }
  }

  /** Abort the execution. Cannot be undone. */
  abort(): void {
    this.isAborted = true;
    this.isPaused = false;

    // Resolve any pending gate so the loop can exit
    for (const [nodeId, resolver] of this.gateResolvers) {
      resolver('__aborted__');
      this.gateResolvers.delete(nodeId);
    }

    // Kill any active CLI sessions and resolve their exit promises
    for (const [sessionId, resolver] of this.cliExitResolvers) {
      if (this.cliSpawner) {
        this.cliSpawner.kill(sessionId);
      }
      resolver(-1); // Signal abort
      this.cliExitResolvers.delete(sessionId);
    }
  }

  /**
   * Submit a HITL gate decision for a node.
   *
   * @param nodeId  The node whose gate is waiting.
   * @param decision  The selected option value (e.g. "approve", "reject").
   */
  submitGateDecision(nodeId: string, decision: string): void {
    const resolver = this.gateResolvers.get(nodeId);
    if (resolver) {
      resolver(decision);
      this.gateResolvers.delete(nodeId);
    }
  }

  /**
   * Handle a CLI process exit event. Called when the CLI_EXIT IPC event is
   * received by the execution handlers.
   *
   * @param sessionId  The CLI session that exited.
   * @param exitCode   The process exit code.
   */
  handleCLIExit(sessionId: string, exitCode: number): void {
    const resolver = this.cliExitResolvers.get(sessionId);
    if (resolver) {
      resolver(exitCode);
      this.cliExitResolvers.delete(sessionId);
    }
  }

  /**
   * Register a mapping from a CLI session ID to a node ID.
   *
   * This is useful when the execution-handlers layer needs to associate
   * CLI output events (which carry a sessionId) with the workflow node
   * that spawned the session.
   *
   * @param sessionId The CLI session identifier.
   * @param nodeId    The workflow node that owns this session.
   */
  registerSessionNode(sessionId: string, nodeId: string): void {
    this.sessionToNode.set(sessionId, nodeId);
  }

  /**
   * Handle raw CLI output data (P15-F04 T08).
   *
   * Called when the CLISpawner emits CLI_OUTPUT for a session managed by
   * this execution. Parses newline-delimited JSON from Claude CLI
   * `--output-format json` and emits structured `tool_call` and
   * `bash_command` events when tool use content blocks are detected.
   *
   * Malformed lines or non-tool output are silently ignored.
   *
   * @param sessionId The CLI session that produced the output.
   * @param data      Raw string data from the PTY.
   */
  handleCLIOutput(sessionId: string, data: string): void {
    if (!this.execution) return;

    const nodeId = this.sessionToNode.get(sessionId);
    const toolCalls = this.parseToolCalls(data);

    for (const tc of toolCalls) {
      this.emitEvent('tool_call', nodeId, `Tool: ${tc.tool} -> ${tc.target}`, {
        tool: tc.tool,
        target: tc.target,
      });

      if (tc.tool === 'Bash') {
        this.emitEvent('bash_command', nodeId, `$ ${tc.target}`, {
          command: tc.target,
        });
      }
    }
  }

  /**
   * Revise a block that is currently in waiting_gate status (P15-F04).
   *
   * Increments the revisionCount, emits a block_revision event, and
   * re-queues the node for execution by resolving its gate with a
   * special '__revise__' sentinel. The engine loop then re-executes
   * the node.
   *
   * @param nodeId   The node to revise.
   * @param feedback User feedback to append to the node prompt.
   * @throws Error if no execution is active, node is not in waiting_gate,
   *         or revisionCount >= 10.
   */
  reviseBlock(nodeId: string, feedback: string): void {
    if (!this.execution) {
      throw new Error('No active execution');
    }

    const nodeState = this.execution.nodeStates[nodeId];
    if (!nodeState || nodeState.status !== 'waiting_gate') {
      throw new Error(`Node ${nodeId} is not in waiting_gate status`);
    }

    const revisionCount = nodeState.revisionCount ?? 0;
    if (revisionCount >= 10) {
      throw new Error(
        'Maximum revisions (10) reached. Please Continue or Abort.',
      );
    }

    // Increment revision count
    nodeState.revisionCount = revisionCount + 1;

    // Emit block_revision event
    this.emitEvent(
      'block_revision',
      nodeId,
      `Block revised (revision ${nodeState.revisionCount}): ${feedback.slice(0, 100)}`,
      { feedback, revisionCount: nodeState.revisionCount },
    );

    this.sendStateUpdate();

    // Resolve the gate with a revise sentinel so the engine re-executes the node
    const resolver = this.gateResolvers.get(nodeId);
    if (resolver) {
      resolver('__revise__');
      this.gateResolvers.delete(nodeId);
    }
  }

  /** Return the current execution snapshot (or null if not started). */
  getState(): Execution | null {
    return this.execution;
  }

  /** Return whether an execution is currently active. */
  isActive(): boolean {
    if (!this.execution) return false;
    return (
      this.execution.status === 'running' ||
      this.execution.status === 'paused' ||
      this.execution.status === 'waiting_gate'
    );
  }

  // -----------------------------------------------------------------------
  // Replay (P15-F14)
  // -----------------------------------------------------------------------

  /**
   * Replay a previous execution from history (P15-F14). CC=4
   */
  async replay(request: {
    historyEntryId: string;
    mode: 'full' | 'resume';
  }): Promise<{ success: boolean; executionId?: string; error?: string }> {
    if (this.isActive()) {
      return { success: false, error: 'Execution already active' };
    }

    if (!this.historyService) {
      return { success: false, error: 'History service not available' };
    }

    const entry = this.historyService.getById(request.historyEntryId);
    if (!entry) {
      return { success: false, error: `History entry not found: ${request.historyEntryId}` };
    }

    const workflow = entry.workflow;

    if (request.mode === 'resume') {
      // Pre-populate completed node states so start() skips them
      const result = await this.startWithPrePopulatedStates(workflow, entry);
      return { success: result.status === 'completed', executionId: result.id };
    }

    // Full replay — just re-execute
    const result = await this.start(workflow, entry.workItem);
    return { success: result.status === 'completed', executionId: result.id };
  }

  /**
   * Start execution with pre-populated node states for resume replay. CC=3
   */
  private async startWithPrePopulatedStates(
    workflow: WorkflowDefinition,
    entry: ExecutionHistoryEntry,
  ): Promise<Execution> {
    // Build a map of pre-completed nodes
    const preCompletedNodeIds = new Set<string>();
    for (const [nodeId, state] of Object.entries(entry.nodeStates)) {
      if (state.status === 'completed') {
        preCompletedNodeIds.add(nodeId);
      }
    }
    this.resumeSkipNodeIds = preCompletedNodeIds;

    const result = await this.start(workflow, entry.workItem);
    this.resumeSkipNodeIds = null;
    return result;
  }

  // -----------------------------------------------------------------------
  // Parallel execution (P15-F09 T08)
  // -----------------------------------------------------------------------

  /**
   * Execute the workflow via WorkflowExecutor for parallel lane dispatch.
   *
   * Builds a WorkflowPlan from the workflow's parallelGroups, creates an
   * ExecutorEngineAdapter and WorkflowExecutor, runs the plan, then maps
   * the ParallelBlockResult array back to the execution's nodeStates.
   *
   * Cyclomatic complexity: 5 (try/catch, result iteration success/fail,
   * hasFailures branch, error path).
   *
   * @param workflow The workflow definition with populated parallelGroups.
   * @returns The execution state after parallel completion.
   */
  private async startParallel(workflow: WorkflowDefinition): Promise<Execution> {
    // Build a WorkflowPlan from the parallelGroups
    const plan: WorkflowPlan = {
      lanes: (workflow.parallelGroups ?? []).map((group): ParallelLane => ({
        nodeIds: group.laneNodeIds,
      })),
      parallelismModel: 'multi-container',
      failureMode: 'lenient',
    };

    // Build a prompt function that delegates to buildSystemPrompt
    const buildPromptFn = (blockId: string): string => {
      const node = workflow.nodes.find((n) => n.id === blockId);
      if (!node) return `Execute block: ${blockId}`;
      return this.buildSystemPrompt(node, workflow.rules);
    };

    // Create the adapter and executor
    const adapter = new ExecutorEngineAdapter({
      spawn: this.cliSpawner
        ? (config) => this.cliSpawner!.spawn(config)
        : () => ({ id: 'mock-session', status: 'mock' }),
      waitForExit: async (sessionId: string, timeoutMs: number) =>
        this.waitForCLIExit(sessionId, timeoutMs),
      buildPromptFn,
      mockMode: this.mockMode,
    });

    const emitIPC = (channel: string, data: unknown): void => {
      this.host?.send(channel, data);
    };

    const executor = new WorkflowExecutor(this.containerPool!, adapter, emitIPC);

    try {
      const results = await executor.execute(plan);

      // Separate successes from failures, then retry failed blocks (P15-F14)
      const finalResults = await this.processParallelResults(
        results,
        workflow,
        executor,
      );

      // Set final execution status
      const hasFailures = finalResults.some(r => !r.success);
      if (hasFailures) {
        this.setStatus('failed');
        this.execution!.completedAt = new Date().toISOString();
        this.emitEvent(
          'execution_failed',
          undefined,
          'Execution failed due to node failure(s)',
        );
      } else {
        this.setStatus('completed');
        this.execution!.completedAt = new Date().toISOString();
        this.emitEvent(
          'execution_completed',
          undefined,
          'Execution completed successfully',
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus('failed');
      this.execution!.completedAt = new Date().toISOString();
      this.emitEvent(
        'execution_failed',
        undefined,
        `Parallel execution failed: ${message}`,
      );
    }

    this.execution!.currentNodeId = undefined;
    this.sendStateUpdate();

    // Save to execution history (P15-F14)
    await this.saveToHistory();

    return this.execution!;
  }

  // -----------------------------------------------------------------------
  // Parallel result processing + retry (P15-F14)
  // -----------------------------------------------------------------------

  /**
   * Process parallel execution results: mark successes, retry failures. CC=4
   */
  private async processParallelResults(
    results: ParallelBlockResult[],
    workflow: WorkflowDefinition,
    executor: { execute: (plan: WorkflowPlan) => Promise<ParallelBlockResult[]> },
  ): Promise<ParallelBlockResult[]> {
    const finalResults: ParallelBlockResult[] = [];
    const failedBlockIds: string[] = [];

    for (const result of results) {
      if (result.success) {
        this.updateNodeState(result.blockId, 'completed', {
          completedAt: new Date().toISOString(),
          output: result.output,
        });
        this.emitEvent('node_completed', result.blockId, `Completed: ${result.blockId}`);
        finalResults.push(result);
      } else {
        const node = workflow.nodes.find(n => n.id === result.blockId);
        const maxRetries = node?.config?.maxRetries ?? 0;
        if (maxRetries > 0 && !this.isAborted) {
          failedBlockIds.push(result.blockId);
        } else {
          this.updateNodeState(result.blockId, 'failed', {
            completedAt: new Date().toISOString(),
            error: result.error ?? 'Parallel block execution failed',
          });
          this.emitEvent('node_failed', result.blockId, `Failed: ${result.blockId}`);
          finalResults.push(result);
        }
      }
    }

    // Retry failed blocks individually
    for (const blockId of failedBlockIds) {
      const retryResult = await this.retryParallelBlock(blockId, workflow, executor);
      finalResults.push(retryResult);
    }

    return finalResults;
  }

  /**
   * Retry a single failed parallel block up to its maxRetries. CC=4
   */
  private async retryParallelBlock(
    blockId: string,
    workflow: WorkflowDefinition,
    executor: { execute: (plan: WorkflowPlan) => Promise<ParallelBlockResult[]> },
  ): Promise<ParallelBlockResult> {
    const node = workflow.nodes.find(n => n.id === blockId);
    if (!node) {
      return { blockId, success: false, output: null, error: `Node ${blockId} not found`, durationMs: 0 };
    }
    const maxRetries = node.config.maxRetries ?? 0;
    let lastResult: ParallelBlockResult = {
      blockId,
      success: false,
      output: null,
      error: 'retry pending',
      durationMs: 0,
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.isAborted) break;

      this.emitEvent('node_retry', blockId, `Retry ${attempt}/${maxRetries}: ${node.label}`, {
        attempt,
        maxRetries,
        nodeId: blockId,
      });

      const retryPlan: WorkflowPlan = {
        lanes: [{ nodeIds: [blockId] }],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      const retryResults = await executor.execute(retryPlan);
      lastResult = retryResults[0] ?? lastResult;

      this.updateNodeState(blockId, lastResult.success ? 'completed' : 'failed', {
        completedAt: new Date().toISOString(),
        retryCount: attempt,
        lastRetryAt: new Date().toISOString(),
        output: lastResult.output,
        error: lastResult.success ? undefined : lastResult.error,
      });

      if (lastResult.success) {
        this.emitEvent('node_completed', blockId, `Completed after retry: ${node.label}`);
        return lastResult;
      }
    }

    if (!lastResult.success) {
      this.emitEvent('node_retry_exhausted', blockId, `Retries exhausted: ${node.label}`, {
        nodeId: blockId,
        attempts: maxRetries + 1,
      });
      this.emitEvent('node_failed', blockId, `Failed: ${node.label}`);
    }

    return lastResult;
  }

  // -----------------------------------------------------------------------
  // Prompt harness assembly (P15-F01)
  // -----------------------------------------------------------------------

  /**
   * Build the full system prompt for a node by composing workflow rules,
   * systemPromptPrefix, task instruction, output checklist, deliverables
   * instructions, and prior block context.
   *
   * Assembly order:
   *   1. Workflow-level rules (from WorkflowDefinition.rules)
   *   2. Block systemPromptPrefix (from AgentNodeConfig.systemPromptPrefix)
   *   3. Agent task instruction (the node's description / primary task text)
   *   4. Output checklist (from AgentNodeConfig.outputChecklist, numbered)
   *   5. Output deliverables instruction (write to .output/block-<nodeId>.json)
   *   6. Previous block results summary (for sequential state passing)
   *   7. File restrictions (P15-F03)
   *   8. Read-only mount instruction (P15-F03, T23)
   *
   * Backward compatible: if no harness fields are present, returns the
   * original task instruction unchanged.
   *
   * @param node The agent node to build the prompt for.
   * @param workflowRules Optional workflow-level rules to inject.
   * @param previousResults Optional array of prior block results for context.
   */
  buildSystemPrompt(
    node: AgentNode,
    workflowRules?: string[],
    previousResults?: BlockResult[],
  ): string {
    const parts: string[] = [];

    // 1. Workflow-level rules
    if (workflowRules && workflowRules.length > 0) {
      const rulesList = workflowRules.map((r) => `- ${r}`).join('\n');
      parts.push(`Rules:\n${rulesList}`);
    }

    // 2. System prompt prefix
    if (node.config.systemPromptPrefix) {
      parts.push(sanitizePromptField(node.config.systemPromptPrefix));
    }

    // 3. Task instruction (node description or systemPrompt)
    const taskInstruction = node.description || node.config.systemPrompt || `Execute ${node.type} agent: ${node.label}`;
    parts.push(sanitizePromptField(taskInstruction));

    // 4. Output checklist
    if (node.config.outputChecklist && node.config.outputChecklist.length > 0) {
      const checklist = node.config.outputChecklist
        .map((item, i) => `${i + 1}. ${sanitizePromptField(item)}`)
        .join('\n');
      parts.push(`You must produce:\n${checklist}`);
    }

    // 5. Output deliverables instruction
    parts.push(
      `When you finish, write a JSON summary of your deliverables to .output/block-${node.id}.json in the working directory.`,
    );

    // 6. Previous block results (sequential state passing)
    if (previousResults && previousResults.length > 0) {
      const summaries = previousResults.map((r) => {
        const deliverableInfo = r.deliverables
          ? ` | deliverables: ${JSON.stringify(r.deliverables)}`
          : '';
        return `- Block ${r.nodeId}: ${r.status}${deliverableInfo}`;
      }).join('\n');
      parts.push(`Previous block results:\n${summaries}`);
    }

    // 7. File restrictions (P15-F03)
    if (this.fileRestrictions.length > 0) {
      const sanitizedRestrictions = this.fileRestrictions.map((r) => sanitizePromptField(r, 256));
      parts.push(`Only modify files matching: ${sanitizedRestrictions.join(', ')}`);
    }

    // 8. Read-only mount instruction (P15-F03, T23)
    if (this.readOnly) {
      parts.push('This repository is mounted read-only. Do not attempt to write files.');
    }

    return parts.join('\n\n');
  }

  // -----------------------------------------------------------------------
  // Block result reading (stateless agent contract)
  // -----------------------------------------------------------------------

  /**
   * Read the structured output produced by a block agent.
   *
   * After a block completes, the agent is expected to write a JSON file at
   * `<workingDirectory>/.output/block-<nodeId>.json` containing a
   * {@link BlockResult} object with deliverables. This method reads and
   * parses that file.
   *
   * @param workingDirectory Absolute path to the repo working directory.
   * @param nodeId The node ID whose output to read.
   * @returns The parsed BlockResult, or null if the file does not exist or
   *          cannot be parsed.
   */
  readBlockResult(workingDirectory: string, nodeId: string): BlockResult | null {
    if (!isValidNodeId(nodeId)) {
      console.error(`[ExecutionEngine] readBlockResult: invalid nodeId rejected: ${nodeId}`);
      return null;
    }
    const outputPath = join(workingDirectory, '.output', `block-${nodeId}.json`);
    if (!existsSync(outputPath)) {
      return null;
    }
    try {
      const raw = readFileSync(outputPath, 'utf-8');
      return JSON.parse(raw) as BlockResult;
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Node execution modes
  // -----------------------------------------------------------------------

  /**
   * Execute a node in mock mode. Simulates work with a 1-3 second random
   * delay and marks the node as completed with mock output.
   */
  private async executeNodeMock(nodeId: string): Promise<void> {
    const duration = 1000 + Math.random() * 2000;
    await this.sleep(duration);

    // Check abort/pause after sleeping
    if (this.isAborted) {
      this.updateNodeState(nodeId, 'failed', { error: 'Execution aborted' });
      return;
    }

    this.updateNodeState(nodeId, 'completed', {
      completedAt: new Date().toISOString(),
      output: { mock: true, duration: Math.round(duration) },
    });
    this.emitEvent('node_completed', nodeId, `Completed: ${nodeId}`);
  }

  /**
   * Execute a node by spawning a real CLI process via CLISpawner.
   *
   * The engine waits for the CLI process to exit. Exit code 0 means
   * success; any other code means failure. If the process does not exit
   * within the configured timeout, it is killed and the node fails.
   */
  private async executeNodeReal(nodeId: string, node: AgentNode): Promise<void> {
    if (!this.cliSpawner) {
      // Fall back to mock mode if no spawner is available
      this.emitEvent('node_started', nodeId, `No CLI spawner available, falling back to mock`);
      await this.executeNodeMock(nodeId);
      return;
    }

    // Build CLI spawn config from node config
    const args: string[] = [];
    args.push('--output-format', 'json');
    if (node.config.model) {
      args.push('--model', node.config.model);
    }
    if (node.config.maxTurns) {
      args.push('--max-turns', String(node.config.maxTurns));
    }
    if (node.config.extraFlags) {
      args.push(...node.config.extraFlags);
    }

    // Gather results from previously completed blocks for context
    const previousResults = this.collectPreviousBlockResults(nodeId);

    // Build composed system prompt including harness fields and prior context
    const systemPrompt = this.buildSystemPrompt(
      node,
      this.execution?.workflow?.rules,
      previousResults,
    );

    // Build the full prompt with work item context
    const promptParts: string[] = [];
    if (this.execution?.workItem) {
      promptParts.push(`Working on: ${this.execution.workItem.id} - ${this.execution.workItem.title ?? ''}`);
    }
    promptParts.push(systemPrompt);
    const composedPrompt = promptParts.join('\n');

    // Pass prompt via -p flag for non-interactive mode
    args.push('-p', composedPrompt);

    // Capture pre-execution git SHA for code blocks (best-effort)
    let preExecSha: string | null = null;
    if (node.type === 'coding') {
      preExecSha = this.captureGitSha();
    }

    const session = this.cliSpawner.spawn({
      command: 'claude',
      args,
      cwd: this.workingDirectory || process.cwd(),
      instanceId: `${this.execution?.id ?? 'unknown'}-${nodeId}`,
    });

    // Track the session for exit handling
    this.sessionToNode.set(session.id, nodeId);

    // Update node state with CLI session reference
    this.updateNodeState(nodeId, 'running', { cliSessionId: session.id });

    // Wait for CLI exit or timeout (P15-F14: progressive + warning)
    const baseTimeoutMs = (node.config.timeoutSeconds ?? 0) * 1000 || this.nodeTimeoutMs;
    const retryCount = this.execution?.nodeStates[nodeId]?.retryCount ?? 0;
    const timeoutMs = computeProgressiveTimeout(baseTimeoutMs, retryCount);

    // Emit 80% timeout warning (P15-F14)
    const warningTimer = setTimeout(() => {
      this.emitEvent('node_timeout_warning', nodeId, `Node approaching timeout (80%)`, {
        nodeId,
        timeoutMs,
        elapsedPercent: 80,
      });
    }, Math.floor(timeoutMs * 0.8));

    const exitCode = await this.waitForCLIExit(session.id, timeoutMs);
    clearTimeout(warningTimer);

    if (this.isAborted) {
      this.updateNodeState(nodeId, 'failed', { error: 'Execution aborted' });
      return;
    }

    if (exitCode === -1) {
      // Timeout or abort
      this.updateNodeState(nodeId, 'failed', {
        completedAt: new Date().toISOString(),
        error: `CLI session timed out after ${timeoutMs}ms`,
      });
      this.emitEvent('node_failed', nodeId, `Node timed out after ${timeoutMs}ms`);
    } else if (exitCode === 0) {
      // Read block deliverables produced by the agent (stateless contract)
      const workDir = this.workingDirectory || process.cwd();
      const blockResult = this.readBlockResult(workDir, nodeId);
      const output: Record<string, unknown> = { cliSessionId: session.id, exitCode };
      if (blockResult) {
        output.blockResult = blockResult;
      }

      // Capture git diffs for code blocks (best-effort)
      if (node.type === 'coding' && preExecSha) {
        try {
          const fileDiffs = await captureGitDiff(workDir, preExecSha);
          output.fileDiffs = fileDiffs;
        } catch {
          // Diff capture is best-effort — do not fail the node
        }
      }

      this.updateNodeState(nodeId, 'completed', {
        completedAt: new Date().toISOString(),
        output,
      });
      this.emitEvent('node_completed', nodeId, `Completed: ${node.label}`);
    } else {
      this.updateNodeState(nodeId, 'failed', {
        completedAt: new Date().toISOString(),
        error: `CLI exited with exit code ${exitCode}`,
      });
      this.emitEvent('node_failed', nodeId, `Failed with exit code ${exitCode}`);
    }

    // Clean up session tracking
    this.sessionToNode.delete(session.id);
  }

  /**
   * Validate that a URL is safe to use as a remote agent endpoint.
   * Accepts only http: and https: schemes to prevent SSRF via file://, etc.
   */
  private static isValidRemoteUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Execute a node by dispatching to a remote agent via HTTP POST.
   * Used for backends like Cursor that run in a separate container.
   */
  private async executeNodeRemote(nodeId: string, node: AgentNode): Promise<void> {
    if (!this.remoteAgentUrl || !ExecutionEngine.isValidRemoteUrl(this.remoteAgentUrl)) {
      this.updateNodeState(nodeId, 'failed', {
        completedAt: new Date().toISOString(),
        error: 'Invalid or missing remote agent URL',
      });
      this.emitEvent('node_failed', nodeId, 'Invalid remote agent URL');
      return;
    }

    if (this.isAborted) return;

    const composedPrompt = this.buildSystemPrompt(node, this.execution?.workflow?.rules);

    const body = {
      prompt: composedPrompt,
      model: node.config.model,
      timeoutSeconds: node.config.timeoutSeconds ?? Math.floor(this.nodeTimeoutMs / 1000),
      agentRole: node.type,
      extraFlags: node.config.extraFlags,
    };

    const controller = new AbortController();
    // Poll isAborted every 500 ms so a user abort cancels the in-flight fetch.
    const abortPoller = setInterval(() => {
      if (this.isAborted) controller.abort();
    }, 500);

    try {
      const response = await fetch(`${this.remoteAgentUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        this.updateNodeState(nodeId, 'failed', {
          completedAt: new Date().toISOString(),
          error: `Remote agent returned HTTP ${response.status}: ${errorText}`,
        });
        this.emitEvent('node_failed', nodeId, `Remote agent HTTP error: ${response.status}`);
        return;
      }

      const result = await response.json();

      if (result.success) {
        this.updateNodeState(nodeId, 'completed', {
          completedAt: new Date().toISOString(),
          output: result,
        });
        this.emitEvent('node_completed', nodeId, `Completed: ${node.label}`);
      } else {
        this.updateNodeState(nodeId, 'failed', {
          completedAt: new Date().toISOString(),
          error: result.error || 'Remote agent returned failure',
        });
        this.emitEvent('node_failed', nodeId, `Remote agent failed: ${result.error || 'unknown error'}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (this.isAborted) {
        this.updateNodeState(nodeId, 'failed', { error: 'Execution aborted' });
      } else {
        this.updateNodeState(nodeId, 'failed', {
          completedAt: new Date().toISOString(),
          error: `Remote agent request failed: ${message}`,
        });
        this.emitEvent('node_failed', nodeId, `Remote agent unreachable: ${message}`);
      }
    } finally {
      clearInterval(abortPoller);
    }
  }

  /**
   * Wait for a CLI session to exit or for the timeout to expire.
   * Returns the exit code, or -1 on timeout.
   */
  private waitForCLIExit(sessionId: string, timeoutMs: number): Promise<number> {
    return new Promise<number>((resolve) => {
      const timer = setTimeout(() => {
        // Timeout: kill the CLI session and resolve with -1
        this.cliExitResolvers.delete(sessionId);
        if (this.cliSpawner) {
          this.cliSpawner.kill(sessionId);
        }
        resolve(-1);
      }, timeoutMs);

      this.cliExitResolvers.set(sessionId, (exitCode: number) => {
        clearTimeout(timer);
        resolve(exitCode);
      });
    });
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Parse a raw CLI output string for tool_use content blocks.
   *
   * Supports two JSON shapes emitted by Claude CLI:
   *
   *   1. **Message format**: `{ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } }`
   *   2. **Streaming format**: `{ type: "content_block_start", content_block: { type: "tool_use", name, input } }`
   *
   * Returns an array of `{ tool, target }` objects for each tool_use block
   * found. The `target` is extracted heuristically from the tool's input:
   *   - `file_path` for file-based tools (Read, Write, Edit)
   *   - `command` for Bash
   *   - `pattern` for Grep/Glob
   *   - First string value from input as fallback
   *
   * Malformed or non-matching lines return an empty array.
   */
  private parseToolCalls(data: string): Array<{ tool: string; target: string }> {
    const results: Array<{ tool: string; target: string }> = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return results;
    }

    if (!parsed || typeof parsed !== 'object') {
      return results;
    }

    const obj = parsed as Record<string, unknown>;

    // Collect tool_use content blocks from both formats
    const toolBlocks: Array<{ name: string; input: Record<string, unknown> }> = [];

    // Format 1: { type: "assistant", message: { content: [...] } }
    if (obj.type === 'assistant' && obj.message && typeof obj.message === 'object') {
      const msg = obj.message as Record<string, unknown>;
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (
            block &&
            typeof block === 'object' &&
            (block as Record<string, unknown>).type === 'tool_use' &&
            typeof (block as Record<string, unknown>).name === 'string'
          ) {
            toolBlocks.push({
              name: (block as Record<string, unknown>).name as string,
              input: ((block as Record<string, unknown>).input as Record<string, unknown>) ?? {},
            });
          }
        }
      }
    }

    // Format 2: { type: "content_block_start", content_block: { type: "tool_use", ... } }
    if (obj.type === 'content_block_start' && obj.content_block && typeof obj.content_block === 'object') {
      const block = obj.content_block as Record<string, unknown>;
      if (block.type === 'tool_use' && typeof block.name === 'string') {
        toolBlocks.push({
          name: block.name as string,
          input: (block.input as Record<string, unknown>) ?? {},
        });
      }
    }

    // Extract target from each tool block
    for (const { name, input } of toolBlocks) {
      const target = this.extractToolTarget(name, input);
      results.push({ tool: name, target });
    }

    return results;
  }

  /**
   * Extract the most relevant target identifier from a tool's input object.
   *
   * @param toolName The tool name (e.g. "Edit", "Bash", "Grep").
   * @param input    The tool's input parameters.
   * @returns A string identifying the target (file path, command, pattern, etc.).
   */
  private extractToolTarget(toolName: string, input: Record<string, unknown>): string {
    // file_path is the primary target for Read, Write, Edit
    if (typeof input.file_path === 'string') {
      return input.file_path;
    }

    // command for Bash
    if (typeof input.command === 'string') {
      return input.command;
    }

    // pattern for Grep and Glob
    if (typeof input.pattern === 'string') {
      return input.pattern;
    }

    // path for tools that use path as primary input
    if (typeof input.path === 'string') {
      return input.path;
    }

    // Fallback: first string value from input
    for (const value of Object.values(input)) {
      if (typeof value === 'string') {
        return value;
      }
    }

    return toolName;
  }

  /**
   * Collect BlockResult objects from all previously completed nodes.
   *
   * Reads each completed node's output for a stored blockResult, and also
   * attempts to read from the `.output/` directory on disk as a fallback.
   * Returns results in insertion order (which matches topological execution
   * order for sequential workflows).
   *
   * @param currentNodeId The node about to execute (excluded from results).
   * @returns Array of BlockResult from prior completed blocks.
   */
  private collectPreviousBlockResults(currentNodeId: string): BlockResult[] {
    if (!this.execution) return [];

    const results: BlockResult[] = [];
    for (const [nid, state] of Object.entries(this.execution.nodeStates)) {
      if (nid === currentNodeId) continue;
      if (state.status !== 'completed') continue;

      // Check if blockResult was already stored in the output
      const output = state.output as Record<string, unknown> | undefined;
      if (output?.blockResult) {
        results.push(output.blockResult as BlockResult);
        continue;
      }

      // Fallback: try reading from disk
      const workDir = this.workingDirectory || process.cwd();
      const diskResult = this.readBlockResult(workDir, nid);
      if (diskResult) {
        results.push(diskResult);
      }
    }
    return results;
  }

  /**
   * Handle a HITL gate for the given node. Transitions the node and
   * execution into waiting_gate status, then waits for a decision.
   *
   * Returns true if execution should continue, false if aborted.
   */
  private async handleGate(
    gate: HITLGateDefinition,
    nodeId: string,
  ): Promise<boolean> {
    this.updateNodeState(nodeId, 'waiting_gate');
    this.setStatus('waiting_gate');
    this.emitEvent(
      'gate_waiting',
      nodeId,
      `HITL Gate: ${gate.prompt}`,
      {
        gateId: gate.id,
        gateType: gate.gateType,
        prompt: gate.prompt,
        options: gate.options,
        required: gate.required,
      },
    );
    this.sendStateUpdate();

    // Headless gate handler: auto-resolve without waiting for IPC (P15-F17)
    if (this.gateHandler) {
      const decision = this.gateHandler(gate.id, gate.prompt ?? '');
      if (decision === '__gate_fail__') {
        this.updateNodeState(nodeId, 'failed', { error: 'Gate rejected in headless mode' });
        this.emitEvent('node_failed', nodeId, 'Gate rejected: --gate-mode=fail');
        return false;
      }
      this.updateNodeState(nodeId, 'completed');
      this.emitEvent('gate_approved', nodeId, `Gate auto-approved: ${decision}`);
      return true;
    }

    // Block until the renderer submits a decision
    const decision = await new Promise<string>((resolve) => {
      this.gateResolvers.set(nodeId, resolve);
    });

    // Check if aborted while waiting
    if (decision === '__aborted__' || this.isAborted) {
      return false;
    }

    // Handle revise: re-execute the node (P15-F04)
    if (decision === '__revise__') {
      this.setStatus('running');
      this.sendStateUpdate();

      // Re-execute the node
      const node = this.execution?.workflow.nodes.find((n) => n.id === nodeId);
      if (node) {
        this.updateNodeState(nodeId, 'running', { startedAt: new Date().toISOString() });
        this.emitEvent('node_started', nodeId, `Re-executing: ${node.label} (revision)`);

        if (node.config.backend === 'codex') {
          this.updateNodeState(nodeId, 'failed', {
            completedAt: new Date().toISOString(),
            error: 'Codex backend not yet supported',
          });
          this.emitEvent('node_failed', nodeId, 'Codex backend not yet supported');
        } else if (node.config.backend === 'cursor') {
          await this.executeNodeRemote(nodeId, node);
        } else if (this.mockMode) {
          await this.executeNodeMock(nodeId);
        } else {
          await this.executeNodeReal(nodeId, node);
        }

        if (this.isAborted) return false;

        // After re-execution, if the node has gateMode 'gate', show gate again
        if (node.config.gateMode === 'gate') {
          return this.handleGate(gate, nodeId);
        }
      }

      return true;
    }

    this.emitEvent(
      'gate_decided',
      nodeId,
      `Gate decision: ${decision}`,
      { gateId: gate.id, selectedOption: decision, decidedBy: 'user' },
    );
    this.setStatus('running');
    this.sendStateUpdate();
    return true;
  }

  /**
   * Update a single node's execution state and push the change to the
   * renderer.
   */
  private updateNodeState(
    nodeId: string,
    status: NodeExecutionStatus,
    extra?: Partial<NodeExecutionState>,
  ): void {
    if (!this.execution) return;

    const existing = this.execution.nodeStates[nodeId] ?? { nodeId, status: 'pending' };
    this.execution.nodeStates[nodeId] = {
      ...existing,
      ...extra,
      nodeId,
      status,
    };
    this.sendStateUpdate();
  }

  /** Set the top-level execution status. */
  private setStatus(status: ExecutionStatus): void {
    if (this.execution) {
      this.execution.status = status;
    }
  }

  /**
   * Create an ExecutionEvent, store it on the execution, and push it to
   * the renderer.
   */
  private emitEvent(
    type: ExecutionEventType,
    nodeId?: string,
    message?: string,
    data?: unknown,
  ): void {
    const event: ExecutionEvent = {
      id: uuidv4(),
      type,
      timestamp: new Date().toISOString(),
      nodeId,
      data,
      message: message ?? '',
      traceId: this.execution?.traceId,
      spanId: nodeId ? uuidv4() : undefined,
    };
    this.execution?.events.push(event);
    this.host?.send(IPC_CHANNELS.EXECUTION_EVENT, event);
  }

  /** Push the full execution snapshot to the renderer. */
  private sendStateUpdate(): void {
    if (!this.execution) return;
    this.host?.send(
      IPC_CHANNELS.EXECUTION_STATE_UPDATE,
      this.execution,
    );
  }

  // -----------------------------------------------------------------------
  // Graph utilities (inline for main process -- no DOM dependency)
  // -----------------------------------------------------------------------

  /**
   * Evaluate whether a node should execute based on its incoming transition
   * conditions and the statuses of the source nodes.
   *
   * - Root nodes (no incoming transitions) always execute.
   * - A node executes if at least one incoming transition is satisfied:
   *   - 'always': always satisfied (regardless of source status)
   *   - 'on_success': satisfied only if the source node completed
   *   - 'on_failure': satisfied only if the source node failed
   *   - 'expression': evaluates the expression string against workflow variables
   */
  private shouldExecuteNode(
    nodeId: string,
    workflow: WorkflowDefinition,
  ): boolean {
    const incoming = workflow.transitions.filter(
      (t) => t.targetNodeId === nodeId,
    );

    // Root nodes (no incoming transitions) always execute
    if (incoming.length === 0) return true;

    // At least one incoming transition must be satisfied
    for (const t of incoming) {
      const sourceState = this.execution.nodeStates[t.sourceNodeId];
      if (!sourceState) continue;

      const conditionType = t.condition?.type ?? 'always';

      switch (conditionType) {
        case 'always':
          return true;
        case 'expression': {
          const expr = t.condition?.expression;
          if (!expr) return false;
          try {
            if (evaluateExpression(expr, this.execution.variables)) return true;
          } catch {
            return false;
          }
          break;
        }
        case 'on_success':
          if (sourceState.status === 'completed') return true;
          break;
        case 'on_failure':
          if (sourceState.status === 'failed') return true;
          break;
      }
    }

    return false;
  }

  /**
   * Kahn's algorithm for topological sort.
   *
   * Returns an array of node IDs in dependency order, or null if the graph
   * contains a cycle.
   */
  private topologicalSort(workflow: WorkflowDefinition): string[] | null {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const node of workflow.nodes) {
      inDegree.set(node.id, 0);
      adj.set(node.id, []);
    }

    for (const t of workflow.transitions) {
      adj.get(t.sourceNodeId)?.push(t.targetNodeId);
      inDegree.set(
        t.targetNodeId,
        (inDegree.get(t.targetNodeId) ?? 0) + 1,
      );
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      for (const neighbor of adj.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return sorted.length === workflow.nodes.length ? sorted : null;
  }

  /** Capture the current git HEAD SHA (best-effort). Returns null on failure. */
  private captureGitSha(): string | null {
    try {
      const workDir = this.workingDirectory || process.cwd();
      return execSync('git rev-parse HEAD', {
        cwd: workDir,
        encoding: 'utf-8',
      }).trim();
    } catch {
      return null;
    }
  }

  /** Promise-based sleep. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
