import { describe, it, expect } from 'vitest';
import { formatEvent } from '../../../src/renderer/utils/eventFormatter';
import type { ExecutionEvent, ExecutionEventType } from '../../../src/shared/types/execution';

function makeEvent(type: ExecutionEventType, message: string, nodeId?: string): ExecutionEvent {
  return {
    id: `evt-${type}`,
    type,
    timestamp: '2026-02-24T10:30:00.000Z',
    message,
    nodeId,
  };
}

describe('formatEvent', () => {
  it('formats execution_started', () => {
    const result = formatEvent(makeEvent('execution_started', 'Workflow started'));
    expect(result.text).toContain('Workflow started');
    expect(result.icon).toBeTruthy();
    // Timezone-independent: just verify it contains "30" (minutes portion)
    expect(result.timestamp).toMatch(/\d{2}:30:\d{2}/);
  });

  it('formats node_started with node label', () => {
    const result = formatEvent(makeEvent('node_started', 'Started: Planner', 'node-1'), 'Planner');
    expect(result.text).toContain('Planner');
    expect(result.nodeId).toBe('node-1');
  });

  it('formats node_completed', () => {
    const result = formatEvent(makeEvent('node_completed', 'Completed: Backend'));
    expect(result.icon).toBeTruthy();
    expect(result.text).toContain('Completed');
  });

  it('formats node_failed', () => {
    const result = formatEvent(makeEvent('node_failed', 'Node crashed'));
    expect(result.text).toContain('crashed');
  });

  it('formats gate_waiting', () => {
    const result = formatEvent(makeEvent('gate_waiting', 'Waiting for approval'));
    expect(result.text).toContain('approval');
  });

  it('formats tool_call', () => {
    const result = formatEvent(makeEvent('tool_call', 'Calling Read tool'));
    expect(result.icon).toBeTruthy();
    expect(result.text).toContain('Read');
  });

  it('formats bash_command', () => {
    const result = formatEvent(makeEvent('bash_command', 'Running npm test'));
    expect(result.icon).toBeTruthy();
    expect(result.text).toContain('npm test');
  });

  it('formats block_gate_open', () => {
    const result = formatEvent(makeEvent('block_gate_open', 'Block gate opened'));
    expect(result.text).toContain('gate');
  });

  it('formats block_revision', () => {
    const result = formatEvent(makeEvent('block_revision', 'Block revised by user'));
    expect(result.text).toContain('revised');
  });

  it('formats cli_output', () => {
    const result = formatEvent(makeEvent('cli_output', 'Output line'));
    expect(result.text).toBe('Output line');
  });

  it('falls back to event.message for unknown types', () => {
    const event: ExecutionEvent = {
      id: 'unknown-1',
      type: 'some_future_type' as ExecutionEventType,
      timestamp: '2026-01-01T00:00:00Z',
      message: 'Unknown event occurred',
    };
    const result = formatEvent(event);
    expect(result.text).toBe('Unknown event occurred');
  });

  it('formats timestamp to locale time', () => {
    const result = formatEvent(makeEvent('execution_started', 'Started'));
    // Timestamp should be a formatted time string
    expect(result.timestamp).toBeTruthy();
    expect(typeof result.timestamp).toBe('string');
  });
});
