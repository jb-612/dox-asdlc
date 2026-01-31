/**
 * StudioIdeationPage - PRD Ideation Studio with 3-column layout (P05-F11 T17)
 *
 * Layout:
 * - Session Bar: Title input, Save Draft button, Data source selector, Model selector
 * - Chat Panel: IdeationChat for conversational PRD development
 * - Maturity Panel: MaturityTracker, CategoryProgress, GapsPanel, RequirementsList
 * - Output Panel: PRDPreviewPanel, UserStoriesList, SubmitPRDButton, GateStatusBanner
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentArrowDownIcon,
  LightBulbIcon,
  PencilIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useIdeationStore } from '../stores/ideationStore';
import { useAgentConfigs, useModels } from '../api/llmConfig';
import {
  IdeationChat,
  MaturityTracker,
  CategoryProgress,
  GapsPanel,
  RequirementsList,
  PRDPreviewPanel,
  UserStoriesList,
  SubmitPRDButton,
  GateStatusBanner,
  IdeationDraftsList,
} from '../components/studio/ideation';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { saveIdeationDraft, updateProject } from '../api/ideation';
import { identifyGaps } from '../utils/maturityCalculator';
import type { Gap } from '../types/ideation';
import type { LLMProvider } from '../types/llmConfig';

export interface StudioIdeationPageProps {
  /** Custom class name */
  className?: string;
}

/** Data source option type */
type DataSourceOption = 'mock' | 'configured';

/**
 * StudioIdeationPage component
 */
export default function StudioIdeationPage({ className }: StudioIdeationPageProps) {
  // Store subscriptions
  const sessionId = useIdeationStore((state) => state.sessionId);
  const projectName = useIdeationStore((state) => state.projectName);
  const projectStatus = useIdeationStore((state) => state.projectStatus);
  const storeDataSource = useIdeationStore((state) => state.dataSource);
  const messages = useIdeationStore((state) => state.messages);
  const isLoading = useIdeationStore((state) => state.isLoading);
  const maturity = useIdeationStore((state) => state.maturity);
  const extractedRequirements = useIdeationStore((state) => state.extractedRequirements);
  const userStories = useIdeationStore((state) => state.userStories);
  const prdDraft = useIdeationStore((state) => state.prdDraft);
  const submittedGateId = useIdeationStore((state) => state.submittedGateId);
  const isSubmitting = useIdeationStore((state) => state.isSubmitting);
  const error = useIdeationStore((state) => state.error);
  const startSession = useIdeationStore((state) => state.startSession);
  const loadSession = useIdeationStore((state) => state.loadSession);
  const resetSession = useIdeationStore((state) => state.resetSession);
  const setStoreDataSource = useIdeationStore((state) => state.setDataSource);
  const sendMessage = useIdeationStore((state) => state.sendMessage);
  const setError = useIdeationStore((state) => state.setError);
  const submitForPRD = useIdeationStore((state) => state.submitForPRD);
  const setProjectName = useIdeationStore((state) => state.setProjectName);

  // LLM Config - get agent configs
  const { data: agentConfigs } = useAgentConfigs();

  // Find discovery agent configuration
  const discoveryConfig = useMemo(() => {
    return agentConfigs?.find((c) => c.role === 'discovery');
  }, [agentConfigs]);

  // Get the configured provider for the discovery agent (default to anthropic)
  const configuredProvider: LLMProvider = discoveryConfig?.provider || 'anthropic';
  const configuredModel = discoveryConfig?.model || '';

  // Fetch models for the configured provider
  const { data: providerModels } = useModels(configuredProvider);

  // Local state
  const [projectNameInput, setProjectNameInput] = useState('');
  const [isMaturityCollapsed, setIsMaturityCollapsed] = useState(false);
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [isRenameSaving, setIsRenameSaving] = useState(false);

  // Get display name for the configured model
  const configuredModelDisplay = useMemo(() => {
    if (!discoveryConfig) return 'Not configured';
    const providerName = discoveryConfig.provider.charAt(0).toUpperCase() + discoveryConfig.provider.slice(1);
    // Try to find model name from provider models
    const modelInfo = providerModels?.find(m => m.id === configuredModel);
    const modelName = modelInfo?.name || configuredModel || 'No model';
    return `${providerName}: ${modelName}`;
  }, [discoveryConfig, configuredModel, providerModels]);

  // Handle data source change - update store
  const handleDataSourceChange = useCallback((newValue: string) => {
    setStoreDataSource(newValue as DataSourceOption);
  }, [setStoreDataSource]);

  // Calculate gaps from maturity state
  const gaps: Gap[] = maturity.categories.length > 0 ? identifyGaps(maturity.categories) : [];

  // Handle start session
  const handleStartSession = useCallback(() => {
    if (projectNameInput.trim()) {
      startSession(projectNameInput.trim());
    }
  }, [projectNameInput, startSession]);

  // Handle save draft
  const handleSaveDraft = useCallback(async () => {
    if (!sessionId) return;

    setIsSaving(true);
    try {
      await saveIdeationDraft(sessionId, {
        messages,
        maturity,
        requirements: extractedRequirements,
        projectName,
        status: projectStatus,
        dataSource: storeDataSource,
      });
      // Could show a toast notification here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, messages, maturity, extractedRequirements, projectName, projectStatus, storeDataSource, setError]);

  // Handle "Ask about this" from GapsPanel
  const handleAskAboutGap = useCallback(
    (question: string) => {
      sendMessage(question);
    },
    [sendMessage]
  );

  // Handle starting edit mode for project name
  const handleStartEditName = useCallback(() => {
    setEditNameValue(projectName);
    setIsEditingName(true);
  }, [projectName]);

  // Handle canceling edit mode
  const handleCancelEditName = useCallback(() => {
    setIsEditingName(false);
    setEditNameValue('');
  }, []);

  // Handle saving the new project name
  const handleSaveProjectName = useCallback(async () => {
    if (!sessionId || !editNameValue.trim() || editNameValue.trim() === projectName) {
      setIsEditingName(false);
      return;
    }

    setIsRenameSaving(true);
    try {
      await updateProject(sessionId, { projectName: editNameValue.trim() });
      setProjectName(editNameValue.trim());
      setIsEditingName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename project');
    } finally {
      setIsRenameSaving(false);
    }
  }, [sessionId, editNameValue, projectName, setProjectName, setError]);

  // Handle key press in edit name input
  const handleEditNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveProjectName();
    } else if (e.key === 'Escape') {
      handleCancelEditName();
    }
  }, [handleSaveProjectName, handleCancelEditName]);

  // Handle error dismiss
  const handleDismissError = useCallback(() => {
    setError(null);
  }, [setError]);

  // Render start session view when no session
  if (!sessionId) {
    return (
      <div
        className={clsx('h-full flex flex-col bg-bg-primary', className)}
        data-testid="studio-ideation-page"
        role="main"
      >
        {/* Session Bar */}
        <div
          className="bg-bg-secondary border-b border-border-primary px-4 py-2"
          data-testid="session-bar"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
                <LightBulbIcon className="h-6 w-6 text-yellow-500" />
                Ideation Studio
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                placeholder="Project name..."
                className="px-3 py-1.5 text-sm border border-border-primary rounded bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Project name"
              />
              <button
                type="button"
                className="px-3 py-1.5 text-sm border border-border-primary rounded hover:bg-bg-tertiary text-text-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                Save Draft
              </button>
              <div data-testid="model-selector" className="flex items-center gap-2">
                <select
                  value={storeDataSource}
                  onChange={(e) => handleDataSourceChange(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-border-primary rounded bg-bg-primary text-text-primary"
                  aria-label="Data source"
                  data-testid="data-source-selector"
                >
                  <option value="mock">Mock Mode</option>
                  <option value="configured">Configured LLM</option>
                </select>
                {storeDataSource === 'configured' && (
                  <span className="text-sm text-text-secondary px-2 py-1.5 bg-bg-tertiary rounded">
                    {configuredModelDisplay}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Start Session View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left side: Saved Projects */}
          <div className="w-1/2 border-r border-border-primary p-6 overflow-y-auto">
            <IdeationDraftsList
              onResume={(data) => {
                loadSession(data);
              }}
              useMock={storeDataSource === 'mock'}
            />
          </div>

          {/* Right side: New Session */}
          <div className="w-1/2 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <LightBulbIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-text-primary mb-2">
                Start a New Ideation Session
              </h2>
              <p className="text-text-secondary mb-6">
                Enter your project name above to begin developing your Product Requirements Document
                through a guided conversation.
              </p>
              <button
                type="button"
                onClick={handleStartSession}
                disabled={!projectNameInput.trim()}
                className="px-6 py-3 text-lg bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
              >
                <PlusIcon className="h-5 w-5" />
                Start Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main 3-column layout when session is active
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 text-red-500">
          Something went wrong in the Ideation Studio. Please refresh the page.
        </div>
      }
    >
      <div
        className={clsx('h-full flex flex-col bg-bg-primary', className)}
        data-testid="studio-ideation-page"
        role="main"
      >
      {/* Session Bar */}
      <div
        className="bg-bg-secondary border-b border-border-primary px-4 py-2"
        data-testid="session-bar"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={resetSession}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
              aria-label="Back to projects list"
              title="Back to projects"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
              <LightBulbIcon className="h-6 w-6 text-yellow-500" />
              Ideation Studio
            </h1>
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={handleEditNameKeyDown}
                  className="px-2 py-0.5 text-sm border border-border-primary rounded bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Edit project name"
                  autoFocus
                  disabled={isRenameSaving}
                />
                <button
                  type="button"
                  onClick={handleSaveProjectName}
                  disabled={isRenameSaving || !editNameValue.trim()}
                  className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Save project name"
                  title="Save"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelEditName}
                  disabled={isRenameSaving}
                  className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded disabled:opacity-50"
                  aria-label="Cancel editing"
                  title="Cancel"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-sm text-text-secondary font-medium">{projectName}</span>
                <button
                  type="button"
                  onClick={handleStartEditName}
                  className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
                  aria-label="Edit project name"
                  title="Rename project"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </div>
            )}
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
              {maturity.level.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!sessionId || isSaving}
              className="px-3 py-1.5 text-sm border border-border-primary rounded hover:bg-bg-tertiary text-text-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <div data-testid="model-selector" className="flex items-center gap-2">
              <select
                value={storeDataSource}
                onChange={(e) => handleDataSourceChange(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border-primary rounded bg-bg-primary text-text-primary"
                aria-label="Data source"
                data-testid="data-source-selector"
              >
                <option value="mock">Mock Mode</option>
                <option value="configured">Configured LLM</option>
              </select>
              {storeDataSource === 'configured' && (
                <span className="text-sm text-text-secondary px-2 py-1.5 bg-bg-tertiary rounded">
                  {configuredModelDisplay}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div
          className="bg-red-50 border-b border-red-200 px-4 py-2"
          data-testid="error-toast"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-700">{error}</span>
            <button
              type="button"
              className="text-red-700 hover:text-red-900"
              onClick={handleDismissError}
            >
              x
            </button>
          </div>
        </div>
      )}

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Column */}
        <div className="flex-1 flex flex-col border-r border-border-primary" data-testid="chat-column">
          <IdeationChat sessionId={sessionId} />
        </div>

        {/* Maturity Column */}
        <div
          className={clsx(
            'w-80 flex flex-col border-r border-border-primary transition-all duration-300 overflow-y-auto',
            isMaturityCollapsed && 'collapsed w-12'
          )}
          data-testid="maturity-column"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary bg-bg-tertiary">
            <h2 className={clsx('text-sm font-medium text-text-primary', isMaturityCollapsed && 'hidden')}>
              Maturity Progress
            </h2>
            <button
              type="button"
              className="text-text-muted hover:text-text-secondary"
              onClick={() => setIsMaturityCollapsed(!isMaturityCollapsed)}
              data-testid="collapse-maturity-btn"
              aria-label={isMaturityCollapsed ? 'Expand maturity panel' : 'Collapse maturity panel'}
            >
              {isMaturityCollapsed ? (
                <ChevronRightIcon className="h-5 w-5" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          {!isMaturityCollapsed && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Maturity Tracker */}
              <MaturityTracker maturity={maturity} />

              {/* Category Progress */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-text-primary">Categories</h3>
                {maturity.categories.map((category) => (
                  <CategoryProgress key={category.id} category={category} />
                ))}
              </div>

              {/* Gaps Panel */}
              <GapsPanel
                gaps={gaps}
                onAskQuestion={handleAskAboutGap}
              />

              {/* Requirements List */}
              <RequirementsList
                requirements={extractedRequirements}
                maxHeight="200px"
              />
            </div>
          )}
        </div>

        {/* Output Column */}
        <div
          className={clsx(
            'w-96 flex flex-col transition-all duration-300 overflow-y-auto',
            isOutputCollapsed && 'collapsed w-12'
          )}
          data-testid="output-column"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary bg-bg-tertiary">
            <h2 className={clsx('text-sm font-medium text-text-primary', isOutputCollapsed && 'hidden')}>
              Output
            </h2>
            <button
              type="button"
              className="text-text-muted hover:text-text-secondary"
              onClick={() => setIsOutputCollapsed(!isOutputCollapsed)}
              data-testid="collapse-output-btn"
              aria-label={isOutputCollapsed ? 'Expand output panel' : 'Collapse output panel'}
            >
              {isOutputCollapsed ? (
                <ChevronLeftIcon className="h-5 w-5" />
              ) : (
                <ChevronRightIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          {!isOutputCollapsed && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4" data-testid="output-panel">
              {/* Gate Status Banner (when submitted) */}
              {submittedGateId && (
                <GateStatusBanner gateId={submittedGateId} status="pending" />
              )}

              {/* Submit PRD Button */}
              <SubmitPRDButton
                maturityScore={maturity.score}
                onSubmit={submitForPRD}
                onError={(errorMsg) => setError(errorMsg)}
              />

              {/* PRD Preview Panel */}
              <PRDPreviewPanel prdDocument={prdDraft} />

              {/* User Stories List */}
              <UserStoriesList stories={userStories} />
            </div>
          )}
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}
