import { BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition, HITLGateDefinition, AgentNode } from '../../shared/types/workflow';
import type {
  Execution,
  ExecutionStatus,
  NodeExecutionStatus,
  NodeExecutionState,
  ExecutionEvent,
  ExecutionEventType,
} from '../../shared/types/execution';
import type { WorkItemReference } from '../../shared/types/workitem';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { CLISpawner } from './cli-spawner';
import type { RedisEventClient } from './redis-client';

// ---------------------------------------------------------------------------
// ExecutionEngine
//
// Executes a workflow DAG node-by-node using topological sort. Supports two
// execution modes:
//
//   1. MOCK MODE (default, mockMode: true)
//      Simulates agent work with random 1-3 second delays. Useful for UI
//      development and demo purposes.
//
//   2. REAL CLI MODE (mockMode: false)
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
}

export class ExecutionEngine {
  private execution: Execution | null = null;
  private isPaused = false;
  private isAborted = false;
  private mainWindow: BrowserWindow | null = null;

  /** Whether to use mock execution (true) or real CLI spawning (false). */
  private mockMode: boolean;
  /** CLI process spawner, required when mockMode is false. */
  private cliSpawner: CLISpawner | null;
  /** Optional Redis client for monitoring event streams. */
  private redisClient: RedisEventClient | null;
  /** Default timeout for CLI node execution in milliseconds. */
  private nodeTimeoutMs: number;

  /** Pending gate resolvers keyed by nodeId. */
  private gateResolvers = new Map<string, (decision: string) => void>();

  /** Pending CLI exit resolvers keyed by CLI session ID. */
  private cliExitResolvers = new Map<string, (exitCode: number) => void>();

  /** Maps CLI session IDs to node IDs for exit handling. */
  private sessionToNode = new Map<string, string>();

  constructor(mainWindow: BrowserWindow, options?: ExecutionEngineOptions) {
    this.mainWindow = mainWindow;
    this.mockMode = options?.mockMode ?? true;
    this.cliSpawner = options?.cliSpawner ?? null;
    this.redisClient = options?.redisClient ?? null;
    this.nodeTimeoutMs = options?.nodeTimeoutMs ?? 300000; // 5 minute default
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

    // Create execution state
    const executionId = uuidv4();
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
    };

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

    // Execute nodes in order
    for (const nodeId of sorted) {
      if (this.isAborted) break;

      // Honour pause: spin until resumed or aborted
      while (this.isPaused && !this.isAborted) {
        await this.sleep(100);
      }
      if (this.isAborted) break;

      const node = workflow.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

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

      if (this.mockMode) {
        await this.executeNodeMock(nodeId);
      } else {
        await this.executeNodeReal(nodeId, node);
      }

      // If aborted during execution, we already handled state
      if (this.isAborted) break;
    }

    // Final status
    if (this.isAborted) {
      this.setStatus('aborted');
      this.execution.completedAt = new Date().toISOString();
      this.emitEvent('execution_aborted', undefined, 'Execution aborted by user');
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
    return this.execution;
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
    if (node.config.model) {
      args.push('--model', node.config.model);
    }
    if (node.config.maxTurns) {
      args.push('--max-turns', String(node.config.maxTurns));
    }
    if (node.config.extraFlags) {
      args.push(...node.config.extraFlags);
    }

    const session = this.cliSpawner.spawn({
      command: 'claude',
      args,
      cwd: process.cwd(),
      instanceId: `${this.execution?.id ?? 'unknown'}-${nodeId}`,
    });

    // Track the session for exit handling
    this.sessionToNode.set(session.id, nodeId);

    // Update node state with CLI session reference
    this.updateNodeState(nodeId, 'running', { cliSessionId: session.id });

    // Send work item context as initial prompt if available
    if (this.execution?.workItem) {
      const prompt = `Working on: ${this.execution.workItem.id} - ${this.execution.workItem.title ?? ''}\n`;
      this.cliSpawner.write(session.id, prompt);
    }

    // Wait for CLI exit or timeout
    const timeoutMs = (node.config.timeoutSeconds ?? 0) * 1000 || this.nodeTimeoutMs;

    const exitCode = await this.waitForCLIExit(session.id, timeoutMs);

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
      this.updateNodeState(nodeId, 'completed', {
        completedAt: new Date().toISOString(),
        output: { cliSessionId: session.id, exitCode },
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

    // Block until the renderer submits a decision
    const decision = await new Promise<string>((resolve) => {
      this.gateResolvers.set(nodeId, resolve);
    });

    // Check if aborted while waiting
    if (decision === '__aborted__' || this.isAborted) {
      return false;
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
    };
    this.execution?.events.push(event);
    this.mainWindow?.webContents.send(IPC_CHANNELS.EXECUTION_EVENT, event);
  }

  /** Push the full execution snapshot to the renderer. */
  private sendStateUpdate(): void {
    if (!this.execution) return;
    this.mainWindow?.webContents.send(
      IPC_CHANNELS.EXECUTION_STATE_UPDATE,
      this.execution,
    );
  }

  // -----------------------------------------------------------------------
  // Graph utilities (inline for main process -- no DOM dependency)
  // -----------------------------------------------------------------------

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

  /** Promise-based sleep. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
