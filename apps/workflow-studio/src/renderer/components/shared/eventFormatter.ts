import type { ExecutionEvent, ExecutionEventType } from '../../../shared/types/execution';
import type { TelemetryEvent, TelemetryEventType } from '../../../shared/types/monitoring';

export interface FormattedEvent {
  icon: string;
  label: string;
  detail: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

const EXECUTION_EVENT_MAP: Record<
  ExecutionEventType,
  { icon: string; label: string; severity: FormattedEvent['severity'] }
> = {
  execution_started: { icon: '\u25B6', label: 'Execution Started', severity: 'info' },
  execution_paused: { icon: '\u23F8', label: 'Execution Paused', severity: 'warning' },
  execution_resumed: { icon: '\u25B6', label: 'Execution Resumed', severity: 'info' },
  execution_completed: { icon: '\u2714', label: 'Execution Completed', severity: 'info' },
  execution_failed: { icon: '\u2718', label: 'Execution Failed', severity: 'error' },
  execution_aborted: { icon: '\u26D4', label: 'Execution Aborted', severity: 'error' },
  node_started: { icon: '\u25B6', label: 'Node Started', severity: 'info' },
  node_completed: { icon: '\u2714', label: 'Node Completed', severity: 'info' },
  node_failed: { icon: '\u2718', label: 'Node Failed', severity: 'error' },
  node_skipped: { icon: '\u23ED', label: 'Node Skipped', severity: 'warning' },
  gate_waiting: { icon: '\u23F3', label: 'Gate Waiting', severity: 'warning' },
  gate_decided: { icon: '\u2714', label: 'Gate Decided', severity: 'info' },
  cli_output: { icon: '\u25B8', label: 'CLI Output', severity: 'info' },
  cli_error: { icon: '\u26A0', label: 'CLI Error', severity: 'error' },
  cli_exit: { icon: '\u23F9', label: 'CLI Exit', severity: 'info' },
  variable_updated: { icon: '\u270E', label: 'Variable Updated', severity: 'info' },
  tool_call: { icon: '\u2699', label: 'Tool Call', severity: 'info' },
  bash_command: { icon: '$', label: 'Bash Command', severity: 'info' },
  block_gate_open: { icon: '\u{1F6AA}', label: 'Block Gate Open', severity: 'warning' },
  block_revision: { icon: '\u{1F504}', label: 'Block Revision', severity: 'warning' },
};

const TELEMETRY_EVENT_MAP: Record<
  TelemetryEventType,
  { icon: string; label: string; severity: FormattedEvent['severity'] }
> = {
  agent_start: { icon: '\u25B6', label: 'Agent Start', severity: 'info' },
  agent_complete: { icon: '\u2714', label: 'Agent Complete', severity: 'info' },
  agent_error: { icon: '\u2718', label: 'Agent Error', severity: 'error' },
  tool_call: { icon: '\u2699', label: 'Tool Call', severity: 'info' },
  bash_command: { icon: '$', label: 'Bash Command', severity: 'info' },
  metric: { icon: '\u{1F4CA}', label: 'Metric', severity: 'info' },
  lifecycle: { icon: '\u{1F504}', label: 'Lifecycle', severity: 'info' },
  token_usage: { icon: '\u{1F4B0}', label: 'Token Usage', severity: 'info' },
  custom: { icon: '\u2699', label: 'Custom', severity: 'info' },
};

export function formatExecutionEvent(event: ExecutionEvent): FormattedEvent {
  const mapping = EXECUTION_EVENT_MAP[event.type] ?? {
    icon: '\u2022',
    label: event.type,
    severity: 'info' as const,
  };
  return {
    icon: mapping.icon,
    label: mapping.label,
    detail: event.message,
    timestamp: event.timestamp,
    severity: mapping.severity,
  };
}

export function formatTelemetryEvent(event: TelemetryEvent): FormattedEvent {
  const mapping = TELEMETRY_EVENT_MAP[event.type] ?? {
    icon: '\u2022',
    label: event.type,
    severity: 'info' as const,
  };
  const detail =
    typeof event.data === 'string'
      ? event.data
      : event.data != null
        ? JSON.stringify(event.data)
        : '';
  return {
    icon: mapping.icon,
    label: mapping.label,
    detail,
    timestamp: event.timestamp,
    severity: mapping.severity,
  };
}
