import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowPathIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

import {
  CostSummaryCards,
  CostBreakdownChart,
  SessionCostTable,
  TimeRangeFilter,
} from '../components/costs';
import {
  useCostSummary,
  useCostRecords,
  costsQueryKeys,
} from '../api/costs';
import { useCostsStore } from '../stores/costsStore';
import type { CostGroupBy } from '../types/costs';

export default function CostDashboardPage() {
  const queryClient = useQueryClient();

  const {
    selectedTimeRange,
    selectedGroupBy,
    setGroupBy,
    autoRefresh,
    toggleAutoRefresh,
  } = useCostsStore();

  const refreshInterval = autoRefresh ? 30000 : undefined;

  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useCostSummary(selectedGroupBy, selectedTimeRange, refreshInterval);

  const {
    data: recordsData,
    isLoading: recordsLoading,
  } = useCostRecords(undefined, refreshInterval);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: costsQueryKeys.all });
  }, [queryClient]);

  const handleGroupByChange = useCallback(
    (mode: 'agent' | 'model') => {
      setGroupBy(mode as CostGroupBy);
    },
    [setGroupBy]
  );

  const handlePageChange = useCallback(
    (_page: number) => {
      // Page change would refetch with new page param
      // For now, records are fetched without pagination override
    },
    []
  );

  const handleRetry = useCallback(() => {
    refetchSummary();
  }, [refetchSummary]);

  if (summaryError && !summaryData) {
    return (
      <div
        data-testid="cost-dashboard-page"
        role="main"
        className="h-full flex flex-col bg-bg-primary"
      >
        <div className="flex-1 flex items-center justify-center">
          <div data-testid="error-message" className="text-center">
            <p className="text-status-error mb-4">Failed to load cost data</p>
            <button
              data-testid="retry-button"
              onClick={handleRetry}
              className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="cost-dashboard-page"
      role="main"
      className="h-full flex flex-col bg-bg-primary"
    >
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-teal/10">
              <CurrencyDollarIcon className="h-6 w-6 text-accent-teal" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                Cost Dashboard
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                Track API token usage and estimated costs per agent and model
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <TimeRangeFilter />

            <button
              data-testid="auto-refresh-toggle"
              onClick={toggleAutoRefresh}
              className={clsx(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                autoRefresh
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
              )}
              aria-pressed={autoRefresh}
            >
              Auto-refresh
            </button>

            <button
              data-testid="page-refresh"
              onClick={handleRefresh}
              className="p-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors"
              aria-label="Refresh data"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Summary Cards */}
          <section data-testid="summary-section">
            <CostSummaryCards
              data={summaryData ?? null}
              loading={summaryLoading}
            />
          </section>

          {/* Breakdown Chart */}
          <section data-testid="chart-section">
            <CostBreakdownChart
              data={summaryData ?? null}
              mode={selectedGroupBy === 'model' ? 'model' : 'agent'}
              onModeChange={handleGroupByChange}
            />
          </section>

          {/* Session Cost Table */}
          <section data-testid="table-section">
            <SessionCostTable
              records={recordsData?.records ?? []}
              total={recordsData?.total ?? 0}
              page={recordsData?.page ?? 1}
              pageSize={recordsData?.page_size ?? 50}
              onPageChange={handlePageChange}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
