/**
 * StudioIdeationPage - PRD Ideation Studio with 3-column layout (P05-F11 T17)
 *
 * Layout:
 * - Session Bar: Title input, Save Draft button, Model selector
 * - Chat Panel: IdeationChat for conversational PRD development
 * - Maturity Panel: MaturityTracker, CategoryProgress, GapsPanel, RequirementsList
 * - Output Panel: PRDPreviewPanel, UserStoriesList, SubmitPRDButton, GateStatusBanner
 */

import { useState, useCallback } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentArrowDownIcon,
  LightBulbIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useIdeationStore } from '../stores/ideationStore';
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
} from '../components/studio/ideation';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { saveIdeationDraft } from '../api/ideation';
import { identifyGaps } from '../utils/maturityCalculator';
import type { Gap } from '../types/ideation';

export interface StudioIdeationPageProps {
  /** Custom class name */
  className?: string;
}

/**
 * Model selector options
 */
const MODELS = [
  { id: 'sonnet', name: 'Claude Sonnet', description: 'Balanced performance' },
  { id: 'opus', name: 'Claude Opus', description: 'Highest performance' },
  { id: 'haiku', name: 'Claude Haiku', description: 'Fastest response' },
];

/**
 * StudioIdeationPage component
 */
export default function StudioIdeationPage({ className }: StudioIdeationPageProps) {
  // Store subscriptions
  const sessionId = useIdeationStore((state) => state.sessionId);
  const projectName = useIdeationStore((state) => state.projectName);
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
  const sendMessage = useIdeationStore((state) => state.sendMessage);
  const setError = useIdeationStore((state) => state.setError);
  const submitForPRD = useIdeationStore((state) => state.submitForPRD);

  // Local state
  const [projectNameInput, setProjectNameInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('sonnet');
  const [isMaturityCollapsed, setIsMaturityCollapsed] = useState(false);
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      });
      // Could show a toast notification here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, messages, maturity, extractedRequirements, setError]);

  // Handle "Ask about this" from GapsPanel
  const handleAskAboutGap = useCallback(
    (question: string) => {
      sendMessage(question);
    },
    [sendMessage]
  );

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
              <div data-testid="model-selector">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-border-primary rounded bg-bg-primary text-text-primary"
                  aria-label="Select model"
                >
                  {MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Start Session View */}
        <div className="flex-1 flex items-center justify-center">
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
            <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
              <LightBulbIcon className="h-6 w-6 text-yellow-500" />
              Ideation Studio
            </h1>
            <span className="text-sm text-text-secondary font-medium">{projectName}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
              {maturity.level.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={projectName}
              readOnly
              placeholder="Project name..."
              className="px-3 py-1.5 text-sm border border-border-primary rounded bg-bg-tertiary text-text-secondary"
              aria-label="Project name"
            />
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!sessionId || isSaving}
              className="px-3 py-1.5 text-sm border border-border-primary rounded hover:bg-bg-tertiary text-text-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <div data-testid="model-selector">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border-primary rounded bg-bg-primary text-text-primary"
                aria-label="Select model"
              >
                {MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
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
