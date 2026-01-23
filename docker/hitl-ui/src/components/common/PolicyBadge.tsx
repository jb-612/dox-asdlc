/**
 * PolicyBadge - Displays active guardrail policies with tooltip details
 */

import { useState, useRef, useEffect } from 'react';
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  LockClosedIcon,
  EyeIcon,
  ClockIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export type PolicyType =
  | 'approval_required'
  | 'security_scan'
  | 'review_mandatory'
  | 'audit_trail'
  | 'time_limit'
  | 'compliance';

export type PolicyStatus = 'active' | 'inactive' | 'warning' | 'violated';

export interface PolicyDetails {
  /** Policy description */
  description: string;
  /** Enforcement level */
  enforcement?: 'strict' | 'advisory' | 'optional';
  /** When policy was activated */
  activatedAt?: string;
  /** Who activated the policy */
  activatedBy?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface PolicyBadgeProps {
  /** Policy type */
  type: PolicyType;
  /** Policy name */
  name: string;
  /** Policy status */
  status?: PolicyStatus;
  /** Policy details for tooltip */
  details?: PolicyDetails;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show icon */
  showIcon?: boolean;
  /** Custom class name */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

// Policy type to icon mapping
const policyIcons: Record<PolicyType, typeof ShieldCheckIcon> = {
  approval_required: ShieldCheckIcon,
  security_scan: ShieldExclamationIcon,
  review_mandatory: EyeIcon,
  audit_trail: DocumentCheckIcon,
  time_limit: ClockIcon,
  compliance: LockClosedIcon,
};

// Policy type to color mapping
const policyColors: Record<PolicyType, string> = {
  approval_required: 'text-accent-teal bg-accent-teal/10 border-accent-teal/30',
  security_scan: 'text-status-warning bg-status-warning/10 border-status-warning/30',
  review_mandatory: 'text-status-info bg-status-info/10 border-status-info/30',
  audit_trail: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  time_limit: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  compliance: 'text-status-success bg-status-success/10 border-status-success/30',
};

// Status to indicator color mapping
const statusColors: Record<PolicyStatus, string> = {
  active: 'bg-status-success',
  inactive: 'bg-gray-500',
  warning: 'bg-status-warning',
  violated: 'bg-status-error',
};

// Size variants
const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export default function PolicyBadge({
  type,
  name,
  status = 'active',
  details,
  size = 'md',
  showIcon = true,
  className,
  onClick,
}: PolicyBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const badgeRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const Icon = policyIcons[type];

  // Calculate tooltip position
  useEffect(() => {
    if (showTooltip && badgeRef.current && tooltipRef.current) {
      const badgeRect = badgeRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // Position below the badge, centered
      let left = badgeRect.left + badgeRect.width / 2 - tooltipRect.width / 2;
      const top = badgeRect.bottom + 8;

      // Keep tooltip within viewport
      if (left < 8) left = 8;
      if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
      }

      setTooltipPosition({ top, left });
    }
  }, [showTooltip]);

  // Format enforcement level
  const formatEnforcement = (enforcement?: string) => {
    switch (enforcement) {
      case 'strict':
        return 'Strictly Enforced';
      case 'advisory':
        return 'Advisory';
      case 'optional':
        return 'Optional';
      default:
        return null;
    }
  };

  return (
    <div className="relative inline-flex" data-testid="policy-badge">
      <div
        ref={badgeRef}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full border font-medium',
          policyColors[type],
          sizeClasses[size],
          onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
          className
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {/* Status indicator */}
        <span
          className={clsx('w-1.5 h-1.5 rounded-full', statusColors[status])}
          data-testid="policy-status"
        />

        {/* Icon */}
        {showIcon && <Icon className={iconSizes[size]} data-testid="policy-icon" />}

        {/* Name */}
        <span data-testid="policy-name">{name}</span>
      </div>

      {/* Tooltip */}
      {showTooltip && details && (
        <div
          ref={tooltipRef}
          className="fixed z-50 w-64 p-3 bg-bg-secondary border border-border-primary rounded-lg shadow-lg"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
          data-testid="policy-tooltip"
          role="tooltip"
        >
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-text-muted" />
              <span className="font-medium text-text-primary">{name}</span>
            </div>

            {/* Description */}
            <p className="text-sm text-text-secondary">{details.description}</p>

            {/* Metadata */}
            <div className="space-y-1 text-xs text-text-muted">
              {details.enforcement && (
                <div className="flex justify-between">
                  <span>Enforcement:</span>
                  <span className="font-medium">{formatEnforcement(details.enforcement)}</span>
                </div>
              )}
              {details.activatedBy && (
                <div className="flex justify-between">
                  <span>Activated by:</span>
                  <span className="font-medium">{details.activatedBy}</span>
                </div>
              )}
              {details.activatedAt && (
                <div className="flex justify-between">
                  <span>Since:</span>
                  <span className="font-medium">
                    {new Date(details.activatedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2 pt-1 border-t border-border-secondary">
              <span
                className={clsx('w-2 h-2 rounded-full', statusColors[status])}
              />
              <span className="text-xs capitalize text-text-muted">{status}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
