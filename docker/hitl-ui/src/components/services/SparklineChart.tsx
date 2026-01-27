/**
 * SparklineChart - SVG-based mini line chart for service metrics
 *
 * T12: Compact sparkline visualization for service health cards
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import clsx from 'clsx';
import type { SparklineDataPoint } from '../../api/types/services';

// ============================================================================
// Types
// ============================================================================

export interface SparklineThresholds {
  /** Warning threshold - values above this show yellow */
  warning: number;
  /** Critical threshold - values above this show red */
  critical: number;
}

export interface SparklineChartProps {
  /** Data points for the sparkline */
  data: SparklineDataPoint[];
  /** Line color (overrides threshold-based color) */
  color?: string;
  /** Chart width in pixels */
  width?: number;
  /** Chart height in pixels */
  height?: number;
  /** Thresholds for color coding based on values */
  thresholds?: SparklineThresholds;
  /** Loading state */
  isLoading?: boolean;
  /** Accessibility label */
  ariaLabel?: string;
  /** Custom class name for container */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 30;
const PADDING = 2;

// Colors matching the project's design system
const COLORS = {
  success: '#22C55E', // green-500
  warning: '#F59E0B', // amber-500
  error: '#EF4444',   // red-500
  default: '#3B82F6', // blue-500
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine color based on average value and thresholds
 */
function getColorFromThresholds(
  data: SparklineDataPoint[],
  thresholds: SparklineThresholds | undefined
): string {
  if (!thresholds || data.length === 0) {
    return COLORS.default;
  }

  // Use the average of recent values (last 3 or all if fewer)
  const recentData = data.slice(-3);
  const avgValue = recentData.reduce((sum, d) => sum + d.value, 0) / recentData.length;

  if (avgValue >= thresholds.critical) {
    return COLORS.error;
  }
  if (avgValue >= thresholds.warning) {
    return COLORS.warning;
  }
  return COLORS.success;
}

/**
 * Generate SVG path string for the sparkline
 */
function generatePath(
  data: SparklineDataPoint[],
  width: number,
  height: number
): string {
  if (data.length < 2) return '';

  const paddedWidth = width - PADDING * 2;
  const paddedHeight = height - PADDING * 2;

  // Find min/max values for scaling
  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1; // Avoid division by zero

  // Generate path points
  const points = data.map((point, index) => {
    const x = PADDING + (index / (data.length - 1)) * paddedWidth;
    const y = PADDING + paddedHeight - ((point.value - minValue) / valueRange) * paddedHeight;
    return { x, y };
  });

  // Create smooth curve path using quadratic bezier curves
  let pathString = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;

    if (i === 1) {
      pathString += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
    } else {
      pathString += ` T ${midX} ${midY}`;
    }
  }

  // Add final point
  const lastPoint = points[points.length - 1];
  pathString += ` L ${lastPoint.x} ${lastPoint.y}`;

  return pathString;
}

/**
 * Format timestamp for tooltip display
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format value for tooltip display
 */
function formatValue(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(1);
}

// ============================================================================
// Component
// ============================================================================

export default function SparklineChart({
  data,
  color,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  thresholds,
  isLoading = false,
  ariaLabel = 'Sparkline chart',
  className,
}: SparklineChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<SparklineDataPoint | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Determine line color
  const lineColor = useMemo(() => {
    if (color) return color;
    return getColorFromThresholds(data, thresholds);
  }, [color, data, thresholds]);

  // Generate path string
  const pathString = useMemo(() => {
    return generatePath(data, width, height);
  }, [data, width, height]);

  // Handle mouse move for tooltip
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (data.length === 0 || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const relativeX = Math.max(0, Math.min(1, x / width));
      const index = Math.round(relativeX * (data.length - 1));
      const point = data[index];

      if (point) {
        setHoveredPoint(point);
        setTooltipPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      }
    },
    [data, width]
  );

  const handleMouseEnter = useCallback(() => {
    if (data.length > 0) {
      // Show tooltip for the last point by default
      setHoveredPoint(data[data.length - 1]);
      setTooltipPosition({ x: width / 2, y: height / 2 });
    }
  }, [data, width, height]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
    setTooltipPosition(null);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx('relative', className)}
        data-testid="sparkline-container"
      >
        <div
          className="animate-pulse bg-bg-tertiary rounded"
          style={{ width, height }}
          data-testid="sparkline-loading"
        />
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div
        className={clsx('relative', className)}
        data-testid="sparkline-container"
      >
        <svg
          ref={svgRef}
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          data-testid="sparkline-chart"
        >
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-text-muted text-xs"
            data-testid="sparkline-empty"
          >
            No data
          </text>
        </svg>
      </div>
    );
  }

  // Single point state
  if (data.length === 1) {
    const paddedHeight = height - PADDING * 2;
    const y = PADDING + paddedHeight / 2;

    return (
      <div
        className={clsx('relative', className)}
        data-testid="sparkline-container"
      >
        <svg
          ref={svgRef}
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          data-testid="sparkline-chart"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
        >
          <circle
            cx={width / 2}
            cy={y}
            r={4}
            fill={lineColor}
            stroke={lineColor}
            strokeWidth={2}
            data-testid="sparkline-single-point"
          />
        </svg>
        {hoveredPoint && tooltipPosition && (
          <div
            className="absolute z-10 px-2 py-1 text-xs bg-bg-primary border border-border-primary rounded shadow-lg pointer-events-none whitespace-nowrap"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y - 30,
              transform: 'translateX(-50%)',
            }}
            data-testid="sparkline-tooltip"
          >
            <div>{formatTimestamp(hoveredPoint.timestamp)}</div>
            <div className="font-semibold">{formatValue(hoveredPoint.value)}</div>
          </div>
        )}
      </div>
    );
  }

  // Normal rendering with path
  return (
    <div
      className={clsx('relative', className)}
      data-testid="sparkline-container"
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        data-testid="sparkline-chart"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <path
          d={pathString}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          data-testid="sparkline-path"
        />
      </svg>
      {hoveredPoint && tooltipPosition && (
        <div
          className="absolute z-10 px-2 py-1 text-xs bg-bg-primary border border-border-primary rounded shadow-lg pointer-events-none whitespace-nowrap"
          style={{
            left: Math.min(tooltipPosition.x, width - 40),
            top: -30,
            transform: 'translateX(-50%)',
          }}
          data-testid="sparkline-tooltip"
        >
          <div>{formatTimestamp(hoveredPoint.timestamp)}</div>
          <div className="font-semibold">{formatValue(hoveredPoint.value)}</div>
        </div>
      )}
    </div>
  );
}
