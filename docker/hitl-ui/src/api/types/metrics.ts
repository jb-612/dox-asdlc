/**
 * TypeScript types for Metrics Dashboard (P05-F10)
 *
 * These types define the data structures for VictoriaMetrics integration
 * and the metrics dashboard UI components.
 */

// ============================================================================
// Time Range Types
// ============================================================================

/**
 * Available time range options for metrics queries
 */
export type TimeRange = '15m' | '1h' | '6h' | '24h' | '7d';

/**
 * Time range configuration with display labels
 */
export interface TimeRangeOption {
  value: TimeRange;
  label: string;
  /** Step interval for query resolution */
  step: string;
}

/**
 * Predefined time range options
 */
export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { value: '15m', label: '15m', step: '15s' },
  { value: '1h', label: '1h', step: '1m' },
  { value: '6h', label: '6h', step: '5m' },
  { value: '24h', label: '24h', step: '15m' },
  { value: '7d', label: '7d', step: '1h' },
];

// ============================================================================
// Metrics Data Types
// ============================================================================

/**
 * Single data point in a VictoriaMetrics time series
 */
export interface VMMetricsDataPoint {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Metric value */
  value: number;
}

/**
 * Time series data for a single metric from VictoriaMetrics
 */
export interface VMMetricsTimeSeries {
  /** Metric name (e.g., 'asdlc_process_memory_bytes') */
  metric: string;
  /** Service name the metric belongs to */
  service: string;
  /** Array of data points */
  dataPoints: VMMetricsDataPoint[];
}

/**
 * Latency metrics with percentile breakdown
 */
export interface LatencyMetrics {
  /** 50th percentile (median) latency */
  p50: VMMetricsTimeSeries;
  /** 95th percentile latency */
  p95: VMMetricsTimeSeries;
  /** 99th percentile latency */
  p99: VMMetricsTimeSeries;
}

/**
 * Active tasks/workers current state
 */
export interface ActiveTasksMetrics {
  /** Current number of active tasks */
  activeTasks: number;
  /** Maximum task capacity */
  maxTasks: number;
  /** Current number of active workers */
  activeWorkers: number;
  /** Last updated timestamp */
  lastUpdated: string;
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * Information about a monitored service
 */
export interface ServiceInfo {
  /** Internal service name (e.g., 'orchestrator') */
  name: string;
  /** Display-friendly name (e.g., 'Orchestrator') */
  displayName: string;
  /** Whether the service is currently healthy */
  healthy: boolean;
  /** Optional status message */
  statusMessage?: string;
}

/**
 * Service colors for chart visualization
 */
export const SERVICE_COLORS: Record<string, string> = {
  orchestrator: '#3b82f6',    // Blue
  'worker-pool': '#10b981',   // Green
  'hitl-ui': '#8b5cf6',       // Purple
  redis: '#ef4444',           // Red
  elasticsearch: '#f59e0b',   // Amber
  default: '#6b7280',         // Gray
};

// ============================================================================
// VictoriaMetrics API Response Types
// ============================================================================

/**
 * VictoriaMetrics query result for matrix (range) queries
 */
export interface VictoriaMetricsResult {
  /** Metric labels */
  metric: Record<string, string>;
  /** Array of [timestamp, value] pairs */
  values: [number, string][];
}

/**
 * VictoriaMetrics instant query result
 */
export interface VictoriaMetricsInstantResult {
  /** Metric labels */
  metric: Record<string, string>;
  /** Single [timestamp, value] pair */
  value: [number, string];
}

/**
 * VictoriaMetrics query_range API response
 */
export interface MetricsQueryResponse {
  /** Response status */
  status: 'success' | 'error';
  /** Query result data */
  data: {
    /** Result type (matrix for range queries, vector for instant) */
    resultType: 'matrix' | 'vector';
    /** Array of results */
    result: VictoriaMetricsResult[];
  };
  /** Error type if status is 'error' */
  errorType?: string;
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * VictoriaMetrics instant query API response
 */
export interface MetricsInstantResponse {
  /** Response status */
  status: 'success' | 'error';
  /** Query result data */
  data: {
    /** Result type */
    resultType: 'vector';
    /** Array of results */
    result: VictoriaMetricsInstantResult[];
  };
  /** Error type if status is 'error' */
  errorType?: string;
  /** Error message if status is 'error' */
  error?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request parameters for metrics range query
 */
export interface MetricsQueryParams {
  /** Service to filter by (null for all services) */
  service: string | null;
  /** Time range to query */
  timeRange: TimeRange;
}

/**
 * Response for services list API
 */
export interface ServicesResponse {
  /** List of available services */
  services: ServiceInfo[];
}

// ============================================================================
// Chart Configuration Types
// ============================================================================

/**
 * Chart color configuration
 */
export const CHART_COLORS = {
  cpu: '#3b82f6',         // Blue
  memory: '#8b5cf6',      // Purple
  requestRate: '#10b981', // Green
  p50: '#3b82f6',         // Blue
  p95: '#f59e0b',         // Amber
  p99: '#ef4444',         // Red
  grid: '#30363d',
  text: '#8b949e',
  tooltip: '#161b22',
} as const;

/**
 * Chart axis configuration
 */
export interface ChartAxisConfig {
  /** Y-axis domain [min, max] */
  domain: [number, number] | ['auto', 'auto'];
  /** Y-axis tick formatter */
  tickFormatter?: (value: number) => string;
  /** Y-axis label */
  label?: string;
}
