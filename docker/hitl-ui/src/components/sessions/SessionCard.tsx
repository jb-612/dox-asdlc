import { Link } from 'react-router-dom';
import {
  DocumentTextIcon,
  ClockIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Badge, Card } from '@/components/common';
import type { SessionSummary, SessionStatus } from '@/api/types';
import { formatRelativeTime } from '@/utils/formatters';
import clsx from 'clsx';

interface SessionCardProps {
  session: SessionSummary;
}

const statusConfig: Record<
  SessionStatus,
  { label: string; variant: 'success' | 'warning' | 'error' | 'default' }
> = {
  active: { label: 'Active', variant: 'success' },
  completed: { label: 'Completed', variant: 'default' },
  failed: { label: 'Failed', variant: 'error' },
  cancelled: { label: 'Cancelled', variant: 'default' },
};

export default function SessionCard({ session }: SessionCardProps) {
  const config = statusConfig[session.status];
  const progressPercent = session.total_tasks > 0
    ? Math.round((session.completed_tasks / session.total_tasks) * 100)
    : 0;

  return (
    <Card className="p-4" hover>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5 text-text-tertiary" />
          <span className="font-mono text-sm text-text-secondary">
            {session.session_id.slice(0, 12)}
          </span>
        </div>
        <Badge variant={config.variant} dot>
          {config.label}
        </Badge>
      </div>

      {/* Epic ID */}
      {session.epic_id && (
        <div className="mb-3">
          <span className="text-xs text-text-tertiary uppercase tracking-wide">
            Epic
          </span>
          <p className="text-sm text-text-primary font-medium mt-0.5">
            {session.epic_id}
          </p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-text-secondary">Progress</span>
          <span className="text-text-primary font-medium">
            {session.completed_tasks}/{session.total_tasks} tasks
          </span>
        </div>
        <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-300',
              progressPercent === 100 ? 'bg-status-success' : 'bg-accent-teal'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Pending Gates Warning */}
      {session.pending_gates > 0 && (
        <div className="flex items-center gap-2 p-2 bg-status-warning/10 rounded-lg mb-3">
          <ShieldCheckIcon className="h-4 w-4 text-status-warning" />
          <span className="text-sm text-status-warning">
            {session.pending_gates} pending gate{session.pending_gates !== 1 ? 's' : ''}
          </span>
          <Link
            to={`/gates?session_id=${session.session_id}`}
            className="ml-auto text-xs text-accent-teal-light hover:underline"
          >
            View
          </Link>
        </div>
      )}

      {/* Completed badge */}
      {session.status === 'completed' && (
        <div className="flex items-center gap-2 p-2 bg-status-success/10 rounded-lg mb-3">
          <CheckCircleIcon className="h-4 w-4 text-status-success" />
          <span className="text-sm text-status-success">
            Completed {formatRelativeTime(session.completed_at!)}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="pt-3 border-t border-bg-tertiary flex items-center justify-between text-xs text-text-tertiary">
        <div className="flex items-center gap-1">
          <ClockIcon className="h-3.5 w-3.5" />
          <span>Started {formatRelativeTime(session.created_at)}</span>
        </div>
        {session.tenant_id && session.tenant_id !== 'default' && (
          <span className="font-mono">{session.tenant_id}</span>
        )}
      </div>
    </Card>
  );
}
