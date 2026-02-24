import { describe, it, expect } from 'vitest';
import { formatExecutionEvent, formatTelemetryEvent } from './eventFormatter';
import type { ExecutionEvent } from '../../../shared/types/execution';
import type { TelemetryEvent } from '../../../shared/types/monitoring';

describe('formatExecutionEvent', () => {
  it('formats an execution_started event', () => {
    const event: ExecutionEvent = {
      id: '1',
      type: 'execution_started',
      timestamp: '2026-01-01T00:00:00Z',
      message: 'Workflow started',
    };
    const result = formatExecutionEvent(event);
    expect(result.label).toBe('Execution Started');
    expect(result.detail).toBe('Workflow started');
    expect(result.severity).toBe('info');
    expect(result.timestamp).toBe('2026-01-01T00:00:00Z');
    expect(result.icon).toBeTruthy();
  });

  it('formats a node_failed event with error severity', () => {
    const event: ExecutionEvent = {
      id: '2',
      type: 'node_failed',
      timestamp: '2026-01-01T00:01:00Z',
      message: 'Node crashed',
      nodeId: 'n1',
    };
    const result = formatExecutionEvent(event);
    expect(result.label).toBe('Node Failed');
    expect(result.severity).toBe('error');
  });

  it('formats a gate_waiting event with warning severity', () => {
    const event: ExecutionEvent = {
      id: '3',
      type: 'gate_waiting',
      timestamp: '2026-01-01T00:02:00Z',
      message: 'Waiting for approval',
    };
    const result = formatExecutionEvent(event);
    expect(result.label).toBe('Gate Waiting');
    expect(result.severity).toBe('warning');
  });
});

describe('formatTelemetryEvent', () => {
  it('formats an agent_start event', () => {
    const event: TelemetryEvent = {
      id: '1',
      type: 'agent_start',
      agentId: 'backend',
      timestamp: '2026-01-01T00:00:00Z',
      data: 'Starting agent',
    };
    const result = formatTelemetryEvent(event);
    expect(result.label).toBe('Agent Start');
    expect(result.detail).toBe('Starting agent');
    expect(result.severity).toBe('info');
  });

  it('formats an agent_error event with error severity', () => {
    const event: TelemetryEvent = {
      id: '2',
      type: 'agent_error',
      agentId: 'backend',
      timestamp: '2026-01-01T00:01:00Z',
      data: { code: 500 },
    };
    const result = formatTelemetryEvent(event);
    expect(result.label).toBe('Agent Error');
    expect(result.severity).toBe('error');
    expect(result.detail).toBe('{"code":500}');
  });

  it('handles null data gracefully', () => {
    const event: TelemetryEvent = {
      id: '3',
      type: 'metric',
      agentId: 'monitor',
      timestamp: '2026-01-01T00:02:00Z',
      data: null,
    };
    const result = formatTelemetryEvent(event);
    expect(result.detail).toBe('');
  });
});
