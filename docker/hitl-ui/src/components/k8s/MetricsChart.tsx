/**
 * MetricsChart - CPU/Memory trend chart for K8s Dashboard
 *
 * Features:
 * - Line/Area chart using Recharts
 * - CPU line (blue) and Memory line (purple)
 * - Hover tooltip with exact values
 * - Time range selector (1h, 6h, 24h, 7d)
 * - Legend with current values
 * - Responsive sizing
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
  Area,
  AreaChart,
} from 'recharts';
import clsx from 'clsx';
import type { MetricsTimeSeries, MetricsDataPoint, MetricsInterval } from '../../api/types/kubernetes';
import { useK8sStore } from '../../stores/k8sStore';

export interface MetricsChartProps {
  /** Metrics data */
  data?: MetricsTimeSeries;
  /** Loading state */
  isLoading?: boolean;
  /** Chart type: cpu, memory, or both */
  type?: 'cpu' | 'memory' | 'both';
  /** Chart height in pixels */
  height?: number;
  /** Show legend */
  showLegend?: boolean;
  /** Show interval selector */
  showIntervalSelector?: boolean;
  /** Sparkline mode (minimal, no axis/legend) */
  sparkline?: boolean;
  /** Custom class name */
  className?: string;
}

// Chart colors
const COLORS = {
  cpu: '#3b82f6',    // Blue
  memory: '#8b5cf6', // Purple
  grid: '#30363d',
  text: '#8b949e',
  tooltip: '#161b22',
};

// Interval options
const intervalOptions: { value: MetricsInterval; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
];


// Format timestamp for display
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Custom tooltip component
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 shadow-lg"
      data-testid="chart-tooltip"
    >
      <p className="text-xs text-[#8b949e] mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[#c9d1d9]">
            {entry.name}: {entry.value.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MetricsChart({
  data,
  isLoading = false,
  type = 'both',
  height = 300,
  showLegend = true,
  showIntervalSelector = true,
  sparkline = false,
  className,
}: MetricsChartProps) {
  const { metricsInterval, setMetricsInterval } = useK8sStore();

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!data?.dataPoints) return [];

    return data.dataPoints.map((point: MetricsDataPoint) => ({
      time: formatTime(point.timestamp),
      timestamp: point.timestamp,
      cpu: point.cpuPercent,
      memory: point.memoryPercent,
    }));
  }, [data]);

  // Current values (latest data point)
  const currentValues = useMemo(() => {
    if (!chartData.length) return { cpu: 0, memory: 0 };
    const latest = chartData[chartData.length - 1];
    return {
      cpu: latest.cpu,
      memory: latest.memory,
    };
  }, [chartData]);

  // Loading state
  if (isLoading && !data) {
    return (
      <div
        className={clsx('animate-pulse', className)}
        style={{ height }}
        data-testid="metrics-chart-loading"
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
        data-testid="metrics-chart-empty"
      >
        <p>No metrics data available</p>
      </div>
    );
  }

  // Sparkline mode (minimal chart)
  if (sparkline) {
    return (
      <div className={className} style={{ height }} data-testid="metrics-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            {(type === 'cpu' || type === 'both') && (
              <Area
                type="monotone"
                dataKey="cpu"
                stroke={COLORS.cpu}
                fill={COLORS.cpu}
                fillOpacity={0.2}
                strokeWidth={1.5}
              />
            )}
            {(type === 'memory' || type === 'both') && (
              <Area
                type="monotone"
                dataKey="memory"
                stroke={COLORS.memory}
                fill={COLORS.memory}
                fillOpacity={0.2}
                strokeWidth={1.5}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className={className} data-testid="metrics-chart">
      {/* Controls */}
      {showIntervalSelector && (
        <div className="flex items-center justify-between mb-4">
          {/* Current values */}
          <div className="flex items-center gap-4 text-sm">
            {(type === 'cpu' || type === 'both') && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.cpu }} />
                <span className="text-text-muted">CPU:</span>
                <span className="font-medium text-text-primary" data-testid="current-cpu">
                  {currentValues.cpu.toFixed(1)}%
                </span>
              </div>
            )}
            {(type === 'memory' || type === 'both') && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.memory }} />
                <span className="text-text-muted">Memory:</span>
                <span className="font-medium text-text-primary" data-testid="current-memory">
                  {currentValues.memory.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Interval selector */}
          <div className="flex items-center gap-1" data-testid="interval-selector">
            {intervalOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setMetricsInterval(option.value)}
                className={clsx(
                  'px-2 py-1 rounded text-xs font-medium transition-colors',
                  metricsInterval === option.value
                    ? 'bg-accent-blue text-white'
                    : 'bg-bg-tertiary text-text-muted hover:bg-bg-tertiary/80'
                )}
                data-testid={`interval-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={{ height: showIntervalSelector ? height - 50 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={COLORS.grid}
              vertical={false}
            />
            <XAxis
              dataKey="time"
              stroke={COLORS.text}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke={COLORS.text}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && (
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-text-secondary text-sm">{value}</span>
                )}
              />
            )}
            {(type === 'cpu' || type === 'both') && (
              <Line
                type="monotone"
                dataKey="cpu"
                name="CPU"
                stroke={COLORS.cpu}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: COLORS.cpu }}
              />
            )}
            {(type === 'memory' || type === 'both') && (
              <Line
                type="monotone"
                dataKey="memory"
                name="Memory"
                stroke={COLORS.memory}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: COLORS.memory }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
