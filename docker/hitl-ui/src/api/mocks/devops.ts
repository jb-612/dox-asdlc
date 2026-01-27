/**
 * Mock data for DevOps Activity (P06-F07)
 *
 * Provides mock data for development mode when backend API is unavailable.
 */

import type {
  DevOpsActivity,
  DevOpsActivityResponse,
  DevOpsStep,
} from '../types/devops';

// ============================================================================
// Mock Step Data
// ============================================================================

const mockDeploySteps: DevOpsStep[] = [
  {
    name: 'Pull images',
    status: 'completed',
    startedAt: '2026-01-27T10:00:00Z',
    completedAt: '2026-01-27T10:01:30Z',
  },
  {
    name: 'Apply manifests',
    status: 'completed',
    startedAt: '2026-01-27T10:01:30Z',
    completedAt: '2026-01-27T10:02:00Z',
  },
  {
    name: 'Wait for rollout',
    status: 'running',
    startedAt: '2026-01-27T10:02:00Z',
  },
  {
    name: 'Health check',
    status: 'pending',
  },
];

// ============================================================================
// Mock Activity Data
// ============================================================================

export const mockCurrentActivity: DevOpsActivity = {
  id: 'devops-activity-001',
  operation: 'Deploy workers chart v2.1.0',
  status: 'in_progress',
  startedAt: '2026-01-27T10:00:00Z',
  steps: mockDeploySteps,
};

export const mockRecentActivities: DevOpsActivity[] = [
  {
    id: 'devops-activity-002',
    operation: 'Deploy hitl-ui chart v1.5.0',
    status: 'completed',
    startedAt: '2026-01-27T09:00:00Z',
    completedAt: '2026-01-27T09:05:30Z',
    steps: [
      {
        name: 'Pull images',
        status: 'completed',
        startedAt: '2026-01-27T09:00:00Z',
        completedAt: '2026-01-27T09:02:00Z',
      },
      {
        name: 'Apply manifests',
        status: 'completed',
        startedAt: '2026-01-27T09:02:00Z',
        completedAt: '2026-01-27T09:03:30Z',
      },
      {
        name: 'Wait for rollout',
        status: 'completed',
        startedAt: '2026-01-27T09:03:30Z',
        completedAt: '2026-01-27T09:04:30Z',
      },
      {
        name: 'Health check',
        status: 'completed',
        startedAt: '2026-01-27T09:04:30Z',
        completedAt: '2026-01-27T09:05:30Z',
      },
    ],
  },
  {
    id: 'devops-activity-003',
    operation: 'Deploy redis chart v3.0.0',
    status: 'failed',
    startedAt: '2026-01-27T08:00:00Z',
    completedAt: '2026-01-27T08:02:15Z',
    steps: [
      {
        name: 'Pull images',
        status: 'completed',
        startedAt: '2026-01-27T08:00:00Z',
        completedAt: '2026-01-27T08:01:00Z',
      },
      {
        name: 'Apply manifests',
        status: 'failed',
        startedAt: '2026-01-27T08:01:00Z',
        completedAt: '2026-01-27T08:02:15Z',
        error: 'Failed to apply ConfigMap: validation error - invalid port number',
      },
      {
        name: 'Wait for rollout',
        status: 'pending',
      },
      {
        name: 'Health check',
        status: 'pending',
      },
    ],
  },
  {
    id: 'devops-activity-004',
    operation: 'Deploy orchestrator chart v1.2.0',
    status: 'completed',
    startedAt: '2026-01-27T07:30:00Z',
    completedAt: '2026-01-27T07:36:00Z',
    steps: [
      {
        name: 'Pull images',
        status: 'completed',
        startedAt: '2026-01-27T07:30:00Z',
        completedAt: '2026-01-27T07:32:00Z',
      },
      {
        name: 'Apply manifests',
        status: 'completed',
        startedAt: '2026-01-27T07:32:00Z',
        completedAt: '2026-01-27T07:33:30Z',
      },
      {
        name: 'Wait for rollout',
        status: 'completed',
        startedAt: '2026-01-27T07:33:30Z',
        completedAt: '2026-01-27T07:35:00Z',
      },
      {
        name: 'Health check',
        status: 'completed',
        startedAt: '2026-01-27T07:35:00Z',
        completedAt: '2026-01-27T07:36:00Z',
      },
    ],
  },
];

// ============================================================================
// Mock API Functions
// ============================================================================

/**
 * Get mock DevOps activity data
 */
export function getMockDevOpsActivity(includeCurrentActivity = true): DevOpsActivityResponse {
  return {
    current: includeCurrentActivity ? mockCurrentActivity : undefined,
    recent: mockRecentActivities,
  };
}

/**
 * Get empty DevOps activity data (no current or recent operations)
 */
export function getMockEmptyDevOpsActivity(): DevOpsActivityResponse {
  return {
    current: undefined,
    recent: [],
  };
}

/**
 * Simulate network delay for mock data
 */
export async function simulateDevOpsDelay(minMs = 100, maxMs = 300): Promise<void> {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}
