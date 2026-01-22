/**
 * TypeScript types derived from hitl_api.json contract
 * @see contracts/current/hitl_api.json
 */

// Gate status enum
export type GateStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// Gate type enum
export type GateType =
  | 'prd_review'
  | 'design_review'
  | 'code_review'
  | 'test_review'
  | 'deployment_approval';

// Artifact types
export type ArtifactType = 'file' | 'diff' | 'log' | 'report';

// Artifact structure
export interface Artifact {
  path: string;
  type: ArtifactType;
  size_bytes?: number;
  preview?: string | null;
}

// Gate request structure
export interface GateRequest {
  id: string;
  type: GateType;
  session_id: string;
  task_id?: string | null;
  status: GateStatus;
  created_at: string;
  expires_at?: string | null;
  artifacts: Artifact[];
  summary: string;
  context: Record<string, unknown>;
}

// Gate decision (submission)
export interface GateDecision {
  gate_id: string;
  decision: 'approve' | 'reject';
  decided_by: string;
  reason?: string | null;
  feedback?: string | null;
}

// Decision response
export interface DecisionResponse {
  success: boolean;
  event_id: string;
}

// Agent/worker status
export type AgentStatusType = 'idle' | 'running' | 'error' | 'stopped';

export interface AgentStatus {
  agent_id: string;
  agent_type: string;
  status: AgentStatusType;
  current_task?: string | null;
  session_id?: string | null;
  started_at?: string | null;
  last_heartbeat?: string | null;
}

// Worker pool status
export interface WorkerPoolStatus {
  total: number;
  active: number;
  idle: number;
  workers: AgentStatus[];
}

// Session status
export type SessionStatus = 'active' | 'completed' | 'failed' | 'cancelled';

// Session summary
export interface SessionSummary {
  session_id: string;
  tenant_id?: string | null;
  status: SessionStatus;
  epic_id?: string | null;
  created_at: string;
  completed_at?: string | null;
  pending_gates: number;
  completed_tasks: number;
  total_tasks: number;
}

// API response wrappers
export interface GatesResponse {
  gates: GateRequest[];
  total: number;
}

export interface SessionsResponse {
  sessions: SessionSummary[];
}

export interface ArtifactContentResponse {
  content: string;
  content_type: string;
  size_bytes: number;
}

// Query parameters
export interface GatesQueryParams {
  session_id?: string;
  type?: GateType;
  limit?: number;
}

export interface SessionsQueryParams {
  status?: 'active' | 'completed' | 'all';
  tenant_id?: string;
  limit?: number;
}

// Helper type mappings for UI
export const gateTypeLabels: Record<GateType, string> = {
  prd_review: 'PRD Review',
  design_review: 'Design Review',
  code_review: 'Code Review',
  test_review: 'Test Review',
  deployment_approval: 'Deployment',
};

export const gateStatusLabels: Record<GateStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const artifactTypeLabels: Record<ArtifactType, string> = {
  file: 'File',
  diff: 'Diff',
  log: 'Log',
  report: 'Report',
};
