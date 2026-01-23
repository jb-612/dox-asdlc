/**
 * Mock data for Agent Cockpit runs
 */

import type {
  AgentRun,
  AgentRunDetail,
  KPIMetrics,
  WorkflowGraph,
  GitState,
  RunEvent,
  RLMTrajectory,
} from '../types';

// Helper functions
const now = new Date();
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60 * 1000).toISOString();
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

// Mock runs list
export const mockRuns: AgentRun[] = [
  {
    run_id: 'run_001',
    agent_type: 'discovery_agent',
    cluster: 'discovery',
    status: 'running',
    model: 'sonnet',
    epic_id: 'EPIC-001',
    repo: 'dox-asdlc',
    environment: 'dev',
    started_at: minutesAgo(5),
    completed_at: null,
    duration_ms: null,
    tokens_used: 15000,
    cost_usd: 0.045,
    input_artifacts: 2,
    output_artifacts: 0,
  },
  {
    run_id: 'run_002',
    agent_type: 'coding_agent',
    cluster: 'development',
    status: 'completed',
    model: 'opus',
    epic_id: 'EPIC-001',
    repo: 'dox-asdlc',
    environment: 'dev',
    started_at: hoursAgo(1),
    completed_at: minutesAgo(45),
    duration_ms: 900000,
    tokens_used: 85000,
    cost_usd: 1.275,
    input_artifacts: 3,
    output_artifacts: 2,
  },
  {
    run_id: 'run_003',
    agent_type: 'test_agent',
    cluster: 'validation',
    status: 'completed',
    model: 'haiku',
    epic_id: 'EPIC-001',
    repo: 'dox-asdlc',
    environment: 'staging',
    started_at: hoursAgo(2),
    completed_at: hoursAgo(1.5),
    duration_ms: 1800000,
    tokens_used: 25000,
    cost_usd: 0.0125,
    input_artifacts: 4,
    output_artifacts: 1,
  },
  {
    run_id: 'run_004',
    agent_type: 'design_agent',
    cluster: 'design',
    status: 'failed',
    model: 'sonnet',
    epic_id: 'EPIC-002',
    repo: 'frontend-app',
    environment: 'dev',
    started_at: hoursAgo(3),
    completed_at: hoursAgo(2.5),
    duration_ms: 1800000,
    tokens_used: 45000,
    cost_usd: 0.135,
    input_artifacts: 1,
    output_artifacts: 0,
  },
  {
    run_id: 'run_005',
    agent_type: 'review_agent',
    cluster: 'validation',
    status: 'running',
    model: 'sonnet',
    epic_id: 'EPIC-001',
    repo: 'dox-asdlc',
    environment: 'dev',
    started_at: minutesAgo(10),
    completed_at: null,
    duration_ms: null,
    tokens_used: 8500,
    cost_usd: 0.0255,
    input_artifacts: 5,
    output_artifacts: 0,
  },
];

// Mock run detail
export function getMockRunDetail(runId: string): AgentRunDetail | null {
  const run = mockRuns.find((r) => r.run_id === runId);
  if (!run) return null;

  const timeline: RunEvent[] = [
    {
      id: 'evt_001',
      timestamp: run.started_at,
      event_type: 'start',
      description: `${run.agent_type} started processing`,
      metadata: { model: run.model },
    },
    {
      id: 'evt_002',
      timestamp: minutesAgo(4),
      event_type: 'tool_call',
      description: 'Called file_read tool',
      metadata: { tool: 'file_read', path: 'src/main.py' },
    },
    {
      id: 'evt_003',
      timestamp: minutesAgo(3),
      event_type: 'tool_call',
      description: 'Called code_edit tool',
      metadata: { tool: 'code_edit', path: 'src/main.py' },
    },
  ];

  if (run.status === 'completed') {
    timeline.push({
      id: 'evt_004',
      timestamp: run.completed_at!,
      event_type: 'completion',
      description: 'Run completed successfully',
    });
  } else if (run.status === 'failed') {
    timeline.push({
      id: 'evt_004',
      timestamp: run.completed_at!,
      event_type: 'failure',
      description: 'Run failed: Timeout exceeded',
      metadata: { error: 'TimeoutError' },
    });
  }

  return {
    ...run,
    timeline,
    inputs: {
      artifacts: [
        { path: 'src/main.py', type: 'file', size_bytes: 5000 },
        { path: 'requirements.txt', type: 'file', size_bytes: 200 },
      ],
      context_pack: {
        files: [
          { path: 'src/core/types.py', relevance_score: 0.95, tokens: 1200 },
          { path: 'src/utils/helpers.py', relevance_score: 0.82, tokens: 800 },
        ],
        total_tokens: 2000,
        cost_estimate_usd: 0.006,
      },
      configuration: {
        max_iterations: 10,
        temperature: 0.7,
      },
    },
    outputs: {
      artifacts: run.output_artifacts > 0
        ? [
            { path: 'src/main.py', type: 'diff', size_bytes: 1500 },
            { path: 'tests/test_main.py', type: 'file', size_bytes: 2000 },
          ]
        : [],
      patches: run.output_artifacts > 0
        ? [{ file_path: 'src/main.py', diff: '+import asyncio\n-import time' }]
        : [],
      test_results: run.status === 'completed'
        ? { passed: 12, failed: 0, total: 12, details: 'All tests passed' }
        : null,
    },
    evidence: run.status === 'completed'
      ? {
          test_reports: ['coverage_report.json'],
          diffs: ['main.py.diff'],
          security_scans: [],
        }
      : null,
    rlm_trajectory: run.model === 'opus' ? getMockRLMTrajectory() : null,
  };
}

// Mock RLM trajectory
function getMockRLMTrajectory(): RLMTrajectory {
  return {
    subcall_id: 'sub_001',
    depth: 0,
    tool_calls: [
      { tool_name: 'file_read', timestamp: minutesAgo(50), result: 'success' },
      { tool_name: 'code_analyze', timestamp: minutesAgo(48), result: 'success' },
    ],
    tokens_used: 25000,
    cost_usd: 0.375,
    status: 'success',
    subcalls: [
      {
        subcall_id: 'sub_002',
        depth: 1,
        tool_calls: [
          { tool_name: 'file_read', timestamp: minutesAgo(45), result: 'success' },
          { tool_name: 'code_edit', timestamp: minutesAgo(42), result: 'success' },
        ],
        tokens_used: 18000,
        cost_usd: 0.27,
        status: 'success',
        subcalls: [
          {
            subcall_id: 'sub_003',
            depth: 2,
            tool_calls: [
              { tool_name: 'test_run', timestamp: minutesAgo(38), result: 'success' },
            ],
            tokens_used: 8000,
            cost_usd: 0.12,
            status: 'success',
            subcalls: [],
          },
        ],
      },
      {
        subcall_id: 'sub_004',
        depth: 1,
        tool_calls: [
          { tool_name: 'file_write', timestamp: minutesAgo(35), result: 'success' },
        ],
        tokens_used: 12000,
        cost_usd: 0.18,
        status: 'success',
        subcalls: [],
      },
    ],
  };
}

// Mock KPI metrics
export const mockKPIMetrics: KPIMetrics = {
  active_runs: 2,
  completed_today: 15,
  success_rate: 87.5,
  avg_duration_ms: 1250000,
  total_cost_usd: 12.45,
};

// Mock workflow graph
export const mockWorkflowGraph: WorkflowGraph = {
  nodes: [
    { id: 'discovery', label: 'Discovery', type: 'cluster', metrics: { runs: 45, success_rate: 92 } },
    { id: 'design', label: 'Design', type: 'cluster', metrics: { runs: 38, success_rate: 89 } },
    { id: 'development', label: 'Development', type: 'cluster', metrics: { runs: 120, success_rate: 85 } },
    { id: 'validation', label: 'Validation', type: 'cluster', metrics: { runs: 95, success_rate: 91 } },
    { id: 'deployment', label: 'Deployment', type: 'cluster', metrics: { runs: 25, success_rate: 96 } },
  ],
  edges: [
    { from: 'discovery', to: 'design', count: 42 },
    { from: 'design', to: 'development', count: 38 },
    { from: 'development', to: 'validation', count: 95 },
    { from: 'validation', to: 'deployment', count: 25 },
    { from: 'validation', to: 'development', count: 15 }, // Retry loop
  ],
};

// Mock git states
export const mockGitStates: GitState[] = [
  {
    environment: 'dev',
    branch: 'main',
    sha: 'abc1234def5678',
    pending_commits: 3,
    drift: false,
    recent_commits: [
      { sha: 'abc1234', message: 'feat: Add rate limiting', author: 'coding_agent', timestamp: hoursAgo(1) },
      { sha: 'def5678', message: 'fix: Handle edge case', author: 'coding_agent', timestamp: hoursAgo(3) },
    ],
  },
  {
    environment: 'staging',
    branch: 'release/v2.3.0',
    sha: 'xyz9876abc5432',
    pending_commits: 0,
    drift: false,
    recent_commits: [
      { sha: 'xyz9876', message: 'chore: Bump version', author: 'deploy_agent', timestamp: hoursAgo(12) },
    ],
  },
  {
    environment: 'prod',
    branch: 'release/v2.2.0',
    sha: 'prod123456789',
    pending_commits: 0,
    drift: true,
    recent_commits: [
      { sha: 'prod123', message: 'fix: Hotfix for auth', author: 'coding_agent', timestamp: hoursAgo(48) },
    ],
  },
];
