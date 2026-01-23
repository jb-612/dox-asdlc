/**
 * RunDetailPage - Detailed view of a single agent run
 *
 * Displays:
 * - Run metadata (epic, agent, status, duration)
 * - 5 tabs: Timeline, Inputs, Outputs, Evidence, RLM Trajectory
 * - Action buttons: Rerun, Export, Escalate
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import RunTimeline from '../components/cockpit/RunTimeline';
import RunInputsTab from '../components/cockpit/RunInputsTab';
import RunOutputsTab from '../components/cockpit/RunOutputsTab';
import EvidenceTab from '../components/cockpit/EvidenceTab';
import RLMTrajectoryViewer from '../components/cockpit/RLMTrajectoryViewer';

// Tab definitions
type TabId = 'timeline' | 'inputs' | 'outputs' | 'evidence' | 'trajectory';

interface Tab {
  id: TabId;
  label: string;
  panelId: string;
}

const tabs: Tab[] = [
  { id: 'timeline', label: 'Timeline', panelId: 'timeline-tab-panel' },
  { id: 'inputs', label: 'Inputs', panelId: 'inputs-tab-panel' },
  { id: 'outputs', label: 'Outputs', panelId: 'outputs-tab-panel' },
  { id: 'evidence', label: 'Evidence', panelId: 'evidence-tab-panel' },
  { id: 'trajectory', label: 'Trajectory', panelId: 'trajectory-tab-panel' },
];

// Mock run data
const mockRunData = {
  id: 'run-123',
  epic: 'User Authentication',
  agent: 'PRD Agent',
  cluster: 'Development',
  status: 'completed' as const,
  isRlm: true,
  startedAt: '2026-01-23T10:00:00Z',
  duration: 300000, // 5 minutes in ms
  events: [
    { id: '1', type: 'start' as const, message: 'Run started', timestamp: '2026-01-23T10:00:00Z' },
    { id: '2', type: 'completion' as const, message: 'Run completed', timestamp: '2026-01-23T10:05:00Z' },
  ],
};

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('timeline');

  // Use mock data (in real app, fetch based on runId)
  const run = { ...mockRunData, id: runId || 'unknown' };

  const handleRerun = () => {
    console.log('Rerun requested for:', runId);
  };

  const handleExport = () => {
    console.log('Export requested for:', runId);
  };

  const handleEscalate = () => {
    console.log('Escalate requested for:', runId);
  };

  // Format duration as "Xm Ys"
  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Get status color class
  const getStatusColorClass = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'text-status-success';
      case 'running':
        return 'text-status-warning';
      case 'failed':
        return 'text-status-error';
      default:
        return 'text-text-secondary';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'timeline':
        return (
          <div data-testid="timeline-tab-panel" role="tabpanel">
            <RunTimeline events={run.events} />
          </div>
        );
      case 'inputs':
        return (
          <div data-testid="inputs-tab-panel" role="tabpanel">
            <RunInputsTab />
          </div>
        );
      case 'outputs':
        return (
          <div data-testid="outputs-tab-panel" role="tabpanel">
            <RunOutputsTab />
          </div>
        );
      case 'evidence':
        return (
          <div data-testid="evidence-tab-panel" role="tabpanel">
            <EvidenceTab />
          </div>
        );
      case 'trajectory':
        return (
          <div data-testid="trajectory-tab-panel" role="tabpanel">
            <RLMTrajectoryViewer />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-primary" data-testid="run-detail-page">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="px-6 py-3 border-b border-border-primary bg-bg-secondary">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link to="/cockpit" className="text-text-secondary hover:text-text-primary">
              Cockpit
            </Link>
          </li>
          <li className="text-text-muted">/</li>
          <li>
            <Link to="/cockpit/runs" className="text-text-secondary hover:text-text-primary">
              Runs
            </Link>
          </li>
          <li className="text-text-muted">/</li>
          <li className="text-text-primary font-medium">{runId}</li>
        </ol>
      </nav>

      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary">Run: {runId}</h1>
              {run.isRlm && (
                <span className="px-2 py-0.5 text-xs font-medium bg-accent-purple/20 text-accent-purple rounded">
                  RLM
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-text-secondary">
                Epic: <span className="text-text-primary">{run.epic}</span>
              </span>
              <span className="text-text-secondary">
                Agent: <span className="text-text-primary">{run.agent}</span>
              </span>
              <span className="text-text-secondary">
                Cluster: <span className="text-text-primary">{run.cluster}</span>
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-text-secondary">
                Status:{' '}
                <span
                  data-testid="run-status"
                  className={clsx('font-medium capitalize', getStatusColorClass(run.status))}
                >
                  {run.status}
                </span>
              </span>
              <span className="text-text-secondary" data-testid="run-started-at">
                Started: {new Date(run.startedAt).toLocaleString()}
              </span>
              <span className="text-text-secondary" data-testid="run-duration">
                Duration: {formatDuration(run.duration)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRerun}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Rerun
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              Export
            </button>
            <button
              onClick={handleEscalate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-status-warning bg-status-warning/10 text-status-warning hover:bg-status-warning/20 transition-colors"
            >
              <ExclamationTriangleIcon className="h-4 w-4" />
              Escalate
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-border-primary bg-bg-secondary px-6">
        <div role="tablist" className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
