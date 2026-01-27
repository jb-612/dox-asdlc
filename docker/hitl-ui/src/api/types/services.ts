/**
 * TypeScript types for Service Health Dashboard (P06-F07)
 *
 * These types define the data structures for monitoring aSDLC service health,
 * including health status, sparkline data, and service topology connections.
 */

// ============================================================================
// Service Health Status Types
// ============================================================================

/**
 * Service health status indicator
 * - healthy: All metrics within normal thresholds
 * - degraded: Some metrics approaching or exceeding warning thresholds
 * - unhealthy: Critical metrics exceeded, service may be failing
 */
export type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

// ============================================================================
// Service Health Information
// ============================================================================

/**
 * Health information for a single service
 */
export interface ServiceHealthInfo {
  /** Service identifier (e.g., "hitl-ui", "orchestrator") */
  name: string;
  /** Current health status */
  status: ServiceHealthStatus;
  /** CPU usage percentage (0-100) */
  cpuPercent: number;
  /** Memory usage percentage (0-100) */
  memoryPercent: number;
  /** Number of running pods/instances */
  podCount: number;
  /** Request rate in requests per second (optional for non-HTTP services) */
  requestRate?: number;
  /** 50th percentile latency in milliseconds (optional for non-HTTP services) */
  latencyP50?: number;
  /** ISO timestamp of last restart (optional, shown if within 24 hours) */
  lastRestart?: string;
}

// ============================================================================
// Service Topology Types
// ============================================================================

/**
 * Connection type between services
 * - http: REST/HTTP communication
 * - redis: Redis pub/sub or data access
 * - elasticsearch: Elasticsearch queries
 */
export type ServiceConnectionType = 'http' | 'redis' | 'elasticsearch';

/**
 * Connection between two services in the topology map
 */
export interface ServiceConnection {
  /** Source service name */
  from: string;
  /** Target service name */
  to: string;
  /** Type of connection */
  type: ServiceConnectionType;
}

// ============================================================================
// Sparkline Data Types
// ============================================================================

/**
 * Single data point for sparkline charts
 */
export interface SparklineDataPoint {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Metric value at this timestamp */
  value: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from GET /api/metrics/services/health
 * Contains health status for all monitored services and their connections
 */
export interface ServicesHealthResponse {
  /** Array of service health information */
  services: ServiceHealthInfo[];
  /** Array of connections between services for topology map */
  connections: ServiceConnection[];
  /** ISO timestamp when this data was collected */
  timestamp: string;
}

/**
 * Response from GET /api/metrics/services/{name}/sparkline
 * Contains time series data for a specific metric on a service
 */
export interface ServiceSparklineResponse {
  /** Service name */
  service: string;
  /** Metric name (e.g., "cpu", "memory") */
  metric: string;
  /** Array of data points for the sparkline chart */
  dataPoints: SparklineDataPoint[];
  /** Query interval (e.g., "15s", "1m") */
  interval: string;
  /** Time duration covered (e.g., "15m", "1h") */
  duration: string;
}
