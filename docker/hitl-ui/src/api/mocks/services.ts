/**
 * Mock data for Service Health Dashboard (P06-F07)
 *
 * Provides mock service health data, sparkline data, and topology connections.
 */

import type {
  ServiceHealthInfo,
  ServiceConnection,
  SparklineDataPoint,
  ServicesHealthResponse,
  ServiceSparklineResponse,
} from '../types/services';

// ============================================================================
// Mock Services Health Data
// ============================================================================

/**
 * Generate mock sparkline data points
 */
function generateSparklineData(
  baseValue: number,
  variance: number,
  pointCount: number = 30,
  intervalMs: number = 30000
): SparklineDataPoint[] {
  const now = Date.now();
  const points: SparklineDataPoint[] = [];

  for (let i = 0; i < pointCount; i++) {
    const timestamp = now - (pointCount - 1 - i) * intervalMs;
    // Add some random variation
    const noise = (Math.random() - 0.5) * 2 * variance;
    const value = Math.max(0, Math.min(100, baseValue + noise + Math.sin(i / 5) * variance * 0.5));
    points.push({ timestamp, value: Math.round(value * 10) / 10 });
  }

  return points;
}

/**
 * Mock health info for all 5 aSDLC services
 */
export const mockServiceHealthData: ServiceHealthInfo[] = [
  {
    name: 'hitl-ui',
    status: 'healthy',
    cpuPercent: 25,
    memoryPercent: 45,
    podCount: 1,
    requestRate: 50.5,
    latencyP50: 12,
    lastRestart: undefined,
  },
  {
    name: 'orchestrator',
    status: 'healthy',
    cpuPercent: 42,
    memoryPercent: 58,
    podCount: 2,
    requestRate: 145.2,
    latencyP50: 28,
    lastRestart: undefined,
  },
  {
    name: 'workers',
    status: 'degraded',
    cpuPercent: 72,
    memoryPercent: 68,
    podCount: 3,
    requestRate: 285.7,
    latencyP50: 95,
    lastRestart: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  },
  {
    name: 'redis',
    status: 'healthy',
    cpuPercent: 15,
    memoryPercent: 52,
    podCount: 1,
    requestRate: undefined, // Redis doesn't have HTTP request rate
    latencyP50: undefined,
    lastRestart: undefined,
  },
  {
    name: 'elasticsearch',
    status: 'healthy',
    cpuPercent: 55,
    memoryPercent: 72,
    podCount: 1,
    requestRate: undefined, // ES queries not tracked as HTTP
    latencyP50: undefined,
    lastRestart: undefined,
  },
];

/**
 * Mock service connections for topology map
 */
export const mockServiceConnections: ServiceConnection[] = [
  { from: 'hitl-ui', to: 'orchestrator', type: 'http' },
  { from: 'orchestrator', to: 'workers', type: 'http' },
  { from: 'orchestrator', to: 'redis', type: 'redis' },
  { from: 'workers', to: 'redis', type: 'redis' },
  { from: 'workers', to: 'elasticsearch', type: 'elasticsearch' },
  { from: 'orchestrator', to: 'elasticsearch', type: 'elasticsearch' },
];

/**
 * Mock sparkline data for each service
 */
export const mockSparklineData: Record<string, Record<string, SparklineDataPoint[]>> = {
  'hitl-ui': {
    cpu: generateSparklineData(25, 8),
    memory: generateSparklineData(45, 5),
  },
  'orchestrator': {
    cpu: generateSparklineData(42, 12),
    memory: generateSparklineData(58, 8),
  },
  'workers': {
    cpu: generateSparklineData(72, 15),
    memory: generateSparklineData(68, 10),
  },
  'redis': {
    cpu: generateSparklineData(15, 5),
    memory: generateSparklineData(52, 8),
  },
  'elasticsearch': {
    cpu: generateSparklineData(55, 10),
    memory: generateSparklineData(72, 7),
  },
};

// ============================================================================
// Mock API Functions
// ============================================================================

/**
 * Get mock services health response
 */
export function getMockServicesHealth(): ServicesHealthResponse {
  return {
    services: mockServiceHealthData,
    connections: mockServiceConnections,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get mock sparkline data for a service and metric
 */
export function getMockServiceSparkline(
  serviceName: string,
  metric: string
): ServiceSparklineResponse {
  const serviceData = mockSparklineData[serviceName];
  const dataPoints = serviceData?.[metric] || generateSparklineData(50, 15);

  return {
    service: serviceName,
    metric,
    dataPoints,
    interval: '30s',
    duration: '15m',
  };
}

/**
 * Simulate API delay
 */
export async function simulateDelay(minMs: number = 50, maxMs: number = 150): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
