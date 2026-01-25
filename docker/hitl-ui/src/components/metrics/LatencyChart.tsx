/**
 * LatencyChart - Multi-line chart for latency percentiles
 *
 * Features:
 * - Three lines: p50 (blue), p95 (amber), p99 (red)
 * - Y-axis shows latency in ms with automatic scale
 * - Legend shows all three percentiles
 * - Custom tooltip shows all three values at hover point
 * - Loading skeleton and empty states
 */

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import clsx from 'clsx';
import { CHART_COLORS, type LatencyMetrics } from '../../api/types/metrics';
import { formatLatency } from '../../api/metrics';

export interface LatencyChartProps {
  /** Latency metrics data with p50, p95, p99 */
  data?: LatencyMetrics;
  /** Loading state */
  isLoading?: boolean;
  /** Chart height in pixels */
  height?: number;
  /** Custom class name */
  className?: string;
}

/**
 * Format timestamp for display on X-axis
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Custom tooltip component
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: { timestamp: string };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  const date = new Date(data.payload.timestamp);

  return (
    <div
      className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 shadow-lg"
      data-testid="latency-chart-tooltip"
    >
      <p className="text-xs text-[#8b949e] mb-2">
        {date.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[#c9d1d9]">
            {entry.name}: {formatLatency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Custom legend formatter
 */
function formatLegendValue(value: string): React.ReactNode {
  return <span className="text-text-secondary text-sm">{value}</span>;
}

export default function LatencyChart({
  data,
  isLoading = false,
  height = 200,
  className,
}: LatencyChartProps) {
  // Merge p50, p95, p99 data into unified chart data
  const chartData = useMemo(() => {
    if (!data?.p50?.dataPoints) return [];

    return data.p50.dataPoints.map((point, index) => ({
      time: formatTime(point.timestamp),
      timestamp: point.timestamp,
      p50: point.value,
      p95: data.p95?.dataPoints[index]?.value ?? 0,
      p99: data.p99?.dataPoints[index]?.value ?? 0,
    }));
  }, [data]);

  // Loading state
  if (isLoading && !data) {
    return (
      <div
        className={clsx('animate-pulse', className)}
        style={{ height }}
        data-testid="latency-chart-loading"
      >
        <div className="h-full bg-bg-tertiary rounded-lg" />
      </div>
    );
  }

  // Empty state
  if (!data || chartData.length === 0) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center text-text-muted bg-bg-tertiary/30 rounded-lg',
          className
        )}
        style={{ height }}
        data-testid="latency-chart-empty"
      >
        <p>No latency data available</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ height }} data-testid="latency-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.grid}
            vertical={false}
          />
          <XAxis
            dataKey="time"
            stroke={CHART_COLORS.text}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke={CHART_COLORS.text}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
            tickFormatter={(value) => `${value.toFixed(0)}ms`}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={formatLegendValue}
          />
          <Line
            type="monotone"
            dataKey="p50"
            name="p50"
            stroke={CHART_COLORS.p50}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.p50 }}
          />
          <Line
            type="monotone"
            dataKey="p95"
            name="p95"
            stroke={CHART_COLORS.p95}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.p95 }}
          />
          <Line
            type="monotone"
            dataKey="p99"
            name="p99"
            stroke={CHART_COLORS.p99}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.p99 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
