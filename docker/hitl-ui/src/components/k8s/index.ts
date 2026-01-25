/**
 * Kubernetes Dashboard Components
 *
 * Public exports for the K8s visibility dashboard feature.
 */

// Core dashboard components
export { default as ClusterOverview } from './ClusterOverview';
export type { ClusterOverviewProps } from './ClusterOverview';

export { default as NodesPanel } from './NodesPanel';
export type { NodesPanelProps } from './NodesPanel';

export { default as PodsTable } from './PodsTable';
export type { PodsTableProps } from './PodsTable';

export { default as CommandTerminal } from './CommandTerminal';
export type { CommandTerminalProps } from './CommandTerminal';

export { default as HealthCheckPanel } from './HealthCheckPanel';
export type { HealthCheckPanelProps } from './HealthCheckPanel';

export { default as MetricsChart } from './MetricsChart';
export type { MetricsChartProps } from './MetricsChart';

export { default as PodDetailDrawer } from './PodDetailDrawer';
export type { PodDetailDrawerProps, PodEvent } from './PodDetailDrawer';

export { default as NetworkingPanel } from './NetworkingPanel';
export type { NetworkingPanelProps } from './NetworkingPanel';

export { default as ResourceHierarchy } from './ResourceHierarchy';
export type { ResourceHierarchyProps } from './ResourceHierarchy';

export { default as K8sDashboard } from './K8sDashboard';
export type { K8sDashboardProps } from './K8sDashboard';
