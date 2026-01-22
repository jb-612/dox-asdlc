import type { GateType, GateStatus, ArtifactType } from '@/api/types';

/**
 * Gate type display configuration
 */
export const GATE_TYPE_CONFIG: Record<
  GateType,
  {
    label: string;
    shortLabel: string;
    color: string;
    description: string;
  }
> = {
  prd_review: {
    label: 'PRD Review',
    shortLabel: 'PRD',
    color: 'gate-prd',
    description: 'Product Requirements Document review',
  },
  design_review: {
    label: 'Design Review',
    shortLabel: 'Design',
    color: 'gate-design',
    description: 'Architecture and design review',
  },
  code_review: {
    label: 'Code Review',
    shortLabel: 'Code',
    color: 'gate-code',
    description: 'Code implementation review',
  },
  test_review: {
    label: 'Test Review',
    shortLabel: 'Test',
    color: 'gate-test',
    description: 'Test results and validation review',
  },
  deployment_approval: {
    label: 'Deployment',
    shortLabel: 'Deploy',
    color: 'gate-deploy',
    description: 'Production deployment approval',
  },
};

/**
 * Gate status display configuration
 */
export const GATE_STATUS_CONFIG: Record<
  GateStatus,
  {
    label: string;
    color: string;
    icon: string;
  }
> = {
  pending: {
    label: 'Pending',
    color: 'status-warning',
    icon: 'clock',
  },
  approved: {
    label: 'Approved',
    color: 'status-success',
    icon: 'check',
  },
  rejected: {
    label: 'Rejected',
    color: 'status-error',
    icon: 'x',
  },
  expired: {
    label: 'Expired',
    color: 'text-tertiary',
    icon: 'clock-expired',
  },
};

/**
 * Artifact type display configuration
 */
export const ARTIFACT_TYPE_CONFIG: Record<
  ArtifactType,
  {
    label: string;
    icon: string;
    canPreview: boolean;
  }
> = {
  file: {
    label: 'File',
    icon: 'document',
    canPreview: true,
  },
  diff: {
    label: 'Diff',
    icon: 'code',
    canPreview: true,
  },
  log: {
    label: 'Log',
    icon: 'terminal',
    canPreview: true,
  },
  report: {
    label: 'Report',
    icon: 'chart',
    canPreview: true,
  },
};

/**
 * All gate types for filtering
 */
export const ALL_GATE_TYPES: GateType[] = [
  'prd_review',
  'design_review',
  'code_review',
  'test_review',
  'deployment_approval',
];

/**
 * Polling intervals (in milliseconds)
 */
export const POLLING_INTERVALS = {
  gates: 10000,      // 10 seconds
  gateDetail: 5000,  // 5 seconds
  workers: 30000,    // 30 seconds
  sessions: 15000,   // 15 seconds
};
