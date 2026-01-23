/**
 * StudioDiscoveryPage - Discovery Studio with chat, outline, and output panels
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useStudioStore } from '../stores/studioStore';
import { sendChatMessage } from '../api/studio';
import ChatInterface from '../components/studio/ChatInterface';
import WorkingOutlinePanel from '../components/studio/WorkingOutlinePanel';
import OutputQuickviewPanel from '../components/studio/OutputQuickviewPanel';
import ModelCostSelector from '../components/studio/ModelCostSelector';
import ContextPackPreview from '../components/studio/ContextPackPreview';
import { SkeletonCard, SkeletonLine } from '../components/common/LoadingStates';

export interface StudioDiscoveryPageProps {
  /** Custom class name */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Epic name */
  epicName?: string;
  /** Environment */
  environment?: 'development' | 'staging' | 'production';
}

/**
 * StudioDiscoveryPage component
 */
export default function StudioDiscoveryPage({
  className,
  isLoading = false,
  epicName,
  environment = 'development',
}: StudioDiscoveryPageProps) {
  // Store subscriptions
  const messages = useStudioStore((state) => state.messages);
  const outline = useStudioStore((state) => state.outline);
  const artifacts = useStudioStore((state) => state.artifacts);
  const isStreaming = useStudioStore((state) => state.isStreaming);
  const addMessage = useStudioStore((state) => state.addMessage);
  const setStreaming = useStudioStore((state) => state.setStreaming);
  const updateOutline = useStudioStore((state) => state.updateOutline);
  const addArtifact = useStudioStore((state) => state.addArtifact);

  // Local state
  const [isOutlineCollapsed, setIsOutlineCollapsed] = useState(false);
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-3-5');
  const [rlmEnabled, setRlmEnabled] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Model options
  const models = [
    {
      id: 'claude-sonnet-3-5',
      name: 'Claude Sonnet 3.5',
      description: 'Balanced performance and cost',
      costPerToken: 0.000003,
      maxTokens: 200000,
    },
    {
      id: 'claude-opus-3',
      name: 'Claude Opus 3',
      description: 'Highest performance',
      costPerToken: 0.000015,
      maxTokens: 200000,
    },
  ];

  // Handle chat message send
  const handleSendMessage = useCallback(
    async (content: string) => {
      try {
        setError(null);
        // Add user message immediately
        addMessage({
          id: `msg-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
        });

        // Set streaming state
        setStreaming(true);

        // Send to API
        const response = await sendChatMessage({ message: content });

        // Add assistant response
        if (response.message) {
          addMessage(response.message);
        }

        // Update outline if provided
        if (response.outline) {
          updateOutline(response.outline);
        }

        // Add artifacts if provided
        if (response.artifacts && response.artifacts.length > 0) {
          response.artifacts.forEach((artifact) => addArtifact(artifact));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      } finally {
        setStreaming(false);
      }
    },
    [addMessage, setStreaming, updateOutline, addArtifact]
  );

  // Keyboard shortcut: Ctrl+/ to focus chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check if content exists for Save Draft
  const hasContent = messages.length > 0 || outline !== null;

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={clsx('h-full flex flex-col', className)} data-testid="page-loading">
        <div className="p-4 border-b">
          <SkeletonLine width="w-48" />
        </div>
        <div className="flex-1 flex">
          <div className="flex-1 p-4" data-testid="chat-skeleton">
            <SkeletonCard height="h-96" />
          </div>
          <div className="w-80 border-l p-4" data-testid="outline-skeleton">
            <SkeletonCard height="h-64" />
          </div>
          <div className="w-80 border-l p-4">
            <SkeletonCard height="h-64" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('h-full flex flex-col bg-gray-50', className)}
      data-testid="studio-discovery-page"
      role="main"
    >
      {/* Session Info Bar */}
      <div className="bg-white border-b px-4 py-2" data-testid="session-info">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <BeakerIcon className="h-6 w-6 text-blue-600" />
              Discovery Studio
            </h1>
            {epicName && (
              <span className="text-sm text-gray-600 font-medium">{epicName}</span>
            )}
            <span
              className={clsx(
                'text-xs px-2 py-1 rounded-full font-medium',
                environment === 'production'
                  ? 'bg-green-100 text-green-700'
                  : environment === 'staging'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-blue-100 text-blue-700'
              )}
            >
              {environment}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={!outline}
            >
              <DocumentTextIcon className="h-4 w-4" />
              Preview PRD
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={!hasContent}
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              Save Draft
            </button>
            <ModelCostSelector
              models={models}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              rlmEnabled={rlmEnabled}
              onRLMChange={setRlmEnabled}
              showRLMToggle
            />
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2" data-testid="error-toast">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-700">{error}</span>
            <button
              type="button"
              className="text-red-700 hover:text-red-900"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Column */}
        <div className="flex-1 flex flex-col border-r" data-testid="chat-column">
          <ChatInterface
            messages={messages}
            isStreaming={isStreaming}
            onSendMessage={handleSendMessage}
            inputRef={chatInputRef}
          />
        </div>

        {/* Outline Column */}
        <div
          className={clsx(
            'w-80 flex flex-col border-r transition-all duration-300',
            isOutlineCollapsed && 'collapsed w-12'
          )}
          data-testid="outline-column"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
            <h2 className={clsx('text-sm font-medium', isOutlineCollapsed && 'hidden')}>
              Working Outline
            </h2>
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setIsOutlineCollapsed(!isOutlineCollapsed)}
              data-testid="collapse-outline-btn"
              aria-label={isOutlineCollapsed ? 'Expand outline' : 'Collapse outline'}
            >
              {isOutlineCollapsed ? (
                <ChevronRightIcon className="h-5 w-5" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          {!isOutlineCollapsed && (
            <div className="flex-1 overflow-auto">
              <WorkingOutlinePanel sections={outline?.sections || []} />
            </div>
          )}
        </div>

        {/* Output Column */}
        <div
          className={clsx(
            'w-80 flex flex-col transition-all duration-300',
            isOutputCollapsed && 'collapsed w-12'
          )}
          data-testid="output-column"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
            <h2 className={clsx('text-sm font-medium', isOutputCollapsed && 'hidden')}>
              Output Quickview
            </h2>
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setIsOutputCollapsed(!isOutputCollapsed)}
              data-testid="collapse-output-btn"
              aria-label={isOutputCollapsed ? 'Expand output' : 'Collapse output'}
            >
              {isOutputCollapsed ? (
                <ChevronLeftIcon className="h-5 w-5" />
              ) : (
                <ChevronRightIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          {!isOutputCollapsed && (
            <div className="flex-1 overflow-auto">
              <OutputQuickviewPanel artifacts={artifacts} />
              <div className="p-3 border-t">
                <ContextPackPreview
                  files={[]}
                  costPerToken={models.find((m) => m.id === selectedModel)?.costPerToken || 0}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
