/**
 * CockpitPage - Agent Cockpit for monitoring and workflow visualization
 *
 * Displays:
 * - KPI Header with 5 key metrics
 * - Worker Utilization Panel
 * - Workflow Graph View
 * - Runs Table
 * - Git Integration Panel
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import KPIHeader, { KPI } from '../components/cockpit/KPIHeader';
import WorkerUtilizationPanel, { Worker } from '../components/cockpit/WorkerUtilizationPanel';
import WorkflowGraphView, { WorkflowNode, WorkflowEdge, NodeType } from '../components/cockpit/WorkflowGraphView';
import RunsTable, { Run } from '../components/cockpit/RunsTable';
import GitIntegrationPanel, { EnvironmentGitState } from '../components/cockpit/GitIntegrationPanel';

export interface CockpitPageProps {
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** KPI data */
  kpis?: KPI[];
  /** Workers data */
  workers?: Worker[];
  /** Runs data */
  runs?: Run[];
  /** Workflow nodes */
  workflowNodes?: WorkflowNode[];
  /** Workflow edges */
  workflowEdges?: WorkflowEdge[];
  /** Refresh callback */
  onRefresh?: () => void;
  /** Auto-refresh enabled */
  autoRefresh?: boolean;
  /** Auto-refresh change callback */
  onAutoRefreshChange?: () => void;
  /** Last updated timestamp */
  lastUpdated?: string;
  /** Run click callback */
  onRunClick?: (runId: string) => void;
  /** Worker click callback */
  onWorkerClick?: (workerId: string) => void;
  /** Node click callback */
  onNodeClick?: (nodeId: string, type: NodeType) => void;
  /** Git environments */
  environments?: EnvironmentGitState[];
  /** Custom class name */
  className?: string;
}

// Default mock data
const defaultKPIs: KPI[] = [
  { id: 'active-runs', label: 'Active Runs', value: 3 },
  { id: 'success-rate', label: 'Success Rate', value: 92, unit: '%' },
  { id: 'avg-duration', label: 'Avg Duration', value: 8, unit: 'm' },
  { id: 'workers-busy', label: 'Workers Busy', value: 2 },
  { id: 'queue-depth', label: 'Queue Depth', value: 1 },
];

const defaultWorkers: Worker[] = [
  { id: 'w1', name: 'Worker 1', status: 'running', model: 'claude-3-opus', utilization: 75 },
  { id: 'w2', name: 'Worker 2', status: 'idle', model: 'claude-3-sonnet', utilization: 0 },
];

const defaultRuns: Run[] = [
  {
    id: 'r1',
    runId: 'RUN-001',
    cluster: 'Discovery',
    agent: 'PRD Agent',
    status: 'completed',
    model: 'claude-3-opus',
    startedAt: '2026-01-23T10:00:00Z',
    epicId: 'EPIC-101',
    repoId: 'repo-main',
    environment: 'production',
  },
];

const defaultNodes: WorkflowNode[] = [
  { id: 'discovery', label: 'Discovery', type: 'cluster', status: 'active', runsCount: 10 },
  { id: 'design', label: 'Design', type: 'cluster', status: 'idle', runsCount: 7 },
];

const defaultEdges: WorkflowEdge[] = [
  { id: 'e1', source: 'discovery', target: 'design', flowCount: 7 },
];

const defaultEnvironments: EnvironmentGitState[] = [
  {
    id: 'prod',
    name: 'Production',
    branch: 'main',
    sha: 'abc123def456',
    pendingCommits: 0,
    recentCommits: [],
    status: 'synced',
    lastSyncAt: '2026-01-23T10:00:00Z',
  },
];

export default function CockpitPage({
  isLoading = false,
  error,
  onRetry,
  kpis = defaultKPIs,
  workers = defaultWorkers,
  runs = defaultRuns,
  workflowNodes = defaultNodes,
  workflowEdges = defaultEdges,
  onRefresh,
  autoRefresh = false,
  onAutoRefreshChange,
  lastUpdated,
  onRunClick,
  onWorkerClick,
  onNodeClick,
  environments = defaultEnvironments,
  className,
}: CockpitPageProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('h-full flex flex-col bg-bg-primary', className)} data-testid="cockpit-page">
        <div className="flex-1 flex items-center justify-center" data-testid="cockpit-loading">
          <div className="space-y-4 w-full max-w-6xl px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-lg bg-bg-secondary animate-pulse"
                data-testid="panel-skeleton"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={clsx('h-full flex flex-col bg-bg-primary', className)} data-testid="cockpit-page">
        <div className="flex-1 flex items-center justify-center" data-testid="cockpit-error">
          <div className="text-center">
            <p className="text-status-error mb-4">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90"
                data-testid="retry-button"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('h-full flex flex-col bg-bg-primary', className)} data-testid="cockpit-page" role="main">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Agent Cockpit</h1>
            <p className="text-sm text-text-secondary mt-1">Monitor agent activity and workflow progress</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-text-muted" data-testid="last-updated">
                Last updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}

            {onRefresh && (
              <>
                <button
                  onClick={onAutoRefreshChange}
                  className={clsx(
                    'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                    autoRefresh
                      ? 'bg-accent-blue text-white'
                      : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
                  )}
                  aria-pressed={autoRefresh}
                  data-testid="auto-refresh-toggle"
                >
                  Auto-refresh
                </button>

                <button
                  onClick={onRefresh}
                  className="p-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors"
                  aria-label="Refresh data"
                  data-testid="page-refresh"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-6" data-testid="cockpit-grid">
          {/* KPI Header */}
          <section className="col-span-full" data-testid="kpi-section">
            <KPIHeader kpis={kpis} />
          </section>

          {/* Middle Row: Workflow Graph + Workers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="middle-row">
            {/* Workflow Graph */}
            <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Workflow</h2>
              <WorkflowGraphView
                nodes={workflowNodes}
                edges={workflowEdges}
                onNodeClick={onNodeClick}
              />
            </div>

            {/* Worker Utilization */}
            <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Workers</h2>
              <WorkerUtilizationPanel workers={workers} onWorkerClick={onWorkerClick} />
            </div>
          </div>

          {/* Runs Table */}
          <section>
            <div className="bg-bg-secondary rounded-lg border border-border-primary">
              <div className="p-4 border-b border-border-primary">
                <h2 className="text-lg font-semibold text-text-primary">Recent Runs</h2>
              </div>
              <RunsTable runs={runs} onRowClick={onRunClick} showFilters />
            </div>
          </section>

          {/* Git Integration */}
          <section>
            <div className="bg-bg-secondary rounded-lg border border-border-primary">
              <div className="p-4 border-b border-border-primary">
                <h2 className="text-lg font-semibold text-text-primary">Git Integration</h2>
              </div>
              <GitIntegrationPanel environments={environments} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
