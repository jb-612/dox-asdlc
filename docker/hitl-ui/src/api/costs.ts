/**
 * Costs API client functions and React Query hooks (P13-F01)
 *
 * Handles cost data queries via backend REST API.
 * Supports mock mode for development via VITE_USE_MOCKS or DEV mode.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import {
  areMocksEnabled,
  getMockCostSummary,
  getMockCostRecords,
  getMockSessionCosts,
  getMockPricing,
  simulateCostDelay,
} from './mocks/index';
import type {
  CostSummaryResponse,
  CostRecordsResponse,
  SessionCostBreakdown,
  PricingResponse,
  CostGroupBy,
  CostTimeRange,
} from '../types/costs';

// ============================================================================
// Types
// ============================================================================

export interface CostRecordsFilters {
  agent?: string;
  session?: string;
  model?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// Query Keys
// ============================================================================

export const costsQueryKeys = {
  all: ['costs'] as const,
  summary: (groupBy: CostGroupBy, timeRange: CostTimeRange) =>
    [...costsQueryKeys.all, 'summary', groupBy, timeRange] as const,
  records: (filters?: CostRecordsFilters) =>
    [...costsQueryKeys.all, 'records', filters] as const,
  session: (sessionId: string) =>
    [...costsQueryKeys.all, 'session', sessionId] as const,
  pricing: () => [...costsQueryKeys.all, 'pricing'] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Convert a UI time range selection to Unix timestamp bounds.
 */
function timeRangeToDateBounds(
  timeRange: CostTimeRange
): { date_from?: number; date_to?: number } {
  if (timeRange === 'all') return {};
  const nowSec = Date.now() / 1000;
  const offsets: Record<string, number> = {
    '1h': 3600,
    '24h': 86400,
    '7d': 604800,
    '30d': 2592000,
  };
  return {
    date_from: nowSec - (offsets[timeRange] ?? 86400),
    date_to: nowSec,
  };
}

/**
 * Fetch aggregated cost summary grouped by a dimension.
 */
export async function getCostSummary(
  groupBy: CostGroupBy,
  timeRange: CostTimeRange
): Promise<CostSummaryResponse> {
  if (areMocksEnabled()) {
    await simulateCostDelay();
    return getMockCostSummary(groupBy, timeRange);
  }

  try {
    const dateBounds = timeRangeToDateBounds(timeRange);
    const { data } = await apiClient.get<CostSummaryResponse>('/costs/summary', {
      params: { group_by: groupBy, ...dateBounds },
    });
    return data;
  } catch (error) {
    console.error('Failed to fetch cost summary:', error);
    throw error;
  }
}

/**
 * Fetch paginated cost records with optional filters.
 */
export async function getCostRecords(
  filters?: CostRecordsFilters
): Promise<CostRecordsResponse> {
  if (areMocksEnabled()) {
    await simulateCostDelay();
    return getMockCostRecords(filters?.page ?? 1, filters?.pageSize ?? 50);
  }

  try {
    const params: Record<string, string | number> = {};
    if (filters?.agent) params.agent_id = filters.agent;
    if (filters?.session) params.session_id = filters.session;
    if (filters?.model) params.model = filters.model;
    if (filters?.page) params.page = filters.page;
    if (filters?.pageSize) params.page_size = filters.pageSize;

    const { data } = await apiClient.get<CostRecordsResponse>('/costs', {
      params,
    });
    return data;
  } catch (error) {
    console.error('Failed to fetch cost records:', error);
    throw error;
  }
}

/**
 * Fetch per-session cost breakdown.
 */
export async function getSessionCosts(
  sessionId: string
): Promise<SessionCostBreakdown> {
  if (areMocksEnabled()) {
    await simulateCostDelay();
    return getMockSessionCosts(sessionId);
  }

  try {
    const { data } = await apiClient.get<SessionCostBreakdown>(
      `/costs/sessions/${sessionId}`
    );
    return data;
  } catch (error) {
    console.error('Failed to fetch session costs:', error);
    throw error;
  }
}

/**
 * Fetch the current model pricing table.
 */
export async function getPricing(): Promise<PricingResponse> {
  if (areMocksEnabled()) {
    await simulateCostDelay();
    return getMockPricing();
  }

  try {
    const { data } = await apiClient.get<PricingResponse>('/costs/pricing');
    return data;
  } catch (error) {
    console.error('Failed to fetch pricing:', error);
    throw error;
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch aggregated cost summary.
 */
export function useCostSummary(
  groupBy: CostGroupBy,
  timeRange: CostTimeRange,
  refetchInterval?: number
) {
  return useQuery({
    queryKey: costsQueryKeys.summary(groupBy, timeRange),
    queryFn: () => getCostSummary(groupBy, timeRange),
    refetchInterval,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch paginated cost records.
 */
export function useCostRecords(
  filters?: CostRecordsFilters,
  refetchInterval?: number
) {
  return useQuery({
    queryKey: costsQueryKeys.records(filters),
    queryFn: () => getCostRecords(filters),
    refetchInterval,
    staleTime: 15000,
  });
}

/**
 * Hook to fetch per-session cost breakdown.
 * Disabled when sessionId is null.
 */
export function useSessionCosts(sessionId: string | null) {
  return useQuery({
    queryKey: costsQueryKeys.session(sessionId ?? ''),
    queryFn: () => getSessionCosts(sessionId!),
    enabled: !!sessionId,
    staleTime: 60000,
  });
}

/**
 * Hook to fetch the model pricing table.
 */
export function usePricing() {
  return useQuery({
    queryKey: costsQueryKeys.pricing(),
    queryFn: getPricing,
    staleTime: 300000,
  });
}
