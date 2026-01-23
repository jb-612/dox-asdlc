/**
 * ArtifactDetailPage - Detailed view of a single artifact
 *
 * Displays:
 * - Artifact metadata (name, type, status, epic, agent)
 * - 4 tabs: Content, History, Provenance, Context Pack
 * - Action buttons: Download, Export, View in Git, Submit to Gate
 */

import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  CodeBracketIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import ContentTab from '../components/artifacts/ContentTab';
import HistoryTab from '../components/artifacts/HistoryTab';
import ProvenanceTab from '../components/artifacts/ProvenanceTab';
import ContextPackTab from '../components/artifacts/ContextPackTab';

// Tab definitions
type TabId = 'content' | 'history' | 'provenance' | 'context';

interface Tab {
  id: TabId;
  label: string;
  testId: string;
}

const tabs: Tab[] = [
  { id: 'content', label: 'Content', testId: 'tab-content' },
  { id: 'history', label: 'History', testId: 'tab-history' },
  { id: 'provenance', label: 'Provenance', testId: 'tab-provenance' },
  { id: 'context', label: 'Context Pack', testId: 'tab-context' },
];

// Mock artifact data
const mockArtifact = {
  id: 'art-123',
  name: 'PRD Document',
  type: 'document',
  status: 'approved',
  epic: 'User Authentication',
  agent: 'PRD Agent',
  createdAt: '2026-01-23T10:00:00Z',
  sha: 'abc1234def5678',
  version: 'v1.2.3',
  content: '# Product Requirements Document\n\nThis is the PRD content...',
  versions: [
    { version: 'v1.2.3', createdAt: '2026-01-23T10:00:00Z' },
    { version: 'v1.2.2', createdAt: '2026-01-22T14:00:00Z' },
    { version: 'v1.2.1', createdAt: '2026-01-21T09:00:00Z' },
  ],
};

export default function ArtifactDetailPage() {
  const { artifactId } = useParams<{ artifactId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('content');
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Use mock data (in real app, fetch based on artifactId)
  const artifact = { ...mockArtifact, id: artifactId || 'unknown' };

  const handleTabClick = (tabId: TabId) => {
    setActiveTab(tabId);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, tabId: TabId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveTab(tabId);
    }
  };

  const handleDownload = () => {
    console.log('Download requested for:', artifactId);
  };

  const handleExport = (format: string) => {
    console.log('Export requested:', format, artifactId);
    setShowExportMenu(false);
  };

  const handleViewInGit = () => {
    console.log('View in Git requested for:', artifactId);
  };

  const handleSubmitToGate = () => {
    console.log('Submit to Gate requested for:', artifactId);
  };

  const handleBack = () => {
    navigate('/artifacts');
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved':
        return 'bg-status-success/20 text-status-success';
      case 'pending':
        return 'bg-status-warning/20 text-status-warning';
      case 'rejected':
        return 'bg-status-error/20 text-status-error';
      default:
        return 'bg-bg-tertiary text-text-secondary';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'content':
        return <ContentTab content={artifact.content} />;
      case 'history':
        return <HistoryTab versions={artifact.versions} />;
      case 'provenance':
        return <ProvenanceTab />;
      case 'context':
        return <ContextPackTab />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-primary" data-testid="artifact-detail-page">
      {/* Breadcrumb */}
      <nav className="px-6 py-3 border-b border-border-primary bg-bg-secondary" data-testid="breadcrumb">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link to="/artifacts" className="text-text-secondary hover:text-text-primary">
              Artifacts
            </Link>
          </li>
          <li className="text-text-muted">/</li>
          <li className="text-text-primary font-medium" data-testid="breadcrumb-current">
            {artifact.name}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Back Button */}
            <button
              onClick={handleBack}
              className="p-2 rounded-lg text-text-secondary hover:bg-bg-tertiary transition-colors"
              data-testid="back-button"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-text-primary" data-testid="artifact-name">
                  {artifact.name}
                </h1>
                <span
                  className="px-2 py-0.5 text-xs font-medium bg-accent-blue/20 text-accent-blue rounded"
                  data-testid="artifact-type"
                >
                  {artifact.type}
                </span>
                <span
                  className={clsx('px-2 py-0.5 text-xs font-medium rounded capitalize', getStatusColor(artifact.status))}
                  data-testid="artifact-status"
                >
                  {artifact.status}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-text-secondary" data-testid="artifact-epic">
                  Epic: <span className="text-text-primary">{artifact.epic}</span>
                </span>
                <span className="text-text-secondary" data-testid="artifact-agent">
                  Agent: <span className="text-text-primary">{artifact.agent}</span>
                </span>
                <span className="text-text-secondary" data-testid="artifact-created">
                  Created: <span className="text-text-primary">{new Date(artifact.createdAt).toLocaleDateString()}</span>
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm">
                <span className="text-text-secondary" data-testid="artifact-sha">
                  SHA: <code className="text-text-primary font-mono">{artifact.sha.slice(0, 7)}</code>
                </span>
                <span className="text-text-secondary" data-testid="artifact-version">
                  Version: <span className="text-text-primary">{artifact.version}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors"
              data-testid="action-download"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors"
                data-testid="action-export"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                Export
              </button>
              {showExportMenu && (
                <div
                  className="absolute right-0 mt-1 w-32 bg-bg-secondary border border-border-primary rounded-lg shadow-lg z-10"
                  data-testid="export-menu"
                >
                  <button
                    onClick={() => handleExport('md')}
                    className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-tertiary"
                    data-testid="export-md"
                  >
                    Markdown
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-tertiary"
                    data-testid="export-json"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-tertiary"
                    data-testid="export-pdf"
                  >
                    PDF
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleViewInGit}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors"
              data-testid="action-git"
            >
              <CodeBracketIcon className="h-4 w-4" />
              View in Git
            </button>
            <button
              onClick={handleSubmitToGate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
              data-testid="action-submit"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              Submit to Gate
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-border-primary bg-bg-secondary px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-testid={tab.testId}
              onClick={() => handleTabClick(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
              tabIndex={0}
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
