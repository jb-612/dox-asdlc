import { ReactNode } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  color?: 'default' | 'teal' | 'success' | 'warning' | 'error';
  onClick?: () => void;
}

const colorStyles = {
  default: {
    icon: 'bg-bg-tertiary text-text-secondary',
    value: 'text-text-primary',
  },
  teal: {
    icon: 'bg-accent-teal/20 text-accent-teal-light',
    value: 'text-accent-teal-light',
  },
  success: {
    icon: 'bg-status-success/20 text-status-success',
    value: 'text-status-success',
  },
  warning: {
    icon: 'bg-status-warning/20 text-status-warning',
    value: 'text-status-warning',
  },
  error: {
    icon: 'bg-status-error/20 text-status-error',
    value: 'text-status-error',
  },
};

export default function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'default',
  onClick,
}: StatsCardProps) {
  const styles = colorStyles[color];
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={clsx(
        'card p-5 flex items-start gap-4 text-left w-full',
        onClick && 'card-hover cursor-pointer'
      )}
    >
      {/* Icon */}
      {icon && (
        <div className={clsx('p-3 rounded-lg flex-shrink-0', styles.icon)}>
          {icon}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-secondary">{title}</p>
        <p className={clsx('text-3xl font-semibold mt-1', styles.value)}>
          {value}
        </p>
        {subtitle && (
          <p className="text-sm text-text-tertiary mt-1">{subtitle}</p>
        )}

        {/* Trend */}
        {trend && (
          <div
            className={clsx(
              'flex items-center gap-1 text-sm mt-2',
              trend.value >= 0 ? 'text-status-success' : 'text-status-error'
            )}
          >
            {trend.value >= 0 ? (
              <ArrowUpIcon className="h-4 w-4" />
            ) : (
              <ArrowDownIcon className="h-4 w-4" />
            )}
            <span>
              {Math.abs(trend.value)}% {trend.label}
            </span>
          </div>
        )}
      </div>
    </Component>
  );
}
