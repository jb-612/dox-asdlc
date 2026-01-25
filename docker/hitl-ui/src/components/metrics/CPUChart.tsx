/**
 * CPUChart - Line chart for CPU usage percentage
 *
 * Note: CPU metrics may come from container/cAdvisor metrics
 * rather than application metrics in production environments.
 *
 * Features:
 * - Recharts LineChart with responsive container
 * - Y-axis 0-100% scale
 * - Custom tooltip with timestamp and percentage
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
  ResponsiveContainer,
} from 'recharts';
import clsx from 'clsx';
import { CHART_COLORS, type VMMetricsTimeSeries } from '../../api/types/metrics';

export interface CPUChartProps {
  /** Metrics data */
  data?: VMMetricsTimeSeries;
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
    value: number;
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
      data-testid="cpu-chart-tooltip"
    >
      <p className="text-xs text-[#8b949e] mb-1">
        {date.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <div className="flex items-center gap-2 text-sm">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: CHART_COLORS.cpu }}
        />
        <span className="text-[#c9d1d9]">CPU: {data.value.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function CPUChart({
  data,
  isLoading = false,
  height = 200,
  className,
}: CPUChartProps) {
  // Transform data for Recharts
  const chartData = useMemo(() => {
    if (!data?.dataPoints) return [];

    return data.dataPoints.map((point) => ({
      time: formatTime(point.timestamp),
      timestamp: point.timestamp,
      value: point.value,
    }));
  }, [data]);

  // Loading state
  if (isLoading && !data) {
    return (
      <div
        className={clsx('animate-pulse', className)}
        style={{ height }}
        data-testid="cpu-chart-loading"
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
        data-testid="cpu-chart-empty"
      >
        <p>No CPU data available</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ height }} data-testid="cpu-chart">
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
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            name="CPU"
            stroke={CHART_COLORS.cpu}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.cpu }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
