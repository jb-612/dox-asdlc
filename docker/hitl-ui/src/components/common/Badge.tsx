import clsx from 'clsx';
import { ReactNode } from 'react';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'prd'
  | 'design'
  | 'code'
  | 'test'
  | 'deploy';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-bg-tertiary text-text-secondary',
  success: 'bg-status-success/10 text-status-success border border-status-success/20',
  warning: 'bg-status-warning/10 text-status-warning border border-status-warning/20',
  error: 'bg-status-error/10 text-status-error border border-status-error/20',
  info: 'bg-status-info/10 text-status-info border border-status-info/20',
  // Gate type specific colors
  prd: 'bg-gate-prd/10 text-gate-prd border border-gate-prd/20',
  design: 'bg-gate-design/10 text-gate-design border border-gate-design/20',
  code: 'bg-gate-code/10 text-gate-code border border-gate-code/20',
  test: 'bg-gate-test/10 text-gate-test border border-gate-test/20',
  deploy: 'bg-gate-deploy/10 text-gate-deploy border border-gate-deploy/20',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-text-secondary',
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  error: 'bg-status-error',
  info: 'bg-status-info',
  prd: 'bg-gate-prd',
  design: 'bg-gate-design',
  code: 'bg-gate-code',
  test: 'bg-gate-test',
  deploy: 'bg-gate-deploy',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'badge inline-flex items-center gap-1.5 font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {dot && (
        <span
          className={clsx('h-1.5 w-1.5 rounded-full', dotColors[variant])}
        />
      )}
      {children}
    </span>
  );
}
