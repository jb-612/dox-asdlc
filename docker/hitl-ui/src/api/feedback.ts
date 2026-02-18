/**
 * Feedback Learning API
 *
 * Provides hooks for submitting HITL feedback and managing rule proposals.
 * Part of P05-F04: Adaptive Feedback Learning System.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// =============================================================================
// Types
// =============================================================================

/** Feedback tag categories */
export type FeedbackTag = 'quality' | 'completeness' | 'scope' | 'style' | 'other';

/** Severity levels for feedback */
export type Severity = 'low' | 'medium' | 'high';

/** Rule types */
export type RuleType = 'NEGATIVE_EXAMPLE' | 'POSITIVE_EXAMPLE' | 'GUIDELINE' | 'CONSTRAINT';

/** Rule status */
export type RuleStatus = 'pending' | 'approved' | 'rejected';

/** Risk level for impact analysis */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Evidence item for rule proposals */
export interface Evidence {
  type: string;
  description: string;
}

/** Impact analysis for rule proposals */
export interface ImpactAnalysis {
  estimatedReductionPercent: number;
  affectedGatesCount: number;
  riskLevel: RiskLevel;
}

/** Rule proposal from Evaluator Agent */
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
  status: RuleStatus;
  confidence: number;
  ruleType: RuleType;
  ruleContent: string;
  feedbackIds?: string[];
  rejectionReason?: string;
  approvedAt?: string;
  approvedBy?: string;
}

/** Feedback submission payload */
export interface FeedbackSubmission {
  gateId: string;
  decision: 'approved' | 'rejected' | 'approved_with_changes';
  tags?: FeedbackTag[];
  summary?: string;
  severity?: Severity;
  considerForImprovement?: boolean;
  durationSeconds?: number;
  correctionDiff?: string;
  reviewerComment?: string;
}

/** Response from feedback submission */
export interface FeedbackResponse {
  success: boolean;
  feedbackId: string;
  classification?: {
    type: string;
    confidence: number;
  };
}

/** Rule decision payload */
export interface RuleDecision {
  ruleId: string;
  decision: 'approved' | 'rejected';
  decidedBy: string;
  reason?: string;
  modifiedContent?: string;
}

/** Response from rule decision */
export interface RuleDecisionResponse {
  success: boolean;
  ruleId: string;
  status: RuleStatus;
}

/** Query params for pending rules */
export interface PendingRulesParams {
  agent?: string;
  ruleType?: RuleType;
  minConfidence?: number;
  limit?: number;
}

/** Response for pending rules */
export interface PendingRulesResponse {
  rules: RuleProposal[];
  total: number;
}

// =============================================================================
// Query Keys
// =============================================================================

export const ruleKeys = {
  all: ['rules'] as const,
  pending: (params?: PendingRulesParams) => [...ruleKeys.all, 'pending', params] as const,
  detail: (id: string) => [...ruleKeys.all, 'detail', id] as const,
};

export const feedbackKeys = {
  all: ['feedback'] as const,
  byGate: (gateId: string) => [...feedbackKeys.all, 'gate', gateId] as const,
};

// =============================================================================
// Mock Data
// =============================================================================

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true' || import.meta.env.DEV;

const mockRuleProposals: RuleProposal[] = [
  {
    id: 'rule-001',
    title: 'Require acceptance criteria in all PRDs',
    description:
      'Automatically flag PRD artifacts that do not contain an acceptance criteria section for human review.',
    proposedBy: 'evaluator-agent',
    proposedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    affectedAgents: ['prd-agent', 'review-agent'],
    evidenceCount: 12,
    evidence: [
      { type: 'rejection', description: 'PRD rejected 12 times for missing acceptance criteria' },
      { type: 'pattern', description: '95% of rejections include this feedback' },
      { type: 'similar', description: '8 reviewers provided similar feedback' },
    ],
    impact: {
      estimatedReductionPercent: 30,
      affectedGatesCount: 25,
      riskLevel: 'low',
    },
    status: 'pending',
    confidence: 0.92,
    ruleType: 'GUIDELINE',
    ruleContent:
      'PRD documents MUST include an "Acceptance Criteria" section with measurable success metrics.',
  },
  {
    id: 'rule-002',
    title: 'Include error handling in API implementations',
    description:
      'Code review should verify that all API endpoints have proper error handling and return appropriate HTTP status codes.',
    proposedBy: 'evaluator-agent',
    proposedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    affectedAgents: ['coding-agent', 'review-agent'],
    evidenceCount: 8,
    evidence: [
      { type: 'rejection', description: 'Code rejected 8 times for missing error handling' },
      { type: 'pattern', description: 'All rejections mentioned HTTP status codes' },
    ],
    impact: {
      estimatedReductionPercent: 15,
      affectedGatesCount: 40,
      riskLevel: 'medium',
    },
    status: 'pending',
    confidence: 0.78,
    ruleType: 'CONSTRAINT',
    ruleContent:
      'All API endpoints MUST include try-catch blocks and return appropriate HTTP status codes (4xx for client errors, 5xx for server errors).',
  },
  {
    id: 'rule-003',
    title: 'Architecture diagrams required for design reviews',
    description:
      'Design documents should include at least one architecture diagram (C4, sequence, or component).',
    proposedBy: 'evaluator-agent',
    proposedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    affectedAgents: ['design-agent', 'architect-agent'],
    evidenceCount: 5,
    evidence: [
      { type: 'rejection', description: 'Design rejected 5 times for missing diagrams' },
      { type: 'positive', description: 'Approved designs with diagrams had 40% fewer iterations' },
    ],
    impact: {
      estimatedReductionPercent: 25,
      affectedGatesCount: 15,
      riskLevel: 'low',
    },
    status: 'pending',
    confidence: 0.85,
    ruleType: 'GUIDELINE',
    ruleContent:
      'Design documents SHOULD include at least one visual diagram. Recommended: C4 context diagram for high-level, sequence diagram for workflows.',
  },
];

// =============================================================================
// API Functions
// =============================================================================

/** Fetch pending rule proposals */
async function fetchPendingRules(
  params?: PendingRulesParams
): Promise<PendingRulesResponse> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    let filtered = [...mockRuleProposals];

    if (params?.agent) {
      const agent = params.agent;
      filtered = filtered.filter((r) => r.affectedAgents.includes(agent));
    }
    if (params?.ruleType) {
      filtered = filtered.filter((r) => r.ruleType === params.ruleType);
    }
    if (params?.minConfidence) {
      const minConf = params.minConfidence;
      filtered = filtered.filter((r) => r.confidence >= minConf);
    }
    if (params?.limit) {
      filtered = filtered.slice(0, params.limit);
    }

    return {
      rules: filtered,
      total: filtered.length,
    };
  }

  const { data } = await apiClient.get<PendingRulesResponse>('/feedback/rules/pending', {
    params,
  });
  return data;
}

/** Submit feedback for a gate decision */
async function submitFeedback(
  feedback: FeedbackSubmission
): Promise<FeedbackResponse> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return {
      success: true,
      feedbackId: `fb_${Date.now()}`,
      classification: feedback.considerForImprovement
        ? { type: 'generalizable_low', confidence: 0.6 }
        : undefined,
    };
  }

  const { data } = await apiClient.post<FeedbackResponse>(
    `/feedback/gates/${feedback.gateId}`,
    feedback
  );
  return data;
}

/** Approve a rule proposal */
async function approveRule(
  decision: RuleDecision
): Promise<RuleDecisionResponse> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      success: true,
      ruleId: decision.ruleId,
      status: 'approved',
    };
  }

  const { data } = await apiClient.post<RuleDecisionResponse>(
    `/feedback/rules/${decision.ruleId}/approve`,
    decision
  );
  return data;
}

/** Reject a rule proposal */
async function rejectRule(
  decision: RuleDecision
): Promise<RuleDecisionResponse> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      success: true,
      ruleId: decision.ruleId,
      status: 'rejected',
    };
  }

  const { data } = await apiClient.post<RuleDecisionResponse>(
    `/feedback/rules/${decision.ruleId}/reject`,
    decision
  );
  return data;
}

// =============================================================================
// React Query Hooks
// =============================================================================

/**
 * Hook to fetch pending rule proposals
 */
export function usePendingRules(params?: PendingRulesParams) {
  return useQuery({
    queryKey: ruleKeys.pending(params),
    queryFn: () => fetchPendingRules(params),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

/**
 * Hook to submit feedback for a gate decision
 */
export function useSubmitFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitFeedback,
    onSuccess: (_, variables) => {
      // Invalidate feedback queries for this gate
      queryClient.invalidateQueries({
        queryKey: feedbackKeys.byGate(variables.gateId),
      });
    },
  });
}

/**
 * Hook to approve a rule proposal
 */
export function useApproveRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveRule,
    onSuccess: (_, variables) => {
      // Invalidate pending rules list
      queryClient.invalidateQueries({ queryKey: ruleKeys.all });
      // Update the specific rule in cache
      queryClient.setQueryData(ruleKeys.detail(variables.ruleId), (old: RuleProposal | undefined) => {
        if (!old) return old;
        return { ...old, status: 'approved' as const };
      });
    },
  });
}

/**
 * Hook to reject a rule proposal
 */
export function useRejectRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rejectRule,
    onSuccess: (_, variables) => {
      // Invalidate pending rules list
      queryClient.invalidateQueries({ queryKey: ruleKeys.all });
      // Update the specific rule in cache
      queryClient.setQueryData(ruleKeys.detail(variables.ruleId), (old: RuleProposal | undefined) => {
        if (!old) return old;
        return {
          ...old,
          status: 'rejected' as const,
          rejectionReason: variables.reason,
        };
      });
    },
  });
}
