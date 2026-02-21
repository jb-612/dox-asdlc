import { BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition, HITLGateDefinition } from '../../shared/types/workflow';
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

// ---------------------------------------------------------------------------
// ExecutionEngine
//
// Mock execution engine that lives in the Electron main process. It traverses
// a workflow DAG node-by-node using topological sort, simulating agent work
// with random delays. HITL gates pause the traversal until the renderer
// submits a decision via IPC.
// ---------------------------------------------------------------------------

export class ExecutionEngine {
  private execution: Execution | null = null;
  private isPaused = false;
  private isAborted = false;
  private mainWindow: BrowserWindow | null = null;

  /** Pending gate resolvers keyed by nodeId. */
  private gateResolvers = new Map<string, (decision: string) => void>();

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
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
   * Nodes are simulated with a 1-3 second random delay.
   */
  async start(
    workflow: WorkflowDefinition,
    workItem?: WorkItemReference,
  ): Promise<Execution> {
    // Reset control flags
    this.isPaused = false;
    this.isAborted = false;
    this.gateResolvers.clear();

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

      // Execute node (mock: wait 1-3 seconds)
      this.updateNodeState(nodeId, 'running', { startedAt: new Date().toISOString() });
      this.emitEvent('node_started', nodeId, `Started: ${node.label}`);

      const duration = 1000 + Math.random() * 2000;
      await this.sleep(duration);

      // Check abort/pause after sleeping
      if (this.isAborted) {
        this.updateNodeState(nodeId, 'failed', { error: 'Execution aborted' });
        break;
      }

      this.updateNodeState(nodeId, 'completed', {
        completedAt: new Date().toISOString(),
        output: { mock: true, duration: Math.round(duration) },
      });
      this.emitEvent('node_completed', nodeId, `Completed: ${node.label}`);
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
