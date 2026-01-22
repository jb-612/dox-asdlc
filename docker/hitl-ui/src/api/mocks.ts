/**
 * Mock data for development and testing
 * These mocks follow the hitl_api.json contract schemas
 */

import type {
  GatesResponse,
  GateRequest,
  WorkerPoolStatus,
  SessionsResponse,
  SessionSummary,
  GateType,
} from './types';

// Helper to generate timestamps
const now = new Date();
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60 * 1000).toISOString();
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

// Mock Gates Data
const mockGatesList: GateRequest[] = [
  {
    id: 'gate_001',
    type: 'prd_review',
    session_id: 'sess_abc123',
    task_id: 'task_prd_001',
    status: 'pending',
    created_at: minutesAgo(5),
    expires_at: null,
    summary:
      'Review PRD for User Authentication Module. Includes requirements for OAuth2.0 integration, session management, and MFA support.',
    artifacts: [
      {
        path: 'docs/prd/auth-module.md',
        type: 'file',
        size_bytes: 15234,
        preview: '# User Authentication Module PRD\n\n## Overview\n...',
      },
      {
        path: 'docs/diagrams/auth-flow.png',
        type: 'file',
        size_bytes: 45000,
      },
    ],
    context: {
      epic: 'P02-Authentication',
      priority: 'high',
      requestor: 'discovery-agent',
    },
  },
  {
    id: 'gate_002',
    type: 'code_review',
    session_id: 'sess_def456',
    task_id: 'task_impl_002',
    status: 'pending',
    created_at: minutesAgo(12),
    expires_at: null,
    summary:
      'Code review for API rate limiting implementation. Adds Redis-based rate limiting middleware with configurable thresholds.',
    artifacts: [
      {
        path: 'src/middleware/rate_limiter.py',
        type: 'diff',
        size_bytes: 8500,
        preview:
          '+class RateLimiter:\n+    def __init__(self, redis_client, limit=100):\n...',
      },
      {
        path: 'tests/unit/test_rate_limiter.py',
        type: 'diff',
        size_bytes: 5200,
      },
      {
        path: 'coverage/report.json',
        type: 'report',
        size_bytes: 1200,
        preview: '{"coverage": 94.2, "passed": 24, "failed": 0}',
      },
    ],
    context: {
      branch: 'feature/rate-limiting',
      commit: 'a1b2c3d',
      coverage: 94.2,
    },
  },
  {
    id: 'gate_003',
    type: 'design_review',
    session_id: 'sess_ghi789',
    task_id: 'task_design_003',
    status: 'pending',
    created_at: minutesAgo(28),
    expires_at: null,
    summary:
      'Architecture review for microservices decomposition. Proposes splitting monolith into 5 bounded contexts.',
    artifacts: [
      {
        path: 'docs/architecture/microservices-proposal.md',
        type: 'file',
        size_bytes: 22000,
      },
      {
        path: 'docs/architecture/c4-diagrams.md',
        type: 'file',
        size_bytes: 8900,
      },
    ],
    context: {
      architect: 'design-agent',
      impact: 'breaking',
    },
  },
  {
    id: 'gate_004',
    type: 'test_review',
    session_id: 'sess_def456',
    task_id: 'task_test_004',
    status: 'pending',
    created_at: hoursAgo(1),
    expires_at: null,
    summary:
      'E2E test results for checkout flow. All 47 scenarios passed. Performance metrics within threshold.',
    artifacts: [
      {
        path: 'test-results/e2e-checkout.json',
        type: 'report',
        size_bytes: 34000,
        preview:
          '{"total": 47, "passed": 47, "failed": 0, "duration_ms": 125000}',
      },
      {
        path: 'test-results/screenshots/checkout-flow.zip',
        type: 'file',
        size_bytes: 2500000,
      },
    ],
    context: {
      environment: 'staging',
      browser: 'chromium',
    },
  },
  {
    id: 'gate_005',
    type: 'deployment_approval',
    session_id: 'sess_jkl012',
    task_id: 'task_deploy_005',
    status: 'pending',
    created_at: hoursAgo(2),
    expires_at: hoursAgo(-4), // Expires in 4 hours
    summary:
      'Production deployment approval for v2.3.0. Includes rate limiting, bug fixes, and performance improvements.',
    artifacts: [
      {
        path: 'releases/v2.3.0/changelog.md',
        type: 'file',
        size_bytes: 4500,
      },
      {
        path: 'releases/v2.3.0/rollback-plan.md',
        type: 'file',
        size_bytes: 2100,
      },
      {
        path: 'monitoring/canary-results.json',
        type: 'report',
        size_bytes: 8900,
        preview: '{"error_rate": 0.02, "latency_p99_ms": 145, "status": "healthy"}',
      },
    ],
    context: {
      version: 'v2.3.0',
      environment: 'production',
      canary_success: true,
    },
  },
];

export const mockGates: GatesResponse = {
  gates: mockGatesList,
  total: mockGatesList.length,
};

export function mockGateDetail(gateId: string): GateRequest | undefined {
  return mockGatesList.find((g) => g.id === gateId);
}

// Mock Worker Pool Data
export const mockWorkerPool: WorkerPoolStatus = {
  total: 8,
  active: 5,
  idle: 3,
  workers: [
    {
      agent_id: 'worker_001',
      agent_type: 'coding_agent',
      status: 'running',
      current_task: 'Implementing rate limiter middleware',
      session_id: 'sess_def456',
      started_at: minutesAgo(15),
      last_heartbeat: minutesAgo(0),
    },
    {
      agent_id: 'worker_002',
      agent_type: 'test_agent',
      status: 'running',
      current_task: 'Running E2E test suite for auth module',
      session_id: 'sess_abc123',
      started_at: minutesAgo(8),
      last_heartbeat: minutesAgo(0),
    },
    {
      agent_id: 'worker_003',
      agent_type: 'review_agent',
      status: 'running',
      current_task: 'Analyzing code coverage report',
      session_id: 'sess_def456',
      started_at: minutesAgo(3),
      last_heartbeat: minutesAgo(0),
    },
    {
      agent_id: 'worker_004',
      agent_type: 'design_agent',
      status: 'running',
      current_task: 'Generating C4 diagrams',
      session_id: 'sess_ghi789',
      started_at: minutesAgo(22),
      last_heartbeat: minutesAgo(0),
    },
    {
      agent_id: 'worker_005',
      agent_type: 'discovery_agent',
      status: 'running',
      current_task: 'Extracting requirements from PRD',
      session_id: 'sess_abc123',
      started_at: minutesAgo(5),
      last_heartbeat: minutesAgo(0),
    },
    {
      agent_id: 'worker_006',
      agent_type: 'coding_agent',
      status: 'idle',
      current_task: null,
      session_id: null,
      started_at: null,
      last_heartbeat: minutesAgo(2),
    },
    {
      agent_id: 'worker_007',
      agent_type: 'test_agent',
      status: 'idle',
      current_task: null,
      session_id: null,
      started_at: null,
      last_heartbeat: minutesAgo(1),
    },
    {
      agent_id: 'worker_008',
      agent_type: 'review_agent',
      status: 'idle',
      current_task: null,
      session_id: null,
      started_at: null,
      last_heartbeat: minutesAgo(0),
    },
  ],
};

// Mock Sessions Data
const mockSessionsList: SessionSummary[] = [
  {
    session_id: 'sess_abc123',
    tenant_id: 'default',
    status: 'active',
    epic_id: 'P02-F01-auth-module',
    created_at: hoursAgo(3),
    completed_at: null,
    pending_gates: 2,
    completed_tasks: 8,
    total_tasks: 15,
  },
  {
    session_id: 'sess_def456',
    tenant_id: 'default',
    status: 'active',
    epic_id: 'P03-F02-rate-limiting',
    created_at: hoursAgo(5),
    completed_at: null,
    pending_gates: 2,
    completed_tasks: 12,
    total_tasks: 18,
  },
  {
    session_id: 'sess_ghi789',
    tenant_id: 'default',
    status: 'active',
    epic_id: 'P01-F03-architecture',
    created_at: hoursAgo(8),
    completed_at: null,
    pending_gates: 1,
    completed_tasks: 3,
    total_tasks: 7,
  },
  {
    session_id: 'sess_jkl012',
    tenant_id: 'default',
    status: 'active',
    epic_id: 'P04-F01-deployment',
    created_at: hoursAgo(12),
    completed_at: null,
    pending_gates: 1,
    completed_tasks: 14,
    total_tasks: 16,
  },
  {
    session_id: 'sess_mno345',
    tenant_id: 'default',
    status: 'completed',
    epic_id: 'P01-F02-infrastructure',
    created_at: hoursAgo(48),
    completed_at: hoursAgo(24),
    pending_gates: 0,
    completed_tasks: 12,
    total_tasks: 12,
  },
];

export const mockSessions: SessionsResponse = {
  sessions: mockSessionsList,
};

export function mockSessionDetail(sessionId: string): SessionSummary | undefined {
  return mockSessionsList.find((s) => s.session_id === sessionId);
}

// Gate type to badge variant mapping
export const gateTypeBadgeVariant: Record<
  GateType,
  'prd' | 'design' | 'code' | 'test' | 'deploy'
> = {
  prd_review: 'prd',
  design_review: 'design',
  code_review: 'code',
  test_review: 'test',
  deployment_approval: 'deploy',
};
