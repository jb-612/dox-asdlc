import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import Card, { CardHeader, CardTitle, CardContent } from '../common/Card';
import type { CostSummaryResponse } from '../../types/costs';

interface CostBreakdownChartProps {
  data: CostSummaryResponse | null;
  mode: 'agent' | 'model';
  onModeChange: (mode: 'agent' | 'model') => void;
}

const CHART_COLORS = [
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#10b981', // emerald
  '#ec4899', // pink
  '#6366f1', // indigo
];

function formatDollar(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default function CostBreakdownChart({
  data,
  mode,
  onModeChange,
}: CostBreakdownChartProps) {
  const chartData =
    data?.groups.map((g) => ({
      name: g.key,
      cost: g.total_cost_usd,
      tokens: g.total_input_tokens + g.total_output_tokens,
      records: g.record_count,
    })) ?? [];

  const isEmpty = chartData.length === 0;

  return (
    <Card padding="none">
      <CardHeader className="px-5 pt-5">
        <CardTitle>Cost Breakdown</CardTitle>
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
          <button
            onClick={() => onModeChange('agent')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              mode === 'agent'
                ? 'bg-bg-primary text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-testid="mode-agent"
          >
            By Agent
          </button>
          <button
            onClick={() => onModeChange('model')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              mode === 'model'
                ? 'bg-bg-primary text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-testid="mode-model"
          >
            By Model
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {isEmpty ? (
          <div
            className="flex items-center justify-center h-64 text-text-tertiary"
            data-testid="chart-empty"
          >
            No cost data available
          </div>
        ) : mode === 'agent' ? (
          <div data-testid="chart-bar" className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  formatter={(value: number) => [formatDollar(value), 'Cost']}
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f3f4f6',
                  }}
                />
                <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div data-testid="chart-pie" className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="cost"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatDollar(value), 'Cost']}
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f3f4f6',
                  }}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-text-secondary text-sm">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
