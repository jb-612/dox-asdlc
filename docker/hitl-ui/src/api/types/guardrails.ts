/**
 * TypeScript types for Guardrails Configuration System (P11-F01)
 *
 * These types match the backend Pydantic models for the guardrails
 * management API, including guidelines, evaluation, and audit logging.
 */

// ============================================================================
// Enum types
// ============================================================================

/**
 * Category of a guideline, matching backend GuidelineCategory enum.
 */
export type GuidelineCategory =
  | 'cognitive_isolation'
  | 'tdd_protocol'
  | 'hitl_gate'
  | 'tool_restriction'
  | 'path_restriction'
  | 'commit_policy'
  | 'custom';

/**
 * Type of action a guideline enforces.
 */
export type ActionType =
  | 'instruction'
  | 'tool_allow'
  | 'tool_deny'
  | 'hitl_require'
  | 'custom';

// ============================================================================
// Guideline condition and action
// ============================================================================

/**
 * Condition under which a guideline applies.
 * All fields are optional; a null or missing field means "match all".
 */
export interface GuidelineCondition {
  agents?: string[] | null;
  domains?: string[] | null;
  actions?: string[] | null;
  paths?: string[] | null;
  events?: string[] | null;
  gate_types?: string[] | null;
}

/**
 * Action to take when a guideline matches.
 */
export interface GuidelineAction {
  action_type: ActionType;
  instruction?: string | null;
  tools_allowed?: string[] | null;
  tools_denied?: string[] | null;
  gate_type?: string | null;
}

// ============================================================================
// Guideline entity
// ============================================================================

/**
 * A complete guideline as returned by the API.
 */
export interface Guideline {
  id: string;
  name: string;
  description: string;
  category: GuidelineCategory;
  priority: number;
  enabled: boolean;
  condition: GuidelineCondition;
  action: GuidelineAction;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  tenant_id?: string | null;
}

// ============================================================================
// API request/response types
// ============================================================================

/**
 * Paginated list response for guidelines.
 */
export interface GuidelinesListResponse {
  guidelines: Guideline[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * Request body for creating a new guideline.
 */
export interface GuidelineCreateRequest {
  name: string;
  description?: string;
  category: GuidelineCategory;
  priority?: number;
  enabled?: boolean;
  condition: GuidelineCondition;
  action: GuidelineAction;
}

/**
 * Request body for updating an existing guideline.
 * The version field is required for optimistic locking.
 */
export interface GuidelineUpdateRequest {
  name?: string;
  description?: string;
  category?: GuidelineCategory;
  priority?: number;
  enabled?: boolean;
  condition?: GuidelineCondition;
  action?: GuidelineAction;
  version: number;
}

// ============================================================================
// Context evaluation types
// ============================================================================

/**
 * Request body for evaluating guidelines against a task context.
 */
export interface TaskContextRequest {
  agent?: string | null;
  domain?: string | null;
  action?: string | null;
  paths?: string[] | null;
  event?: string | null;
  gate_type?: string | null;
  session_id?: string | null;
}

/**
 * A single guideline that matched a task context evaluation.
 */
export interface EvaluatedGuideline {
  guideline_id: string;
  guideline_name: string;
  priority: number;
  match_score: number;
  matched_fields: string[];
}

/**
 * Response from evaluating guidelines against a task context.
 */
export interface EvaluatedContextResponse {
  matched_count: number;
  combined_instruction: string;
  tools_allowed: string[];
  tools_denied: string[];
  hitl_gates: string[];
  guidelines: EvaluatedGuideline[];
}

// ============================================================================
// Audit log types
// ============================================================================

/**
 * A single audit log entry.
 */
export interface AuditLogEntry {
  id: string;
  event_type: string;
  guideline_id?: string | null;
  timestamp: string;
  decision?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  changes?: Record<string, unknown> | null;
}

/**
 * Paginated response for audit log entries.
 */
export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
}

// ============================================================================
// Filter/query parameter types
// ============================================================================

/**
 * Query parameters for listing guidelines.
 */
export interface GuidelinesListParams {
  category?: GuidelineCategory;
  enabled?: boolean;
  page?: number;
  page_size?: number;
}

/**
 * Query parameters for listing audit log entries.
 */
export interface AuditListParams {
  guideline_id?: string;
  event_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

// ============================================================================
// Import/export types
// ============================================================================

/**
 * Result of an import operation.
 */
export interface ImportResult {
  imported: number;
  errors: string[];
}
