/**
 * DocsPage - Documentation page with Overview, Diagrams, Reference, and Glossary tabs
 *
 * Integrates system documentation, mermaid diagrams, and glossary into a
 * unified documentation experience with URL-persisted tab navigation and search.
 */

import { useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import BlueprintMap, { Cluster } from '../components/docs/BlueprintMap';
import MethodologyStepper, { Stage } from '../components/docs/MethodologyStepper';
import InteractiveGlossary, { GlossaryTerm } from '../components/docs/InteractiveGlossary';
import DiagramGallery from '../components/docs/DiagramGallery';
import DocBrowser from '../components/docs/DocBrowser';
import DocViewer from '../components/docs/DocViewer';
import DocSearch, { SearchResult } from '../components/docs/DocSearch';
import { useDocuments, useDiagrams, useDocument } from '../api/docs';

// Tab types
type TabId = 'overview' | 'diagrams' | 'reference' | 'glossary';

const validTabs: TabId[] = ['overview', 'diagrams', 'reference', 'glossary'];

// Tab configuration
const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'diagrams', label: 'Diagrams' },
  { id: 'reference', label: 'Reference' },
  { id: 'glossary', label: 'Glossary' },
];

// Mock data for BlueprintMap
const mockClusters: Cluster[] = [
  {
    id: 'discovery',
    name: 'Discovery',
    description: 'Understand requirements and plan features',
    color: 'teal',
    items: [
      { id: 'prd-agent', name: 'PRD Agent', type: 'agent' },
      { id: 'acceptance-agent', name: 'Acceptance Agent', type: 'agent' },
      { id: 'prd-doc', name: 'PRD Document', type: 'artifact' },
      { id: 'discovery-gate', name: 'Discovery Gate', type: 'gate' },
    ],
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Create technical design and architecture',
    color: 'purple',
    items: [
      { id: 'surveyor-agent', name: 'Surveyor Agent', type: 'agent' },
      { id: 'architect-agent', name: 'Architect Agent', type: 'agent' },
      { id: 'design-doc', name: 'Design Document', type: 'artifact' },
      { id: 'design-gate', name: 'Design Gate', type: 'gate' },
    ],
  },
  {
    id: 'development',
    name: 'Development',
    description: 'Implement, test, and review code',
    color: 'blue',
    items: [
      { id: 'coding-agent', name: 'Coding Agent', type: 'agent' },
      { id: 'debugger-agent', name: 'Debugger Agent', type: 'agent' },
      { id: 'code-files', name: 'Code Files', type: 'artifact' },
      { id: 'development-gate', name: 'Development Gate', type: 'gate' },
    ],
  },
  {
    id: 'validation',
    name: 'Validation',
    description: 'Validate and deploy changes',
    color: 'green',
    items: [
      { id: 'validator-agent', name: 'Validator Agent', type: 'agent' },
      { id: 'deployer-agent', name: 'Deployer Agent', type: 'agent' },
      { id: 'test-reports', name: 'Test Reports', type: 'artifact' },
      { id: 'validation-gate', name: 'Validation Gate', type: 'gate' },
    ],
  },
];

// Mock data for MethodologyStepper
const mockStages: Stage[] = [
  {
    id: 'requirements',
    name: 'Requirements',
    description: 'Define what needs to be built',
    why: 'Clear requirements prevent scope creep and ensure alignment',
    inputs: ['User stories', 'Business goals'],
    outputs: ['PRD', 'Acceptance criteria'],
    approvals: ['Product Owner', 'Stakeholders'],
    issues: ['Unclear requirements', 'Changing scope'],
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Plan how to build it',
    why: 'Good design reduces development time and prevents rework',
    inputs: ['PRD', 'Codebase context'],
    outputs: ['Technical design', 'Task breakdown'],
    approvals: ['Tech Lead', 'Architect'],
    issues: ['Over-engineering', 'Missing dependencies'],
  },
  {
    id: 'implementation',
    name: 'Implementation',
    description: 'Write the code',
    why: 'Quality implementation ensures maintainable code',
    inputs: ['Design doc', 'Test plan'],
    outputs: ['Code', 'Unit tests'],
    approvals: ['Code reviewer'],
    issues: ['Tech debt', 'Test coverage'],
  },
  {
    id: 'testing',
    name: 'Testing',
    description: 'Verify it works',
    why: 'Testing catches bugs before production',
    inputs: ['Code', 'Test cases'],
    outputs: ['Test results', 'Bug reports'],
    approvals: ['QA Lead'],
    issues: ['Flaky tests', 'Missing edge cases'],
  },
  {
    id: 'review',
    name: 'Review',
    description: 'Get feedback',
    why: 'Reviews improve code quality and share knowledge',
    inputs: ['Pull request', 'Code diff'],
    outputs: ['Review comments', 'Approval'],
    approvals: ['Code owners'],
    issues: ['Review bottlenecks', 'Unclear feedback'],
  },
  {
    id: 'integration',
    name: 'Integration',
    description: 'Merge changes',
    why: 'Integration testing catches system-level issues',
    inputs: ['Approved PR', 'Test suite'],
    outputs: ['Merged code', 'Integration test results'],
    approvals: ['CI system'],
    issues: ['Merge conflicts', 'Breaking changes'],
  },
  {
    id: 'deployment',
    name: 'Deployment',
    description: 'Ship to production',
    why: 'Controlled deployment minimizes downtime',
    inputs: ['Merged code', 'Deploy plan'],
    outputs: ['Deployed service', 'Metrics'],
    approvals: ['Release manager'],
    issues: ['Rollback needed', 'Config issues'],
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    description: 'Watch for issues',
    why: 'Monitoring ensures system health',
    inputs: ['Production logs', 'Metrics'],
    outputs: ['Alerts', 'Dashboards'],
    approvals: ['On-call engineer'],
    issues: ['False alarms', 'Missing instrumentation'],
  },
];

// Mock data for InteractiveGlossary
const mockTerms: GlossaryTerm[] = [
  {
    id: 'agent',
    term: 'Agent',
    definition: 'An AI assistant specialized for a specific task in the development lifecycle',
    category: 'concept',
  },
  {
    id: 'artifact',
    term: 'Artifact',
    definition: 'A document or file generated during the development process',
    category: 'artifact',
  },
  {
    id: 'gate',
    term: 'Gate',
    definition: 'A human approval checkpoint before proceeding to the next stage',
    category: 'concept',
  },
  {
    id: 'prd',
    term: 'PRD',
    definition: 'Product Requirements Document describing what to build and why',
    category: 'artifact',
  },
  {
    id: 'context-pack',
    term: 'Context Pack',
    definition: 'Codebase analysis provided to agents for informed decision-making',
    category: 'technical',
  },
  {
    id: 'rlm',
    term: 'RLM',
    definition: 'Reinforcement Learning from Human Feedback for model improvement',
    category: 'technical',
  },
];

export default function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get active tab from URL or default to overview
  const activeTab = useMemo(() => {
    const tabParam = searchParams.get('tab') as TabId | null;
    return tabParam && validTabs.includes(tabParam) ? tabParam : 'overview';
  }, [searchParams]);

  // Selected document in Reference tab
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>();

  // Fetch documents and diagrams
  const { data: documents = [], isLoading: docsLoading } = useDocuments();
  const { data: diagrams = [], isLoading: diagramsLoading } = useDiagrams();
  const { data: selectedDocument } = useDocument(selectedDocId);

  // Handle tab change
  const handleTabChange = useCallback(
    (tabId: TabId) => {
      setSearchParams({ tab: tabId });
    },
    [setSearchParams]
  );

  // Handle diagram selection - navigate to detail page
  const handleDiagramSelect = useCallback(
    (diagramId: string) => {
      navigate(`/docs/diagrams/${diagramId}`);
    },
    [navigate]
  );

  // Handle document selection in browser
  const handleDocSelect = useCallback((docId: string) => {
    setSelectedDocId(docId);
  }, []);

  // Handle search result selection
  const handleSearchResultSelect = useCallback(
    (result: SearchResult) => {
      if (result.type === 'diagram') {
        // Navigate to diagrams tab and potentially highlight the diagram
        setSearchParams({ tab: 'diagrams' });
        // Optionally navigate to diagram detail
        // navigate(`/docs/diagrams/${result.id}`);
      } else if (result.type === 'document') {
        // Navigate to reference tab and select the document
        setSearchParams({ tab: 'reference' });
        setSelectedDocId(result.id);
      }
    },
    [setSearchParams]
  );

  // Render Overview tab content
  const renderOverviewTab = () => (
    <div className="space-y-8">
      {/* System Overview */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
        <BlueprintMap clusters={mockClusters} showFlow />
      </section>

      {/* Methodology Stages */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Methodology Stages</h2>
        <MethodologyStepper stages={mockStages} />
      </section>
    </div>
  );

  // Render Diagrams tab content
  const renderDiagramsTab = () => (
    <div>
      {diagramsLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
        </div>
      ) : (
        <DiagramGallery diagrams={diagrams} onSelect={handleDiagramSelect} />
      )}
    </div>
  );

  // Mobile sidebar collapse state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Auto-collapse sidebar when document selected on mobile
  const handleDocSelectWithCollapse = useCallback((docId: string) => {
    handleDocSelect(docId);
    // Check if mobile-sized viewport (could be detected via window width or media query)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [handleDocSelect]);

  // Render Reference tab content
  const renderReferenceTab = () => (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 h-full">
      {/* Mobile sidebar toggle */}
      <button
        className="md:hidden flex items-center gap-2 px-4 py-2 bg-white rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-expanded={sidebarOpen}
        data-testid="sidebar-toggle"
      >
        <svg
          className={clsx('h-4 w-4 transition-transform', sidebarOpen && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        {sidebarOpen ? 'Hide' : 'Show'} Documents
      </button>

      {/* Sidebar - Document Browser */}
      <div
        className={clsx(
          'bg-white rounded-lg border p-4 overflow-y-auto transition-all duration-200',
          'md:w-64 md:flex-shrink-0 md:block',
          sidebarOpen ? 'block' : 'hidden md:block'
        )}
        data-testid="doc-browser-container"
      >
        {docsLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
          </div>
        ) : (
          <DocBrowser
            documents={documents}
            selectedId={selectedDocId}
            onSelect={handleDocSelectWithCollapse}
          />
        )}
      </div>

      {/* Main content - Document Viewer */}
      <div className="flex-1 bg-white rounded-lg border p-4 md:p-6 overflow-y-auto min-h-[300px]">
        {selectedDocId && selectedDocument ? (
          <DocViewer document={selectedDocument} />
        ) : selectedDocId ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted">
            <div className="text-center">
              <svg
                className="h-12 w-12 mx-auto mb-3 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Select a document to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render Glossary tab content
  const renderGlossaryTab = () => (
    <div>
      <InteractiveGlossary terms={mockTerms} />
    </div>
  );

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'diagrams':
        return renderDiagramsTab();
      case 'reference':
        return renderReferenceTab();
      case 'glossary':
        return renderGlossaryTab();
      default:
        return renderOverviewTab();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 max-w-7xl mx-auto" data-testid="docs-page">
      {/* Header with Search */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
            <p className="text-sm text-gray-600 mt-1">
              Learn about the aSDLC methodology and how to use the system effectively
            </p>
          </div>
          <DocSearch
            documents={documents}
            diagrams={diagrams}
            onResultSelect={handleSearchResultSelect}
            className="w-80"
            placeholder="Search docs and diagrams..."
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="px-6">
          <nav className="flex gap-4" role="tablist" data-testid="tabs-container">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={clsx(
                  'py-3 px-4 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-accent-teal text-accent-teal'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                )}
                role="tab"
                aria-selected={activeTab === tab.id}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">{renderTabContent()}</div>
    </div>
  );
}
