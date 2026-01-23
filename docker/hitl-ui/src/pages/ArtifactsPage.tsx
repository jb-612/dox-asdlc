/**
 * ArtifactsPage - Browse and manage generated artifacts
 *
 * Two tabs:
 * - Explorer: Sortable table with search and filters
 * - Spec Index: Hierarchical tree view of specifications
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import ArtifactExplorer from '../components/artifacts/ArtifactExplorer';
import SpecIndexBrowser from '../components/artifacts/SpecIndexBrowser';
import { PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

type TabType = 'explorer' | 'spec-index';

export default function ArtifactsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('explorer');
  const navigate = useNavigate();

  const handleArtifactClick = useCallback(
    (artifactId: string) => {
      navigate(`/artifacts/${artifactId}`);
    },
    [navigate]
  );

  const handleCreateArtifact = () => {
    console.log('Create artifact clicked');
  };

  const handleRefresh = () => {
    console.log('Refresh artifacts');
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, tab: TabType) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabChange(tab);
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-primary" data-testid="artifacts-page">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Artifacts</h1>
            <p className="text-sm text-text-secondary mt-1">
              Browse and manage generated artifacts from agent runs
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors"
              data-testid="refresh-btn"
            >
              <ArrowPathIcon className="h-4 w-4" />
              <span className="text-sm">Refresh</span>
            </button>
            <button
              onClick={handleCreateArtifact}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
              data-testid="create-artifact-btn"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="text-sm">Create Artifact</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-bg-secondary border-b border-border-primary">
        <div className="px-6">
          <nav className="flex gap-4">
            <button
              onClick={() => handleTabChange('explorer')}
              onKeyDown={(e) => handleTabKeyDown(e, 'explorer')}
              className={clsx(
                'py-3 px-4 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'explorer'
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              )}
              data-testid="tab-explorer"
            >
              Explorer
            </button>
            <button
              onClick={() => handleTabChange('spec-index')}
              onKeyDown={(e) => handleTabKeyDown(e, 'spec-index')}
              className={clsx(
                'py-3 px-4 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'spec-index'
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              )}
              data-testid="tab-spec-index"
            >
              Spec Index
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'explorer' ? (
          <ArtifactExplorer onArtifactClick={handleArtifactClick} />
        ) : (
          <SpecIndexBrowser />
        )}
      </div>
    </div>
  );
}
