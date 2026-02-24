export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const STATUS_MAP: Record<string, StatusVariant> = {
  active: 'success',
  running: 'success',
  completed: 'success',
  success: 'success',

  paused: 'warning',
  waiting_gate: 'warning',
  partial: 'warning',
  dormant: 'warning',

  failed: 'error',
  error: 'error',
  aborted: 'error',
  terminated: 'error',

  starting: 'info',
  idle: 'info',
};

export function statusToVariant(status: string): StatusVariant {
  return STATUS_MAP[status] ?? 'neutral';
}
