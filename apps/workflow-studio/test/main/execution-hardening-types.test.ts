// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { NodeExecutionState, ExecutionEventType } from '../../src/shared/types/execution';
import type { AgentNodeConfig } from '../../src/shared/types/workflow';
import type { AppSettings } from '../../src/shared/types/settings';
import { DEFAULT_SETTINGS } from '../../src/shared/types/settings';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

describe('F14-T01: Retry/History types', () => {
  describe('NodeExecutionState retry fields', () => {
    it('has retryCount field', () => {
      const state: NodeExecutionState = {
        nodeId: 'node-1',
        status: 'completed',
        retryCount: 3,
      };
      expect(state.retryCount).toBe(3);
    });

    it('has lastRetryAt field', () => {
      const state: NodeExecutionState = {
        nodeId: 'node-1',
        status: 'failed',
        lastRetryAt: '2026-03-01T10:00:00Z',
      };
      expect(state.lastRetryAt).toBe('2026-03-01T10:00:00Z');
    });
  });

  describe('ExecutionEventType new values', () => {
    it('includes node_retry', () => {
      const eventType: ExecutionEventType = 'node_retry';
      expect(eventType).toBe('node_retry');
    });

    it('includes node_retry_exhausted', () => {
      const eventType: ExecutionEventType = 'node_retry_exhausted';
      expect(eventType).toBe('node_retry_exhausted');
    });

    it('includes node_timeout_warning', () => {
      const eventType: ExecutionEventType = 'node_timeout_warning';
      expect(eventType).toBe('node_timeout_warning');
    });
  });

  describe('AgentNodeConfig retry fields', () => {
    it('has maxRetries field', () => {
      const config: AgentNodeConfig = {
        maxRetries: 3,
      };
      expect(config.maxRetries).toBe(3);
    });

    it('has retryableExitCodes field', () => {
      const config: AgentNodeConfig = {
        retryableExitCodes: [1, 2, 137],
      };
      expect(config.retryableExitCodes).toEqual([1, 2, 137]);
    });
  });

  describe('AppSettings retry defaults', () => {
    it('has defaultMaxRetries field', () => {
      const settings: AppSettings = {
        ...DEFAULT_SETTINGS,
        defaultMaxRetries: 2,
      };
      expect(settings.defaultMaxRetries).toBe(2);
    });

    it('has retryBackoffMs field', () => {
      const settings: AppSettings = {
        ...DEFAULT_SETTINGS,
        retryBackoffMs: 2000,
      };
      expect(settings.retryBackoffMs).toBe(2000);
    });

    it('DEFAULT_SETTINGS has defaultMaxRetries=0', () => {
      expect(DEFAULT_SETTINGS.defaultMaxRetries).toBe(0);
    });

    it('DEFAULT_SETTINGS has retryBackoffMs=1000', () => {
      expect(DEFAULT_SETTINGS.retryBackoffMs).toBe(1000);
    });
  });

  describe('WorkflowDefinition timeout', () => {
    it('has timeoutSeconds field', () => {
      const workflow = {
        timeoutSeconds: 600,
      } as WorkflowDefinition;
      expect(workflow.timeoutSeconds).toBe(600);
    });
  });

  describe('IPC_CHANNELS history + replay', () => {
    it('has EXECUTION_HISTORY_LIST', () => {
      expect(IPC_CHANNELS.EXECUTION_HISTORY_LIST).toBe('execution:history-list');
    });

    it('has EXECUTION_HISTORY_GET', () => {
      expect(IPC_CHANNELS.EXECUTION_HISTORY_GET).toBe('execution:history-get');
    });

    it('has EXECUTION_HISTORY_CLEAR', () => {
      expect(IPC_CHANNELS.EXECUTION_HISTORY_CLEAR).toBe('execution:history-clear');
    });

    it('has EXECUTION_REPLAY', () => {
      expect(IPC_CHANNELS.EXECUTION_REPLAY).toBe('execution:replay');
    });
  });

  describe('ExecutionHistoryEntry interface', () => {
    it('exists and has required fields', () => {
      const entry: import('../../src/shared/types/execution').ExecutionHistoryEntry = {
        id: 'exec-1',
        workflowId: 'wf-1',
        workflowName: 'My Workflow',
        workflow: {} as WorkflowDefinition,
        status: 'completed',
        startedAt: '2026-03-01T10:00:00Z',
        nodeStates: {},
        retryStats: {},
      };
      expect(entry.id).toBe('exec-1');
      expect(entry.workflowId).toBe('wf-1');
      expect(entry.workflowName).toBe('My Workflow');
      expect(entry.retryStats).toEqual({});
    });
  });

  describe('ExecutionHistorySummary type', () => {
    it('is a Pick of ExecutionHistoryEntry', () => {
      const summary: import('../../src/shared/types/execution').ExecutionHistorySummary = {
        id: 'exec-1',
        workflowId: 'wf-1',
        workflowName: 'My Workflow',
        status: 'completed',
        startedAt: '2026-03-01T10:00:00Z',
      };
      expect(summary.id).toBe('exec-1');
      expect(summary).not.toHaveProperty('workflow');
      expect(summary).not.toHaveProperty('nodeStates');
    });
  });
});
