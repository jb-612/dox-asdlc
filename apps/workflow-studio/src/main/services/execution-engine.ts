import { BrowserWindow } from 'electron';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition, HITLGateDefinition, AgentNode } from '../../shared/types/workflow';
import type {
  BlockResult,
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
  remoteAgentUrl?: string;
  /** Working directory for CLI spawner (from repoMount.localPath) */
  workingDirectory?: string;
  /** File restriction glob patterns (from repoMount.fileRestrictions) */
  fileRestrictions?: string[];
  /** Whether the repo is mounted read-only (T23) */
  readOnly?: boolean;
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
  /** Optional URL for remote agent execution (e.g. Cursor agent container). */
  private remoteAgentUrl: string | null;
  /** Working directory for CLI spawner (repo mount path). */
  private workingDirectory: string | null;
  /** File restriction patterns for the execution. */
  private fileRestrictions: string[];
  /** Whether the repo is mounted read-only. */
  private readOnly: boolean;

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
    this.remoteAgentUrl = options?.remoteAgentUrl ?? null;
    this.workingDirectory = options?.workingDirectory ?? null;
    this.fileRestrictions = options?.fileRestrictions ?? [];
    this.readOnly = options?.readOnly ?? false;
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

      if (node.config.backend === 'cursor') {
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
      parts.push(node.config.systemPromptPrefix);
    }

    // 3. Task instruction (node description or systemPrompt)
    const taskInstruction = node.description || node.config.systemPrompt || `Execute ${node.type} agent: ${node.label}`;
    parts.push(taskInstruction);

    // 4. Output checklist
    if (node.config.outputChecklist && node.config.outputChecklist.length > 0) {
      const checklist = node.config.outputChecklist
        .map((item, i) => `${i + 1}. ${item}`)
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
      parts.push(`Only modify files matching: ${this.fileRestrictions.join(', ')}`);
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
      cwd: this.workingDirectory || process.cwd(),
      instanceId: `${this.execution?.id ?? 'unknown'}-${nodeId}`,
    });

    // Track the session for exit handling
    this.sessionToNode.set(session.id, nodeId);

    // Update node state with CLI session reference
    this.updateNodeState(nodeId, 'running', { cliSessionId: session.id });

    // Gather results from previously completed blocks for context
    const previousResults = this.collectPreviousBlockResults(nodeId);

    // Build composed system prompt including harness fields and prior context
    const systemPrompt = this.buildSystemPrompt(
      node,
      this.execution?.workflow?.rules,
      previousResults,
    );

    // Send work item context and composed prompt as initial prompt
    const promptParts: string[] = [];
    if (this.execution?.workItem) {
      promptParts.push(`Working on: ${this.execution.workItem.id} - ${this.execution.workItem.title ?? ''}`);
    }
    promptParts.push(systemPrompt);
    this.cliSpawner.write(session.id, promptParts.join('\n') + '\n');

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
      // Read block deliverables produced by the agent (stateless contract)
      const workDir = this.workingDirectory || process.cwd();
      const blockResult = this.readBlockResult(workDir, nodeId);
      const output: Record<string, unknown> = { cliSessionId: session.id, exitCode };
      if (blockResult) {
        output.blockResult = blockResult;
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

        if (node.config.backend === 'cursor') {
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
