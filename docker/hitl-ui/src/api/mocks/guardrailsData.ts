/**
 * Mock data for Guardrails Configuration System (P11-F01, T18)
 *
 * Provides realistic mock data for development mode when backend API is
 * unavailable. Covers all GuidelineCategory values and provides helpers
 * for filtering, pagination, and audit log responses.
 */

import type {
  Guideline,
  AuditLogEntry,
  EvaluatedContextResponse,
  GuidelinesListResponse,
  GuidelinesListParams,
  AuditLogResponse,
  AuditListParams,
} from '../types/guardrails';

// ============================================================================
// Mock Guidelines
// ============================================================================

export const mockGuidelines: Guideline[] = [
  // --- cognitive_isolation ---
  {
    id: 'gl-cognitive-planner',
    name: 'Planner Cognitive Isolation',
    description: 'Restrict planner agent to .workitems/ path only. Planner must not modify source code or infrastructure files.',
    category: 'cognitive_isolation',
    priority: 900,
    enabled: true,
    condition: { agents: ['planner'], domains: ['planning'] },
    action: {
      action_type: 'instruction',
      instruction: 'Only create and modify files under .workitems/. Do not touch source code.',
    },
    version: 1,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    created_by: 'admin',
  },
  {
    id: 'gl-cognitive-frontend',
    name: 'Frontend Cognitive Isolation',
    description: 'Restrict frontend agent to docker/hitl-ui/ and src/hitl_ui/ paths only.',
    category: 'cognitive_isolation',
    priority: 900,
    enabled: true,
    condition: { agents: ['frontend'], domains: ['ui', 'frontend'] },
    action: {
      action_type: 'instruction',
      instruction: 'Only modify files under docker/hitl-ui/ and src/hitl_ui/. Backend files are off-limits.',
    },
    version: 1,
    created_at: '2026-01-15T10:05:00Z',
    updated_at: '2026-01-15T10:05:00Z',
    created_by: 'admin',
  },

  // --- tdd_protocol ---
  {
    id: 'gl-tdd-required',
    name: 'TDD Required for Backend',
    description: 'Enforce test-driven development for backend agents. Tests must be written before implementation.',
    category: 'tdd_protocol',
    priority: 800,
    enabled: true,
    condition: { agents: ['backend'], actions: ['implement', 'code'] },
    action: {
      action_type: 'instruction',
      instruction: 'Write failing tests first (RED), then implement minimal code to pass (GREEN), then refactor.',
    },
    version: 2,
    created_at: '2026-01-14T09:00:00Z',
    updated_at: '2026-01-20T14:30:00Z',
    created_by: 'admin',
  },

  // --- hitl_gate ---
  {
    id: 'gl-hitl-devops',
    name: 'DevOps HITL Gate',
    description: 'Require human-in-the-loop confirmation before any DevOps operation on workstations.',
    category: 'hitl_gate',
    priority: 950,
    enabled: true,
    condition: { agents: ['devops'], actions: ['deploy', 'delete', 'scale'] },
    action: {
      action_type: 'hitl_require',
      gate_type: 'destructive_operation',
    },
    version: 1,
    created_at: '2026-01-16T11:00:00Z',
    updated_at: '2026-01-16T11:00:00Z',
    created_by: 'admin',
  },

  // --- tool_restriction ---
  {
    id: 'gl-tool-deny-rm',
    name: 'Block Destructive Shell Commands',
    description: 'Deny rm -rf and other destructive bash commands on workstation environments.',
    category: 'tool_restriction',
    priority: 1000,
    enabled: true,
    condition: { events: ['pre_tool_use'] },
    action: {
      action_type: 'tool_deny',
      tools_denied: ['Bash(rm -rf:*)', 'Bash(docker system prune:*)', 'Bash(kubectl delete:*)'],
    },
    version: 1,
    created_at: '2026-01-17T08:00:00Z',
    updated_at: '2026-01-17T08:00:00Z',
    created_by: 'admin',
  },

  // --- path_restriction ---
  {
    id: 'gl-path-backend',
    name: 'Backend Path Restriction',
    description: 'Backend agent may only modify src/workers/, src/orchestrator/, src/infrastructure/, and src/core/.',
    category: 'path_restriction',
    priority: 850,
    enabled: true,
    condition: { agents: ['backend'] },
    action: {
      action_type: 'instruction',
      instruction: 'Only modify files under src/workers/, src/orchestrator/, src/infrastructure/, src/core/.',
      tools_allowed: ['Read(*)', 'Grep(*)'],
    },
    version: 1,
    created_at: '2026-01-18T09:00:00Z',
    updated_at: '2026-01-18T09:00:00Z',
    created_by: 'admin',
  },

  // --- commit_policy ---
  {
    id: 'gl-commit-orchestrator-only',
    name: 'Orchestrator-Only Commits',
    description: 'Only the orchestrator agent is permitted to commit to the main branch.',
    category: 'commit_policy',
    priority: 950,
    enabled: true,
    condition: { actions: ['commit', 'git push'] },
    action: {
      action_type: 'instruction',
      instruction: 'Only the orchestrator agent may commit. Prepare changes and wait for orchestrator to commit.',
    },
    version: 1,
    created_at: '2026-01-19T12:00:00Z',
    updated_at: '2026-01-19T12:00:00Z',
    created_by: 'admin',
  },

  // --- custom ---
  {
    id: 'gl-custom-code-review',
    name: 'Mandatory Code Review',
    description: 'All implementation changes must be reviewed by the reviewer agent before merge.',
    category: 'custom',
    priority: 700,
    enabled: true,
    condition: { actions: ['review', 'merge'], domains: ['development'] },
    action: {
      action_type: 'custom',
      instruction: 'Request code review from the reviewer agent before orchestrator commits.',
    },
    version: 1,
    created_at: '2026-01-20T15:00:00Z',
    updated_at: '2026-01-20T15:00:00Z',
    created_by: 'admin',
  },

  // --- disabled guideline ---
  {
    id: 'gl-deprecated-manual-deploy',
    name: 'Manual Deploy Gate (Deprecated)',
    description: 'Previously required manual SSH deployment. Replaced by automated pipeline.',
    category: 'custom',
    priority: 100,
    enabled: false,
    condition: { agents: ['devops'], actions: ['deploy'] },
    action: {
      action_type: 'instruction',
      instruction: 'Require manual SSH access for production deployment.',
    },
    version: 3,
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-01-25T16:00:00Z',
    created_by: 'admin',
  },

  // --- another disabled one for variety ---
  {
    id: 'gl-disabled-verbose-logging',
    name: 'Verbose Logging Requirement (Disabled)',
    description: 'Require verbose logging for all agent actions. Disabled due to noise.',
    category: 'tool_restriction',
    priority: 200,
    enabled: false,
    condition: { agents: ['backend', 'frontend'] },
    action: {
      action_type: 'tool_allow',
      tools_allowed: ['Bash(echo:*)', 'Bash(tee:*)'],
    },
    version: 2,
    created_at: '2026-01-12T07:00:00Z',
    updated_at: '2026-01-22T10:00:00Z',
    created_by: 'admin',
  },
];

// ============================================================================
// Mock Audit Log Entries
// ============================================================================

export const mockAuditEntries: AuditLogEntry[] = [
  {
    id: 'audit-001',
    event_type: 'guideline_created',
    guideline_id: 'gl-cognitive-planner',
    timestamp: '2026-01-15T10:00:00Z',
    decision: null,
    context: null,
    changes: { name: 'Planner Cognitive Isolation', category: 'cognitive_isolation' },
  },
  {
    id: 'audit-002',
    event_type: 'guideline_updated',
    guideline_id: 'gl-tdd-required',
    timestamp: '2026-01-20T14:30:00Z',
    decision: null,
    context: null,
    changes: { version: { old: 1, new: 2 }, instruction: 'Updated TDD wording' },
  },
  {
    id: 'audit-003',
    event_type: 'guideline_toggled',
    guideline_id: 'gl-deprecated-manual-deploy',
    timestamp: '2026-01-25T16:00:00Z',
    decision: null,
    context: null,
    changes: { enabled: { old: true, new: false } },
  },
  {
    id: 'audit-004',
    event_type: 'guideline_deleted',
    guideline_id: 'gl-temp-hotfix-rule',
    timestamp: '2026-01-26T09:00:00Z',
    decision: null,
    context: null,
    changes: { name: 'Temporary Hotfix Rule', reason: 'No longer needed after release' },
  },
  {
    id: 'audit-005',
    event_type: 'context_evaluated',
    guideline_id: 'gl-cognitive-planner',
    timestamp: '2026-01-27T08:30:00Z',
    decision: { action: 'allowed', reason: 'Agent matches cognitive isolation rule' },
    context: { agent: 'planner', domain: 'planning', action: 'create' },
    changes: null,
  },
  {
    id: 'audit-006',
    event_type: 'guideline_created',
    guideline_id: 'gl-tool-deny-rm',
    timestamp: '2026-01-17T08:00:00Z',
    decision: null,
    context: null,
    changes: { name: 'Block Destructive Shell Commands', category: 'tool_restriction' },
  },
];

// ============================================================================
// Mock Evaluated Context Response
// ============================================================================

export const mockEvaluatedContext: EvaluatedContextResponse = {
  matched_count: 2,
  combined_instruction:
    'Only create and modify files under .workitems/. Do not touch source code. Write failing tests first (RED), then implement minimal code to pass (GREEN), then refactor.',
  tools_allowed: [],
  tools_denied: ['Bash(rm -rf:*)', 'Bash(docker system prune:*)', 'Bash(kubectl delete:*)'],
  hitl_gates: [],
  guidelines: [
    {
      guideline_id: 'gl-cognitive-planner',
      guideline_name: 'Planner Cognitive Isolation',
      priority: 900,
      match_score: 1.0,
      matched_fields: ['agents', 'domains'],
    },
    {
      guideline_id: 'gl-tdd-required',
      guideline_name: 'TDD Required for Backend',
      priority: 800,
      match_score: 0.5,
      matched_fields: ['agents'],
    },
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simulate network delay for mock data.
 */
export async function simulateGuardrailsDelay(minMs = 100, maxMs = 300): Promise<void> {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Get mock guidelines list response with optional filtering and pagination.
 */
export function getMockGuidelinesListResponse(
  params?: GuidelinesListParams
): GuidelinesListResponse {
  let filtered = [...mockGuidelines];

  if (params?.category) {
    filtered = filtered.filter((g) => g.category === params.category);
  }
  if (params?.enabled !== undefined) {
    filtered = filtered.filter((g) => g.enabled === params.enabled);
  }

  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 20;
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    guidelines: filtered.slice(start, end),
    total,
    page,
    page_size: pageSize,
  };
}

/**
 * Get mock audit log response with optional filtering.
 */
export function getMockAuditLogResponse(params?: AuditListParams): AuditLogResponse {
  let filtered = [...mockAuditEntries];

  if (params?.guideline_id) {
    filtered = filtered.filter((e) => e.guideline_id === params.guideline_id);
  }
  if (params?.event_type) {
    filtered = filtered.filter((e) => e.event_type === params.event_type);
  }

  return {
    entries: filtered,
    total: filtered.length,
  };
}
