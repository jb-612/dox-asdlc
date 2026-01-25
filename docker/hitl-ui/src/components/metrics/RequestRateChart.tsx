/**
 * RequestRateChart - Area chart for request rate (req/s)
 *
 * Features:
 * - Recharts AreaChart with gradient fill
 * - Y-axis with automatic scale
 * - Custom tooltip with timestamp and rate
 * - Loading skeleton and empty states
 */

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import clsx from 'clsx';
import { CHART_COLORS, type VMMetricsTimeSeries } from '../../api/types/metrics';
import { formatRequestRate } from '../../api/metrics';

export interface RequestRateChartProps {
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
      data-testid="request-rate-chart-tooltip"
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
          style={{ backgroundColor: CHART_COLORS.requestRate }}
        />
        <span className="text-[#c9d1d9]">
          Rate: {formatRequestRate(data.value)}
        </span>
      </div>
    </div>
  );
}

export default function RequestRateChart({
  data,
  isLoading = false,
  height = 200,
  className,
}: RequestRateChartProps) {
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
        data-testid="request-rate-chart-loading"
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
        data-testid="request-rate-chart-empty"
      >
        <p>No request rate data available</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ height }} data-testid="request-rate-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id="requestRateGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={CHART_COLORS.requestRate}
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor={CHART_COLORS.requestRate}
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>
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
            tickFormatter={(value) => formatRequestRate(value)}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            name="Request Rate"
            stroke={CHART_COLORS.requestRate}
            strokeWidth={2}
            fill="url(#requestRateGradient)"
            activeDot={{ r: 4, fill: CHART_COLORS.requestRate }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
