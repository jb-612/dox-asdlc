/**
 * Execution Events SSE Stream Contract
 *
 * Real-time event stream from the aSDLC orchestrator to the Electron
 * Workflow Studio, delivered via Server-Sent Events (SSE).
 *
 * Connection endpoint: GET /api/execution/:id/events
 * Owner: orchestrator
 * Consumers: workflow-studio (Electron app)
 * Version: 1.0.0
 *
 * ## Connection Protocol
 *
 * 1. The client opens an SSE connection to GET /api/execution/:id/events.
 *    The server responds with Content-Type: text/event-stream and keeps
 *    the connection open.
 *
 * 2. The server sends a `connected` event immediately upon successful
 *    connection, containing the current execution snapshot so the client
 *    can hydrate its state without a separate GET request.
 *
 * 3. Subsequent events are pushed as they occur during execution.
 *
 * 4. If the execution reaches a terminal state (completed, failed, aborted),
 *    the server sends the corresponding terminal event and then closes the
 *    stream with a final `stream_end` event.
 *
 * ## SSE Wire Format
 *
 * Each event follows the W3C Server-Sent Events specification:
 *
 *   id: <monotonic event sequence number>
 *   event: <event type string>
 *   data: <JSON-encoded payload>
 *
 * The `id` field is a monotonic sequence number scoped to the execution.
 * Clients MUST include the `Last-Event-ID` header on reconnection to
 * resume from where they left off. The server replays any missed events.
 *
 * ## Reconnection
 *
 * - The server sets `retry: 3000` (3 seconds) as the default reconnection
 *   interval in the initial response.
 * - On reconnection with a `Last-Event-ID` header, the server replays all
 *   events with an ID greater than the provided value.
 * - If the execution has ended while the client was disconnected, the server
 *   replays remaining events and closes the stream.
 * - If the execution ID is not found, the server responds with 404 (not SSE).
 *
 * ## Heartbeat
 *
 * The server sends a comment line (`:heartbeat`) every 15 seconds to keep
 * the connection alive through proxies and load balancers. These are not
 * delivered as events to the EventSource API.
 *
 * ## Query Parameters
 *
 * - `lastEventId` (optional): Alternative to the Last-Event-ID header for
 *   environments where setting request headers on EventSource is not possible.
 *   If both are provided, the header takes precedence.
 *
 * All timestamps are ISO 8601 strings with timezone (e.g. "2026-02-21T10:00:00Z").
 */

// ---------------------------------------------------------------------------
// Shared type references (re-declared for contract self-containment)
// Source: apps/workflow-studio/src/shared/types/
// ---------------------------------------------------------------------------

/** Status of a workflow execution lifecycle. */
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'waiting_gate'
  | 'completed'
  | 'failed'
  | 'aborted';

/** Status of an individual node within an execution. */
export type NodeExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting_gate';

/** HITL gate types. */
export type GateType = 'approval' | 'review' | 'decision' | 'confirmation';

// ---------------------------------------------------------------------------
// Base event envelope
// ---------------------------------------------------------------------------

/**
 * Base envelope for all SSE events. Every event pushed on the stream
 * conforms to this shape, with the `payload` discriminated by `type`.
 */
export interface BaseExecutionEvent<T extends ExecutionEventType, P> {
  /** Monotonic sequence number scoped to this execution. Used as the SSE `id`. */
  id: number;
  /** Event type discriminator. Sent as the SSE `event` field. */
  type: T;
  /** ISO 8601 timestamp of when the event occurred on the server. */
  timestamp: string;
  /** Execution ID this event belongs to. */
  executionId: string;
  /** Type-specific payload. Sent as JSON in the SSE `data` field. */
  payload: P;
}

// ---------------------------------------------------------------------------
// Event type union
// ---------------------------------------------------------------------------

/**
 * Discriminated union of all event type strings.
 */
export type ExecutionEventType =
  | 'connected'
  | 'execution_started'
  | 'execution_paused'
  | 'execution_resumed'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_aborted'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'node_skipped'
  | 'gate_waiting'
  | 'gate_decided'
  | 'cli_output'
  | 'cli_error'
  | 'cli_exit'
  | 'variable_updated'
  | 'stream_end';

// ---------------------------------------------------------------------------
// Connection event
// ---------------------------------------------------------------------------

/**
 * Payload for the `connected` event, sent immediately when the SSE
 * connection is established. Contains a snapshot of the current execution
 * state so the client can hydrate without a separate REST call.
 */
export interface ConnectedPayload {
  /** Current overall execution status. */
  status: ExecutionStatus;
  /** ID of the currently active node, if any. */
  currentNodeId?: string;
  /** Per-node execution states, keyed by node ID. */
  nodeStates: Record<string, NodeStateSnapshot>;
  /** Current variable values. */
  variables: Record<string, unknown>;
  /** ISO 8601 timestamp when the execution started. */
  startedAt: string;
  /** The server's recommended SSE retry interval in milliseconds. */
  retryMs: number;
}

/** Compact node state snapshot embedded in the connected event. */
export interface NodeStateSnapshot {
  /** Current status of this node. */
  status: NodeExecutionStatus;
  /** ISO 8601 timestamp when this node started executing. */
  startedAt?: string;
  /** ISO 8601 timestamp when this node finished. */
  completedAt?: string;
  /** Error message if the node has failed. */
  error?: string;
}

export type ConnectedEvent = BaseExecutionEvent<'connected', ConnectedPayload>;

// ---------------------------------------------------------------------------
// Execution lifecycle events
// ---------------------------------------------------------------------------

/**
 * Payload for `execution_started`. Emitted when the execution transitions
 * from 'pending' to 'running'.
 */
export interface ExecutionStartedPayload {
  /** ID of the first node to execute. */
  firstNodeId: string;
  /** Initial variable values at execution start. */
  variables: Record<string, unknown>;
}

export type ExecutionStartedEvent = BaseExecutionEvent<'execution_started', ExecutionStartedPayload>;

/**
 * Payload for `execution_paused`. Emitted when a running execution is paused.
 */
export interface ExecutionPausedPayload {
  /** ID of the node that was active when the pause occurred. */
  pausedAtNodeId?: string;
  /** Reason for the pause (e.g. "user_requested"). */
  reason: string;
}

export type ExecutionPausedEvent = BaseExecutionEvent<'execution_paused', ExecutionPausedPayload>;

/**
 * Payload for `execution_resumed`. Emitted when a paused execution resumes.
 */
export interface ExecutionResumedPayload {
  /** ID of the node that will continue executing. */
  resumeAtNodeId?: string;
}

export type ExecutionResumedEvent = BaseExecutionEvent<'execution_resumed', ExecutionResumedPayload>;

/**
 * Payload for `execution_completed`. Emitted when all nodes have finished
 * and the execution reaches a successful terminal state.
 */
export interface ExecutionCompletedPayload {
  /** Final variable values. */
  variables: Record<string, unknown>;
  /** Total wall-clock duration in seconds. */
  durationSeconds: number;
  /** Summary of node outcomes. */
  summary: {
    /** Number of nodes that completed successfully. */
    completed: number;
    /** Number of nodes that were skipped. */
    skipped: number;
    /** Total number of nodes in the workflow. */
    total: number;
  };
}

export type ExecutionCompletedEvent = BaseExecutionEvent<'execution_completed', ExecutionCompletedPayload>;

/**
 * Payload for `execution_failed`. Emitted when the execution fails due to
 * an unrecoverable node failure or internal error.
 */
export interface ExecutionFailedPayload {
  /** ID of the node that caused the failure, if applicable. */
  failedNodeId?: string;
  /** Human-readable error message. */
  error: string;
  /** Machine-readable error code. */
  errorCode?: string;
  /** Total wall-clock duration in seconds before failure. */
  durationSeconds: number;
}

export type ExecutionFailedEvent = BaseExecutionEvent<'execution_failed', ExecutionFailedPayload>;

/**
 * Payload for `execution_aborted`. Emitted when the execution is manually
 * aborted by the user.
 */
export interface ExecutionAbortedPayload {
  /** Reason provided by the user when aborting. */
  reason?: string;
  /** ID of the node that was active when the abort occurred. */
  abortedAtNodeId?: string;
  /** Total wall-clock duration in seconds before abort. */
  durationSeconds: number;
}

export type ExecutionAbortedEvent = BaseExecutionEvent<'execution_aborted', ExecutionAbortedPayload>;

// ---------------------------------------------------------------------------
// Node lifecycle events
// ---------------------------------------------------------------------------

/**
 * Payload for `node_started`. Emitted when an agent node begins execution.
 */
export interface NodeStartedPayload {
  /** ID of the node that started. */
  nodeId: string;
  /** Agent node type (e.g. "backend", "reviewer"). */
  nodeType: string;
  /** Display label of the node. */
  nodeLabel: string;
  /** CLI session ID if a Claude CLI session was spawned. */
  cliSessionId?: string;
}

export type NodeStartedEvent = BaseExecutionEvent<'node_started', NodeStartedPayload>;

/**
 * Payload for `node_completed`. Emitted when an agent node finishes
 * successfully.
 */
export interface NodeCompletedPayload {
  /** ID of the node that completed. */
  nodeId: string;
  /** Agent node type. */
  nodeType: string;
  /** Display label of the node. */
  nodeLabel: string;
  /** Output data produced by the node (shape varies by agent type). */
  output?: unknown;
  /** Wall-clock duration of node execution in seconds. */
  durationSeconds: number;
  /** IDs of the next nodes that will execute (based on transition evaluation). */
  nextNodeIds: string[];
}

export type NodeCompletedEvent = BaseExecutionEvent<'node_completed', NodeCompletedPayload>;

/**
 * Payload for `node_failed`. Emitted when an agent node fails.
 */
export interface NodeFailedPayload {
  /** ID of the node that failed. */
  nodeId: string;
  /** Agent node type. */
  nodeType: string;
  /** Display label of the node. */
  nodeLabel: string;
  /** Human-readable error message. */
  error: string;
  /** CLI exit code if the failure was a CLI process exit. */
  exitCode?: number;
  /** Wall-clock duration of node execution in seconds before failure. */
  durationSeconds: number;
  /** Whether the workflow engine will retry this node. */
  willRetry: boolean;
}

export type NodeFailedEvent = BaseExecutionEvent<'node_failed', NodeFailedPayload>;

/**
 * Payload for `node_skipped`. Emitted when a node is skipped due to
 * transition conditions not being met, or because the execution was aborted.
 */
export interface NodeSkippedPayload {
  /** ID of the node that was skipped. */
  nodeId: string;
  /** Agent node type. */
  nodeType: string;
  /** Display label of the node. */
  nodeLabel: string;
  /** Reason the node was skipped. */
  reason: 'condition_not_met' | 'execution_aborted' | 'upstream_failed';
}

export type NodeSkippedEvent = BaseExecutionEvent<'node_skipped', NodeSkippedPayload>;

// ---------------------------------------------------------------------------
// HITL gate events
// ---------------------------------------------------------------------------

/**
 * Payload for `gate_waiting`. Emitted when execution reaches a HITL gate
 * and pauses to wait for a human decision. The overall execution status
 * transitions to 'waiting_gate'.
 */
export interface GateWaitingPayload {
  /** ID of the HITL gate definition. */
  gateId: string;
  /** ID of the node the gate is attached to. */
  nodeId: string;
  /** Gate classification. */
  gateType: GateType;
  /** Prompt text to display to the human reviewer. */
  prompt: string;
  /** Available response options. */
  options: GateOptionPayload[];
  /** Seconds until the gate auto-expires (null = no timeout). */
  timeoutSeconds?: number;
  /** Whether the gate is mandatory (execution cannot skip it). */
  required: boolean;
}

/** A selectable option within a gate prompt. */
export interface GateOptionPayload {
  /** Button or choice label. */
  label: string;
  /** Machine-readable value returned on selection. */
  value: string;
  /** Tooltip or extended description. */
  description?: string;
  /** Whether this option is pre-selected by default. */
  isDefault?: boolean;
}

export type GateWaitingEvent = BaseExecutionEvent<'gate_waiting', GateWaitingPayload>;

/**
 * Payload for `gate_decided`. Emitted when a HITL gate receives a human
 * decision and the execution resumes.
 */
export interface GateDecidedPayload {
  /** ID of the HITL gate definition. */
  gateId: string;
  /** ID of the node the gate is attached to. */
  nodeId: string;
  /** Gate classification. */
  gateType: GateType;
  /** The option value that was selected. */
  selectedOption: string;
  /** Identity of the human who made the decision. */
  decidedBy: string;
  /** Optional free-text reason or feedback. */
  reason?: string;
  /** ID of the next node that will execute after the gate. */
  nextNodeId?: string;
}

export type GateDecidedEvent = BaseExecutionEvent<'gate_decided', GateDecidedPayload>;

// ---------------------------------------------------------------------------
// CLI session events
// ---------------------------------------------------------------------------

/**
 * Payload for `cli_output`. Emitted when a Claude CLI session produces
 * output (stdout). These events are throttled: the server batches output
 * into chunks and sends at most one event per 100ms per node to avoid
 * overwhelming the SSE connection.
 */
export interface CLIOutputPayload {
  /** ID of the node whose CLI session produced the output. */
  nodeId: string;
  /** CLI session ID. */
  cliSessionId: string;
  /** The output text chunk. May contain ANSI escape codes. */
  text: string;
  /** Output stream: stdout or stderr. */
  stream: 'stdout' | 'stderr';
}

export type CLIOutputEvent = BaseExecutionEvent<'cli_output', CLIOutputPayload>;

/**
 * Payload for `cli_error`. Emitted when a Claude CLI session encounters
 * an error (distinct from normal stderr output -- this indicates a
 * framework-level error such as spawn failure or timeout).
 */
export interface CLIErrorPayload {
  /** ID of the node whose CLI session errored. */
  nodeId: string;
  /** CLI session ID. */
  cliSessionId: string;
  /** Error message. */
  error: string;
  /** Error classification. */
  errorType: 'spawn_failed' | 'timeout' | 'crash' | 'unknown';
}

export type CLIErrorEvent = BaseExecutionEvent<'cli_error', CLIErrorPayload>;

/**
 * Payload for `cli_exit`. Emitted when a Claude CLI session process exits.
 */
export interface CLIExitPayload {
  /** ID of the node whose CLI session exited. */
  nodeId: string;
  /** CLI session ID. */
  cliSessionId: string;
  /** Process exit code (0 = success). */
  exitCode: number;
  /** Wall-clock duration of the CLI session in seconds. */
  durationSeconds: number;
}

export type CLIExitEvent = BaseExecutionEvent<'cli_exit', CLIExitPayload>;

// ---------------------------------------------------------------------------
// Variable events
// ---------------------------------------------------------------------------

/**
 * Payload for `variable_updated`. Emitted when a workflow variable is
 * set or changed during execution (e.g. by a node's output mapping).
 */
export interface VariableUpdatedPayload {
  /** Variable name. */
  name: string;
  /** Previous value (null if the variable was previously unset). */
  previousValue: unknown;
  /** New value. */
  newValue: unknown;
  /** ID of the node that caused the update, if applicable. */
  sourceNodeId?: string;
}

export type VariableUpdatedEvent = BaseExecutionEvent<'variable_updated', VariableUpdatedPayload>;

// ---------------------------------------------------------------------------
// Stream lifecycle events
// ---------------------------------------------------------------------------

/**
 * Payload for `stream_end`. Sent as the final event before the server
 * closes the SSE connection. The client should not attempt to reconnect
 * after receiving this event.
 */
export interface StreamEndPayload {
  /** Reason the stream is closing. */
  reason: 'execution_terminal' | 'server_shutdown' | 'timeout';
  /** Final execution status at the time of stream closure. */
  finalStatus: ExecutionStatus;
}

export type StreamEndEvent = BaseExecutionEvent<'stream_end', StreamEndPayload>;

// ---------------------------------------------------------------------------
// Discriminated union of all event types
// ---------------------------------------------------------------------------

/**
 * Union of all possible execution events that can appear on the SSE stream.
 * Clients should switch on the `type` field to determine the payload shape.
 *
 * Example client-side handling:
 *
 * ```typescript
 * const eventSource = new EventSource(`/api/execution/${id}/events`);
 *
 * eventSource.addEventListener('node_started', (e) => {
 *   const event: NodeStartedEvent = JSON.parse(e.data);
 *   // event.payload.nodeId, event.payload.nodeType, etc.
 * });
 *
 * eventSource.addEventListener('gate_waiting', (e) => {
 *   const event: GateWaitingEvent = JSON.parse(e.data);
 *   // Show gate prompt to user
 * });
 *
 * eventSource.addEventListener('stream_end', (e) => {
 *   const event: StreamEndEvent = JSON.parse(e.data);
 *   eventSource.close();
 * });
 * ```
 */
export type ExecutionEvent =
  | ConnectedEvent
  | ExecutionStartedEvent
  | ExecutionPausedEvent
  | ExecutionResumedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | ExecutionAbortedEvent
  | NodeStartedEvent
  | NodeCompletedEvent
  | NodeFailedEvent
  | NodeSkippedEvent
  | GateWaitingEvent
  | GateDecidedEvent
  | CLIOutputEvent
  | CLIErrorEvent
  | CLIExitEvent
  | VariableUpdatedEvent
  | StreamEndEvent;
