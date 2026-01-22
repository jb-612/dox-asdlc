import {
  CpuChipIcon,
  ClockIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { Badge } from '@/components/common';
import type { AgentStatus, AgentStatusType } from '@/api/types';
import { formatRelativeTime } from '@/utils/formatters';
import clsx from 'clsx';

interface WorkerCardProps {
  worker: AgentStatus;
}

const statusConfig: Record<
  AgentStatusType,
  { label: string; variant: 'success' | 'warning' | 'error' | 'default'; dot: boolean }
> = {
  running: { label: 'Running', variant: 'success', dot: true },
  idle: { label: 'Idle', variant: 'default', dot: false },
  error: { label: 'Error', variant: 'error', dot: true },
  stopped: { label: 'Stopped', variant: 'default', dot: false },
};

export default function WorkerCard({ worker }: WorkerCardProps) {
  const config = statusConfig[worker.status];

  return (
    <div
      className={clsx(
        'card p-4',
        worker.status === 'running' && 'border-status-success/20',
        worker.status === 'error' && 'border-status-error/20'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CpuChipIcon className="h-5 w-5 text-text-tertiary" />
          <span className="font-mono text-sm text-text-secondary">
            {worker.agent_id}
          </span>
        </div>
        <Badge variant={config.variant} dot={config.dot}>
          {config.label}
        </Badge>
      </div>

      {/* Agent Type */}
      <div className="mb-3">
        <span className="text-xs text-text-tertiary uppercase tracking-wide">
          Type
        </span>
        <p className="text-sm text-text-primary font-medium mt-0.5">
          {worker.agent_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </p>
      </div>

      {/* Current Task (if running) */}
      {worker.status === 'running' && worker.current_task && (
        <div className="mb-3">
          <span className="text-xs text-text-tertiary uppercase tracking-wide">
            Current Task
          </span>
          <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">
            {worker.current_task}
          </p>
        </div>
      )}

      {/* Session (if assigned) */}
      {worker.session_id && (
        <div className="flex items-center gap-2 text-sm text-text-tertiary mb-3">
          <DocumentTextIcon className="h-4 w-4" />
          <span className="font-mono text-xs truncate">
            {worker.session_id}
          </span>
        </div>
      )}

      {/* Footer - timestamps */}
      <div className="pt-3 border-t border-bg-tertiary flex items-center justify-between text-xs text-text-tertiary">
        {worker.started_at && (
          <div className="flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            <span>Started {formatRelativeTime(worker.started_at)}</span>
          </div>
        )}
        {worker.last_heartbeat && (
          <div className="flex items-center gap-1">
            <span>Heartbeat {formatRelativeTime(worker.last_heartbeat)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
