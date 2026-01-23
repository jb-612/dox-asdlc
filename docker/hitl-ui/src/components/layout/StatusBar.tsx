import {
  CodeBracketIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import { useSessionStore } from '@/stores/sessionStore';
import { useEventStore } from '@/stores/eventStore';
import clsx from 'clsx';

type SystemHealth = 'healthy' | 'degraded' | 'unhealthy';

interface StatusBarProps {
  activeWorkers?: number;
  totalWorkers?: number;
  pendingGates?: number;
  systemHealth?: SystemHealth;
  onOpenEventPanel?: () => void;
}

const healthConfig: Record<SystemHealth, { icon: typeof CheckCircleIcon; color: string; label: string }> = {
  healthy: {
    icon: CheckCircleIcon,
    color: 'text-status-success',
    label: 'Healthy',
  },
  degraded: {
    icon: ExclamationTriangleIcon,
    color: 'text-status-warning',
    label: 'Degraded',
  },
  unhealthy: {
    icon: XCircleIcon,
    color: 'text-status-error',
    label: 'Unhealthy',
  },
};

interface StatusItemProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

function StatusItem({ icon: Icon, children, className, onClick }: StatusItemProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1',
        onClick && 'hover:bg-bg-tertiary cursor-pointer transition-colors rounded',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs">{children}</span>
    </Wrapper>
  );
}

export default function StatusBar({
  activeWorkers = 0,
  totalWorkers = 0,
  pendingGates = 0,
  systemHealth = 'healthy',
  onOpenEventPanel,
}: StatusBarProps) {
  const { currentBranch, currentGitSha, repo } = useSessionStore();
  const { connected, events } = useEventStore();

  const health = healthConfig[systemHealth];
  const HealthIcon = health.icon;

  const displayGitInfo = repo
    ? `${currentBranch || 'main'}${currentGitSha ? ` @ ${currentGitSha.slice(0, 7)}` : ''}`
    : 'No repo selected';

  return (
    <div className="flex h-8 items-center justify-between border-t border-bg-tertiary bg-bg-secondary px-2 text-text-secondary">
      {/* Left side */}
      <div className="flex items-center divide-x divide-bg-tertiary">
        {/* Git info */}
        <StatusItem icon={CodeBracketIcon} className="text-text-muted">
          {displayGitInfo}
        </StatusItem>

        {/* Workers */}
        <StatusItem icon={UserGroupIcon}>
          <span className="text-text-primary font-medium">{activeWorkers}</span>
          <span className="text-text-muted">/{totalWorkers} workers</span>
        </StatusItem>

        {/* Pending gates */}
        <StatusItem
          icon={ShieldCheckIcon}
          className={pendingGates > 0 ? 'text-status-warning' : undefined}
        >
          <span className={clsx('font-medium', pendingGates > 0 && 'text-status-warning')}>
            {pendingGates}
          </span>
          <span className="text-text-muted"> pending gates</span>
        </StatusItem>
      </div>

      {/* Right side */}
      <div className="flex items-center divide-x divide-bg-tertiary">
        {/* Event panel toggle */}
        <StatusItem
          icon={SignalIcon}
          className={clsx(
            connected ? 'text-status-success' : 'text-status-error'
          )}
          onClick={onOpenEventPanel}
        >
          <span className="text-text-muted">{events.length} events</span>
        </StatusItem>

        {/* System health */}
        <div className={clsx('flex items-center gap-1.5 px-3 py-1', health.color)}>
          <HealthIcon className="h-4 w-4" />
          <span className="text-xs font-medium">{health.label}</span>
        </div>
      </div>
    </div>
  );
}
