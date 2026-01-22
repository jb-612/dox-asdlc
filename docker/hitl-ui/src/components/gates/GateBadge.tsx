import Badge from '@/components/common/Badge';
import type { GateType, GateStatus } from '@/api/types';
import { gateTypeLabels, gateStatusLabels } from '@/api/types';

type GateBadgeVariant = 'prd' | 'design' | 'code' | 'test' | 'deploy';

const gateTypeToVariant: Record<GateType, GateBadgeVariant> = {
  prd_review: 'prd',
  design_review: 'design',
  code_review: 'code',
  test_review: 'test',
  deployment_approval: 'deploy',
};

const statusToVariant: Record<GateStatus, 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  expired: 'default',
};

interface GateTypeBadgeProps {
  type: GateType;
  className?: string;
}

export function GateTypeBadge({ type, className }: GateTypeBadgeProps) {
  return (
    <Badge variant={gateTypeToVariant[type]} className={className}>
      {gateTypeLabels[type]}
    </Badge>
  );
}

interface GateStatusBadgeProps {
  status: GateStatus;
  className?: string;
}

export function GateStatusBadge({ status, className }: GateStatusBadgeProps) {
  return (
    <Badge variant={statusToVariant[status]} dot className={className}>
      {gateStatusLabels[status]}
    </Badge>
  );
}
