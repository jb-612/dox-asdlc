/**
 * Mock data generators for Metrics Dashboard (P05-F10)
 *
 * Provides realistic mock data for development without backend.
 * Enable with VITE_USE_MOCKS=true
 */

import type {
  TimeRange,
  VMMetricsTimeSeries,
  VMMetricsDataPoint,
  LatencyMetrics,
  ActiveTasksMetrics,
  ServiceInfo,
} from '../types/metrics';

// ============================================================================
// Services Mock Data
// ============================================================================

/**
 * Mock services available for monitoring
 */
export const mockServices: ServiceInfo[] = [
  {
    name: 'orchestrator',
    displayName: 'Orchestrator',
    healthy: true,
    statusMessage: 'Running normally',
  },
  {
    name: 'worker-pool',
    displayName: 'Worker Pool',
    healthy: true,
    statusMessage: 'All workers active',
  },
  {
    name: 'hitl-ui',
    displayName: 'HITL UI',
    healthy: true,
    statusMessage: 'Serving requests',
  },
  {
    name: 'redis',
    displayName: 'Redis',
    healthy: true,
    statusMessage: 'Connected',
  },
  {
    name: 'elasticsearch',
    displayName: 'Elasticsearch',
    healthy: false,
    statusMessage: 'High memory pressure',
  },
];

// ============================================================================
// Time Series Generation Utilities
// ============================================================================

/**
 * Get the number of data points and interval for a time range
 */
function getTimeRangeConfig(range: TimeRange): { points: number; intervalMs: number } {
  switch (range) {
    case '15m':
      return { points: 60, intervalMs: 15 * 1000 };      // 60 points, 15s intervals
    case '1h':
      return { points: 60, intervalMs: 60 * 1000 };      // 60 points, 1m intervals
    case '6h':
      return { points: 72, intervalMs: 5 * 60 * 1000 };  // 72 points, 5m intervals
    case '24h':
      return { points: 96, intervalMs: 15 * 60 * 1000 }; // 96 points, 15m intervals
    case '7d':
      return { points: 168, intervalMs: 60 * 60 * 1000 };// 168 points, 1h intervals
    default:
      return { points: 60, intervalMs: 60 * 1000 };
  }
}

/**
 * Generate a time series with sinusoidal patterns and random noise
 */
export function generateMetricsTimeSeries(
  metric: string,
  service: string,
  range: TimeRange,
  options: {
    baseValue: number;
    amplitude: number;
    noiseLevel: number;
    minValue?: number;
    maxValue?: number;
    period?: number;
  }
): VMMetricsTimeSeries {
  const { points, intervalMs } = getTimeRangeConfig(range);
  const now = Date.now();
  const dataPoints: VMMetricsDataPoint[] = [];

  const {
    baseValue,
    amplitude,
    noiseLevel,
    minValue = 0,
    maxValue = Infinity,
    period = points / 4,
  } = options;

  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now - i * intervalMs).toISOString();

    // Generate value with sinusoidal pattern
    const sineComponent = Math.sin((2 * Math.PI * (points - i)) / period) * amplitude;
    const noise = (Math.random() - 0.5) * 2 * noiseLevel;
    let value = baseValue + sineComponent + noise;

    // Clamp to min/max bounds
    value = Math.max(minValue, Math.min(maxValue, value));

    dataPoints.push({ timestamp, value });
  }

  return { metric, service, dataPoints };
}

// ============================================================================
// Metric-Specific Mock Generators
// ============================================================================

/**
 * Generate mock CPU metrics (percentage 0-100)
 * Note: CPU metrics may come from container metrics rather than app metrics
 */
export function getMockCPUMetrics(
  service: string | null,
  range: TimeRange
): VMMetricsTimeSeries {
  // If no service specified, aggregate across all services
  const targetService = service || 'cluster';

  // Different base values for different services
  const baseValues: Record<string, number> = {
    orchestrator: 35,
    'worker-pool': 55,
    'hitl-ui': 20,
    redis: 15,
    elasticsearch: 45,
    cluster: 40,
  };

  const baseValue = baseValues[targetService] || 40;

  return generateMetricsTimeSeries('cpu_usage_percent', targetService, range, {
    baseValue,
    amplitude: 15,
    noiseLevel: 5,
    minValue: 5,
    maxValue: 95,
    period: 20,
  });
}

/**
 * Generate mock memory metrics (percentage 0-100)
 */
export function getMockMemoryMetrics(
  service: string | null,
  range: TimeRange
): VMMetricsTimeSeries {
  const targetService = service || 'cluster';

  // Different base values for different services
  const baseValues: Record<string, number> = {
    orchestrator: 45,
    'worker-pool': 65,
    'hitl-ui': 30,
    redis: 55,
    elasticsearch: 75,
    cluster: 55,
  };

  const baseValue = baseValues[targetService] || 55;

  return generateMetricsTimeSeries('memory_usage_percent', targetService, range, {
    baseValue,
    amplitude: 10,
    noiseLevel: 3,
    minValue: 20,
    maxValue: 90,
    period: 15,
  });
}

/**
 * Generate mock request rate metrics (requests per second)
 */
export function getMockRequestRateMetrics(
  service: string | null,
  range: TimeRange
): VMMetricsTimeSeries {
  const targetService = service || 'cluster';

  // Different base values for different services
  const baseValues: Record<string, number> = {
    orchestrator: 150,
    'worker-pool': 80,
    'hitl-ui': 45,
    redis: 500,
    elasticsearch: 120,
    cluster: 250,
  };

  const baseValue = baseValues[targetService] || 100;

  return generateMetricsTimeSeries('request_rate', targetService, range, {
    baseValue,
    amplitude: baseValue * 0.3,
    noiseLevel: baseValue * 0.1,
    minValue: 0,
    period: 25,
  });
}

/**
 * Generate mock latency metrics with p50, p95, p99 percentiles
 */
export function getMockLatencyMetrics(
  service: string | null,
  range: TimeRange
): LatencyMetrics {
  const targetService = service || 'cluster';

  // Base latencies in milliseconds
  const baseLatencies: Record<string, { p50: number; p95: number; p99: number }> = {
    orchestrator: { p50: 25, p95: 80, p99: 150 },
    'worker-pool': { p50: 100, p95: 300, p99: 500 },
    'hitl-ui': { p50: 15, p95: 45, p99: 100 },
    redis: { p50: 2, p95: 8, p99: 15 },
    elasticsearch: { p50: 35, p95: 120, p99: 250 },
    cluster: { p50: 30, p95: 100, p99: 200 },
  };

  const base = baseLatencies[targetService] || { p50: 30, p95: 100, p99: 200 };

  const p50 = generateMetricsTimeSeries('latency_p50', targetService, range, {
    baseValue: base.p50,
    amplitude: base.p50 * 0.2,
    noiseLevel: base.p50 * 0.1,
    minValue: 1,
    period: 18,
  });

  const p95 = generateMetricsTimeSeries('latency_p95', targetService, range, {
    baseValue: base.p95,
    amplitude: base.p95 * 0.25,
    noiseLevel: base.p95 * 0.1,
    minValue: base.p50,
    period: 22,
  });

  const p99 = generateMetricsTimeSeries('latency_p99', targetService, range, {
    baseValue: base.p99,
    amplitude: base.p99 * 0.3,
    noiseLevel: base.p99 * 0.15,
    minValue: base.p95,
    period: 28,
  });

  return { p50, p95, p99 };
}

/**
 * Generate mock active tasks metrics
 */
export function getMockActiveTasks(): ActiveTasksMetrics {
  return {
    activeTasks: Math.floor(Math.random() * 20) + 5,
    maxTasks: 50,
    activeWorkers: Math.floor(Math.random() * 5) + 3,
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================================================
// Aggregated Mock Functions
// ============================================================================

/**
 * Get all services (for ServiceSelector dropdown)
 */
export function getMockServices(): ServiceInfo[] {
  return mockServices;
}

/**
 * Simulate API delay for realistic mock behavior
 */
export async function simulateDelay(minMs = 100, maxMs = 300): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
