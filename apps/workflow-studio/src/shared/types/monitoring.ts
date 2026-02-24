export type TelemetryEventType =
  | 'agent_start'
  | 'agent_complete'
  | 'agent_error'
  | 'tool_call'
  | 'bash_command'
  | 'metric'
  | 'lifecycle'
  | 'token_usage'
  | 'custom';

export interface TelemetryEvent {
  id: string;
  type: TelemetryEventType;
  agentId: string;
  timestamp: string;
  data: unknown;
  sessionId?: string;
  /** Container ID that produced this event */
  containerId?: string;
  /** Workflow execution that this event belongs to */
  workflowId?: string;
  /** Specific workflow node that produced this event */
  nodeId?: string;
  /** Token usage and cost for this event (if applicable) */
  tokenUsage?: { input: number; output: number; estimatedCostUsd: number };
}

export type AgentSessionStatus = 'running' | 'completed' | 'failed';

export interface AgentSession {
  sessionId: string;
  agentId: string;
  startedAt: string;
  completedAt?: string;
  status: AgentSessionStatus;
  eventCount: number;
  /** Container ID running this session */
  containerId?: string;
  /** Index of the current step in a multi-step workflow */
  currentStepIndex?: number;
  /** Human-readable name of the current step */
  currentStepName?: string;
  /** Accumulated cost across all events in this session */
  totalCostUsd?: number;
  /** Number of error events in this session */
  errorCount?: number;
}

export interface TelemetryStats {
  totalEvents: number;
  errorRate: number;
  eventsPerMinute: number;
  activeSessions: number;
  byType: Record<TelemetryEventType, number>;
  /** Accumulated cost across all sessions */
  totalCostUsd?: number;
}
