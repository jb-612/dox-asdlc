import { useState, useEffect, useCallback } from 'react';
import CostChart from './CostChart';
import type { ChartWindow } from './CostChart';
import ExecutionTable from './ExecutionTable';
import CostBreakdown from './CostBreakdown';
import type { ExecutionCostSummary, DailyCostPoint } from '../../../shared/types/analytics';

declare const electronAPI: {
  analytics: {
    getExecutions: (from: string, to: string) => Promise<ExecutionCostSummary[]>;
    getDailyCosts: (from: string, to: string) => Promise<DailyCostPoint[]>;
    onDataUpdated: (cb: () => void) => () => void;
  };
};

function getDateRange(window: ChartWindow): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (window === '7d' ? 7 : 30));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function AnalyticsTab(): JSX.Element {
  const [chartWindow, setChartWindow] = useState<ChartWindow>('7d');
  const [executions, setExecutions] = useState<ExecutionCostSummary[]>([]);
  const [dailyCosts, setDailyCosts] = useState<DailyCostPoint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const { from, to } = getDateRange(chartWindow);
    try {
      const [execs, costs] = await Promise.all([
        electronAPI.analytics.getExecutions(from, to),
        electronAPI.analytics.getDailyCosts(from, to),
      ]);
      setExecutions(execs);
      setDailyCosts(costs);
    } catch {
      // IPC may not be available in tests or early startup
    }
  }, [chartWindow]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsub = electronAPI.analytics.onDataUpdated(() => {
      fetchData();
    });
    return unsub;
  }, [fetchData]);

  const selected = executions.find((e) => e.executionId === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Cost Overview</h3>
        <CostChart
          data={dailyCosts}
          window={chartWindow}
          onWindowChange={setChartWindow}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Executions</h3>
        <ExecutionTable executions={executions} onSelect={setSelectedId} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Cost Breakdown</h3>
        <CostBreakdown execution={selected} />
      </div>
    </div>
  );
}
