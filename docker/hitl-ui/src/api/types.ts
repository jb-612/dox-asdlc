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
  tenant_id?: string;
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

// ============================================================================
// Agent Cockpit Types
// ============================================================================

// Run status
export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

// Model type
export type ModelType = 'sonnet' | 'opus' | 'haiku';

// Agent run summary
export interface AgentRun {
  run_id: string;
  agent_type: string;
  cluster: string;
  status: RunStatus;
  model: ModelType;
  epic_id?: string | null;
  repo?: string | null;
  environment?: string | null;
  started_at: string;
  completed_at?: string | null;
  duration_ms?: number | null;
  tokens_used?: number | null;
  cost_usd?: number | null;
  input_artifacts: number;
  output_artifacts: number;
}

// Agent run detail
export interface AgentRunDetail extends AgentRun {
  timeline: RunEvent[];
  inputs: RunInputs;
  outputs: RunOutputs;
  evidence?: EvidenceBundle | null;
  rlm_trajectory?: RLMTrajectory | null;
}

// Run event
export interface RunEvent {
  id: string;
  timestamp: string;
  event_type: 'start' | 'tool_call' | 'completion' | 'failure';
  description: string;
  metadata?: Record<string, unknown>;
}

// Run inputs
export interface RunInputs {
  artifacts: Artifact[];
  context_pack?: ContextPack | null;
  configuration: Record<string, unknown>;
}

// Run outputs
export interface RunOutputs {
  artifacts: Artifact[];
  patches?: Patch[];
  test_results?: TestResults | null;
}

// Evidence bundle
export interface EvidenceBundle {
  test_reports: string[];
  diffs: string[];
  security_scans: string[];
}

// RLM Trajectory (recursive subcalls)
export interface RLMTrajectory {
  subcall_id: string;
  depth: number;
  tool_calls: ToolCall[];
  tokens_used: number;
  cost_usd: number;
  status: 'success' | 'failure';
  subcalls: RLMTrajectory[];
}

// Tool call
export interface ToolCall {
  tool_name: string;
  timestamp: string;
  result: 'success' | 'failure';
}

// Patch
export interface Patch {
  file_path: string;
  diff: string;
}

// Test results
export interface TestResults {
  passed: number;
  failed: number;
  total: number;
  details: string;
}

// KPI metrics
export interface KPIMetrics {
  active_runs: number;
  completed_today: number;
  success_rate: number;
  avg_duration_ms: number;
  total_cost_usd: number;
}

// Workflow graph data
export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  label: string;
  type: 'cluster' | 'agent';
  metrics: {
    runs: number;
    success_rate: number;
  };
}

export interface WorkflowEdge {
  from: string;
  to: string;
  count: number;
}

// Git state per environment
export interface GitState {
  environment: string;
  branch: string;
  sha: string;
  pending_commits: number;
  recent_commits: GitCommit[];
  drift: boolean;
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
}

// ============================================================================
// Discovery Studio Types
// ============================================================================

// Chat message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  streaming?: boolean;
}

// Working outline
export interface WorkingOutline {
  sections: OutlineSection[];
  completeness: number; // 0-100
}

export interface OutlineSection {
  name: string;
  status: 'complete' | 'in_progress' | 'pending';
  content?: string | null;
}

// Context pack
export interface ContextPack {
  files: ContextFile[];
  total_tokens: number;
  cost_estimate_usd: number;
}

export interface ContextFile {
  path: string;
  relevance_score: number;
  tokens: number;
}

// Studio query/response
export interface StudioChatRequest {
  session_id: string;
  message: string;
  context_pack?: ContextPack | null;
}

export interface StudioChatResponse {
  message: ChatMessage;
  outline_update?: Partial<WorkingOutline> | null;
  artifacts?: Artifact[] | null;
}

// ============================================================================
// Artifact Management Types
// ============================================================================

// Artifact status
export type ArtifactStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected';

// Artifact detail
export interface ArtifactDetail {
  id: string;
  name: string;
  type: ArtifactType;
  status: ArtifactStatus;
  epic_id?: string | null;
  created_at: string;
  created_by: string;
  approved_at?: string | null;
  approved_by?: string | null;
  sha?: string | null;
  content: string;
  content_type: string;
  size_bytes: number;
}

// Artifact version history
export interface ArtifactVersion {
  version: number;
  timestamp: string;
  author: string;
  sha: string;
  changes_summary: string;
}

// Artifact provenance
export interface ArtifactProvenance {
  producing_run_id: string;
  input_artifacts: Artifact[];
  approving_gate_id?: string | null;
  approval_info?: {
    approved_by: string;
    approved_at: string;
    feedback?: string | null;
  } | null;
  feedback?: string[] | null;
}

// Spec index (for Spec Index Browser)
export interface SpecIndex {
  discovery: SpecFolder;
  design: SpecFolder;
  development: SpecFolder;
  validation: SpecFolder;
}

export interface SpecFolder {
  artifacts: SpecArtifact[];
  progress: {
    complete: number;
    in_progress: number;
    pending: number;
    total: number;
  };
}

export interface SpecArtifact {
  id: string;
  name: string;
  status: ArtifactStatus;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface RunsQueryParams {
  cluster?: string;
  agent_type?: string;
  status?: RunStatus;
  model?: ModelType;
  repo?: string;
  environment?: string;
  start_date?: string;
  end_date?: string;
  search?: string; // run_id or epic
  limit?: number;
  offset?: number;
}

export interface ArtifactsQueryParams {
  epic_id?: string;
  type?: ArtifactType;
  status?: ArtifactStatus;
  start_date?: string;
  end_date?: string;
  agent_type?: string;
  gate_type?: GateType;
  search?: string; // filename
  limit?: number;
  offset?: number;
}

// ============================================================================
// API Response Wrappers
// ============================================================================

export interface RunsResponse {
  runs: AgentRun[];
  total: number;
}

export interface ArtifactsResponse {
  artifacts: ArtifactDetail[];
  total: number;
}

// ============================================================================
// KnowledgeStore Search Types (P05-F08)
// ============================================================================

// Backend mode selection
export type SearchBackendMode = 'rest' | 'graphql' | 'mcp' | 'mock';

// Search query parameters
export interface SearchQuery {
  query: string;
  topK?: number;
  filters?: SearchFilters;
}

// Filters for faceted search
export interface SearchFilters {
  fileTypes?: string[];       // e.g., ['.py', '.ts', '.md']
  dateFrom?: string;          // ISO date
  dateTo?: string;            // ISO date
  metadata?: Record<string, unknown>;
}

// Search result from backend
export interface KSSearchResult {
  docId: string;
  content: string;
  metadata: {
    file_path?: string;
    file_type?: string;
    language?: string;
    line_start?: number;
    line_end?: number;
    indexed_at?: string;
    [key: string]: unknown;
  };
  score: number;
  source: string;
}

// Full document
export interface KSDocument {
  docId: string;
  content: string;
  metadata: Record<string, unknown>;
}

// Search response wrapper
export interface SearchResponse {
  results: KSSearchResult[];
  total: number;
  query: string;
  took_ms?: number;
}

// Health check response
export interface KSHealthStatus {
  status: 'healthy' | 'unhealthy';
  backend: string;
  index_count?: number;
  document_count?: number;
}

// Reindex request
export interface ReindexRequest {
  path?: string;
  force?: boolean;
}

// Reindex response
export interface ReindexResponse {
  status: 'started' | 'already_running' | 'completed';
  job_id?: string;
  message: string;
}

// Reindex status response
export interface ReindexStatus {
  status: 'idle' | 'running' | 'completed' | 'failed';
  job_id?: string;
  progress?: number;      // 0-100
  files_indexed?: number;
  total_files?: number;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

// Saved search
export interface SavedSearch {
  id: string;
  query: string;
  filters?: SearchFilters;
  timestamp: string;
  isFavorite: boolean;
}

// ============================================================================
// Documentation Types
// ============================================================================

// Document category
export type DocumentCategory = 'system' | 'feature' | 'architecture' | 'workflow';

// Diagram category
export type DiagramCategory = 'architecture' | 'flow' | 'sequence' | 'decision';

// Document metadata
export interface DocumentMeta {
  id: string;
  title: string;
  path: string;
  category: DocumentCategory;
  description: string;
  lastModified?: string;
}

// Diagram metadata
export interface DiagramMeta {
  id: string;
  title: string;
  filename: string;
  category: DiagramCategory;
  description: string;
  thumbnail?: string;
}

// Document with content
export interface DocumentContent {
  meta: DocumentMeta;
  content: string;
}

// Diagram with content
export interface DiagramContent {
  meta: DiagramMeta;
  content: string;
}

// ============================================================================
// Kubernetes Types (re-export from types folder)
// ============================================================================

export * from './types/kubernetes';

// ============================================================================
// Code Review Types (P04-F06)
// ============================================================================

/**
 * Severity level for code review findings
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Type of reviewer agent
 */
export type ReviewerType = 'security' | 'performance' | 'style';

/**
 * A single finding from a code review
 */
export interface ReviewFinding {
  id: string;
  reviewer_type: ReviewerType;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  code_snippet: string | null;
  recommendation: string;
  confidence: number;
}

/**
 * Result from a single reviewer
 */
export interface ReviewerResult {
  reviewer_type: ReviewerType;
  status: 'success' | 'failed' | 'timeout';
  findings: ReviewFinding[];
  duration_seconds: number;
  files_reviewed: string[];
  error_message: string | null;
}

/**
 * Unified report from all reviewers
 */
export interface UnifiedReport {
  swarm_id: string;
  target_path: string;
  created_at: string;
  reviewers_completed: string[];
  reviewers_failed: string[];
  critical_findings: ReviewFinding[];
  high_findings: ReviewFinding[];
  medium_findings: ReviewFinding[];
  low_findings: ReviewFinding[];
  info_findings: ReviewFinding[];
  total_findings: number;
  findings_by_reviewer: Record<string, number>;
  findings_by_category: Record<string, number>;
  duplicates_removed: number;
}

// ============================================================================
// Swarm Review API Types (P04-F06)
// ============================================================================

/**
 * Request to trigger a swarm review
 */
export interface SwarmReviewRequest {
  target_path: string;
  reviewer_types?: ReviewerType[];
  timeout_seconds?: number;
}

/**
 * Response from triggering a swarm review
 */
export interface SwarmReviewResponse {
  swarm_id: string;
  status: string;
  poll_url: string;
}

/**
 * Status of a single reviewer in the swarm
 */
export interface ReviewerStatus {
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  files_reviewed: number;
  findings_count: number;
  progress_percent: number;
  duration_seconds?: number;
}

/**
 * Status response from polling a swarm review
 */
export interface SwarmStatusResponse {
  swarm_id: string;
  status: 'pending' | 'in_progress' | 'aggregating' | 'complete' | 'failed';
  reviewers: Record<string, ReviewerStatus>;
  unified_report?: UnifiedReport;
  duration_seconds?: number;
  error_message?: string;
}

// ============================================================================
// Code Review Labels and Mappings (P04-F06)
// ============================================================================

/**
 * Human-readable labels for severity levels
 */
export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

/**
 * Human-readable labels for reviewer types
 */
export const REVIEWER_LABELS: Record<ReviewerType, string> = {
  security: 'Security',
  performance: 'Performance',
  style: 'Style',
};

/**
 * Tailwind CSS background color classes for severity levels
 */
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-gray-500',
};

/**
 * Tailwind CSS text color classes for severity levels
 */
export const SEVERITY_TEXT_COLORS: Record<Severity, string> = {
  critical: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-blue-500',
  info: 'text-gray-500',
};

/**
 * Tailwind CSS border color classes for severity levels
 */
export const SEVERITY_BORDER_COLORS: Record<Severity, string> = {
  critical: 'border-red-600',
  high: 'border-orange-500',
  medium: 'border-yellow-500',
  low: 'border-blue-500',
  info: 'border-gray-500',
};

/**
 * Icon names for reviewer types (for use with icon libraries)
 */
export const REVIEWER_ICONS: Record<ReviewerType, string> = {
  security: 'shield',
  performance: 'zap',
  style: 'code',
};

/**
 * Configuration for a code review request (frontend form state)
 */
export interface ReviewConfig {
  target: string;
  scope: 'full_repo' | 'changed_files' | 'custom_path';
  customPath?: string;
  reviewers: {
    security: boolean;
    performance: boolean;
    style: boolean;
  };
}
