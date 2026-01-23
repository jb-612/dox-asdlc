/**
 * RuleProposalCard - Displays a proposed rule change with impact analysis
 *
 * Shows rule details, affected agents, evidence, and allows approve/modify/reject decisions.
 */

import { useState, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  PencilIcon,
  XCircleIcon,
  UserGroupIcon,
  DocumentMagnifyingGlassIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { formatRelativeTime } from '@/utils/formatters';

export interface Evidence {
  type: string;
  description: string;
}

export interface ImpactAnalysis {
  estimatedReductionPercent: number;
  affectedGatesCount: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RuleProposal {
  id: string;
  title: string;
  description: string;
  proposedBy: string;
  proposedAt: string;
  affectedAgents: string[];
  evidenceCount: number;
  evidence: Evidence[];
  impact: ImpactAnalysis;
}

interface RuleProposalCardProps {
  proposal: RuleProposal;
  className?: string;
  collapsed?: boolean;
  onApprove?: (ruleId: string) => void;
  onModify?: (ruleId: string) => void;
  onReject?: (ruleId: string) => void;
}

const riskLevelStyles: Record<ImpactAnalysis['riskLevel'], string> = {
  low: 'text-status-success',
  medium: 'text-status-warning',
  high: 'text-status-error',
};

export default function RuleProposalCard({
  proposal,
  className,
  collapsed: initialCollapsed = false,
  onApprove,
  onModify,
  onReject,
}: RuleProposalCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  const handleApprove = useCallback(() => {
    onApprove?.(proposal.id);
  }, [onApprove, proposal.id]);

  const handleModify = useCallback(() => {
    onModify?.(proposal.id);
  }, [onModify, proposal.id]);

  const handleReject = useCallback(() => {
    onReject?.(proposal.id);
  }, [onReject, proposal.id]);

  const handleKeyDown = useCallback(
    (action: () => void) => (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        action();
      }
    },
    []
  );

  const handleExpand = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  return (
    <div
      data-testid="rule-proposal-card"
      className={clsx(
        'bg-bg-secondary border border-bg-tertiary rounded-lg overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-bg-tertiary">
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {proposal.title}
        </h3>
        <p className="text-sm text-text-secondary">{proposal.description}</p>
      </div>

      {/* Metadata */}
      <div className="px-4 py-3 bg-bg-primary/50 border-b border-bg-tertiary">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div data-testid="proposed-by" className="flex items-center gap-1.5">
            <span className="text-text-tertiary">Proposed by:</span>
            <span className="text-text-secondary font-medium">
              {proposal.proposedBy}
            </span>
          </div>
          <div data-testid="proposed-at" className="flex items-center gap-1.5">
            <span className="text-text-tertiary">When:</span>
            <span className="text-text-secondary">
              {formatRelativeTime(proposal.proposedAt)}
            </span>
          </div>
          <div data-testid="evidence-count" className="flex items-center gap-1.5">
            <DocumentMagnifyingGlassIcon className="h-4 w-4 text-text-tertiary" />
            <span className="text-text-secondary">
              {proposal.evidenceCount} evidence items
            </span>
          </div>
        </div>
      </div>

      {/* Collapsed state - show expand button */}
      {isCollapsed ? (
        <div className="p-4">
          <button
            data-testid="expand-card"
            onClick={handleExpand}
            className="flex items-center gap-2 text-sm text-accent-blue hover:text-accent-blue/80 transition-colors"
          >
            <ChevronDownIcon className="h-4 w-4" />
            Show details
          </button>
        </div>
      ) : (
        <>
          {/* Affected Agents */}
          <div
            data-testid="affected-agents"
            className="px-4 py-3 border-b border-bg-tertiary"
          >
            <div className="flex items-center gap-2 mb-2">
              <UserGroupIcon className="h-4 w-4 text-text-tertiary" />
              <span className="text-sm font-medium text-text-primary">
                Affected Agents
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {proposal.affectedAgents.map((agent) => (
                <span
                  key={agent}
                  className="px-2 py-1 text-xs bg-bg-tertiary text-text-secondary rounded"
                >
                  {agent}
                </span>
              ))}
            </div>
          </div>

          {/* Evidence Section */}
          <div
            data-testid="evidence-section"
            className="px-4 py-3 border-b border-bg-tertiary"
          >
            <div className="flex items-center gap-2 mb-3">
              <DocumentMagnifyingGlassIcon className="h-4 w-4 text-text-tertiary" />
              <span className="text-sm font-medium text-text-primary">
                Supporting Evidence
              </span>
            </div>
            <div className="space-y-2">
              {proposal.evidence.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="px-1.5 py-0.5 text-xs bg-accent-blue/20 text-accent-blue rounded">
                    {item.type}
                  </span>
                  <span className="text-text-secondary">{item.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Impact Analysis */}
          <div
            data-testid="impact-section"
            className="px-4 py-3 border-b border-bg-tertiary"
          >
            <div className="flex items-center gap-2 mb-3">
              <ChartBarIcon className="h-4 w-4 text-text-tertiary" />
              <span className="text-sm font-medium text-text-primary">
                Impact Analysis
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-text-tertiary mb-1">
                  Estimated Reduction
                </p>
                <p
                  data-testid="estimated-reduction"
                  className="text-lg font-semibold text-status-success"
                >
                  {proposal.impact.estimatedReductionPercent}%
                </p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary mb-1">
                  Affected Gates
                </p>
                <p
                  data-testid="affected-gates"
                  className="text-lg font-semibold text-text-primary"
                >
                  {proposal.impact.affectedGatesCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary mb-1">Risk Level</p>
                <p
                  data-testid="risk-level"
                  className={clsx(
                    'text-lg font-semibold capitalize',
                    riskLevelStyles[proposal.impact.riskLevel]
                  )}
                >
                  {proposal.impact.riskLevel}
                </p>
              </div>
            </div>
          </div>

          {/* Decision Actions */}
          <div className="p-4 flex items-center gap-3">
            <button
              data-testid="approve-rule"
              onClick={handleApprove}
              onKeyDown={handleKeyDown(handleApprove)}
              className="flex items-center gap-2 px-4 py-2 bg-status-success text-white rounded-lg hover:bg-status-success/90 transition-colors"
            >
              <CheckCircleIcon className="h-4 w-4" />
              Approve
            </button>
            <button
              data-testid="modify-rule"
              onClick={handleModify}
              onKeyDown={handleKeyDown(handleModify)}
              className="flex items-center gap-2 px-4 py-2 bg-status-warning text-white rounded-lg hover:bg-status-warning/90 transition-colors"
            >
              <PencilIcon className="h-4 w-4" />
              Modify
            </button>
            <button
              data-testid="reject-rule"
              onClick={handleReject}
              onKeyDown={handleKeyDown(handleReject)}
              className="flex items-center gap-2 px-4 py-2 bg-status-error text-white rounded-lg hover:bg-status-error/90 transition-colors"
            >
              <XCircleIcon className="h-4 w-4" />
              Reject
            </button>
          </div>
        </>
      )}
    </div>
  );
}
