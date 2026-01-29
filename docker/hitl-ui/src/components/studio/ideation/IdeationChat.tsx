/**
 * IdeationChat - Chat interface for PRD Ideation Studio (P05-F11 T09)
 *
 * Extends the ChatInterface pattern with:
 * - Maturity delta indicators after AI responses
 * - Suggested follow-up questions as clickable chips
 * - Auto-scroll to newest message
 * - Markdown rendering for message content
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useIdeationStore } from '../../../stores/ideationStore';

export interface IdeationChatProps {
  /** Session ID for the ideation session */
  sessionId: string;
  /** Initial context to seed the conversation */
  initialContext?: string;
  /** Custom empty message */
  emptyMessage?: string;
  /** Custom class name */
  className?: string;
}

/**
 * Simple markdown rendering for chat messages
 */
function renderMarkdownContent(content: string): React.ReactNode {
  // Handle line breaks
  const lines = content.split('\n');

  return lines.map((line, lineIndex) => {
    // Process each line for markdown elements
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

    const processedParts = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1 py-0.5 rounded bg-bg-primary text-sm font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });

    return (
      <span key={lineIndex}>
        {processedParts}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });
}

export default function IdeationChat({
  sessionId,
  initialContext,
  emptyMessage = 'Start by describing your project or idea...',
  className,
}: IdeationChatProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get state from store
  const messages = useIdeationStore((state) => state.messages);
  const isLoading = useIdeationStore((state) => state.isLoading);
  const sendMessage = useIdeationStore((state) => state.sendMessage);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (inputValue.trim() && !isLoading) {
      const message = inputValue.trim();
      setInputValue('');
      await sendMessage(message);
    }
  }, [inputValue, isLoading, sendMessage]);

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Handle follow-up chip click
  const handleFollowupClick = useCallback(
    async (followup: string) => {
      if (!isLoading) {
        await sendMessage(followup);
      }
    },
    [isLoading, sendMessage]
  );

  // Find the latest assistant message with follow-ups
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant' && m.suggestedFollowups?.length);

  const canSend = inputValue.trim().length > 0 && !isLoading;

  return (
    <div className={clsx('flex flex-col h-full', className)} data-testid="ideation-chat">
      {/* Messages container */}
      <div
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto p-4 space-y-4"
        data-testid="ideation-messages-container"
      >
        {/* Initial context display */}
        {initialContext && messages.length === 0 && (
          <div className="p-4 bg-bg-secondary rounded-lg border border-border-primary">
            <p className="text-sm text-text-secondary">
              <strong>Project Context:</strong> {initialContext}
            </p>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !initialContext && (
          <div className="flex items-center justify-center h-full text-text-muted">
            {emptyMessage}
          </div>
        )}

        {/* Messages */}
        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          const isLatestWithFollowups =
            message.id === latestAssistantMessage?.id &&
            message.suggestedFollowups?.length;

          return (
            <div key={message.id} className="space-y-2">
              {/* Message bubble */}
              <div
                data-testid={`ideation-message-${message.id}`}
                className={clsx(
                  'max-w-[80%] p-3 rounded-lg',
                  isUser
                    ? 'bg-accent-blue text-white ml-auto'
                    : 'bg-bg-tertiary text-text-primary'
                )}
              >
                <div className="whitespace-pre-wrap break-words">
                  {renderMarkdownContent(message.content)}
                </div>

                {/* Maturity delta indicator */}
                {!isUser && message.maturityDelta !== undefined && message.maturityDelta > 0 && (
                  <div
                    data-testid={`maturity-delta-${message.id}`}
                    className="mt-2 text-xs font-medium text-status-success flex items-center gap-1"
                  >
                    <span className="inline-block w-4 h-4 rounded-full bg-status-success/20 flex items-center justify-center">
                      +
                    </span>
                    +{message.maturityDelta}%
                  </div>
                )}
              </div>

              {/* Suggested follow-ups (only on latest assistant message) */}
              {isLatestWithFollowups && (
                <div className="flex flex-wrap gap-2 ml-2">
                  {message.suggestedFollowups?.map((followup, idx) => (
                    <button
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleFollowupClick(followup)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleFollowupClick(followup);
                        }
                      }}
                      className={clsx(
                        'px-3 py-1.5 text-sm rounded-full',
                        'bg-bg-secondary border border-border-primary',
                        'text-text-secondary hover:text-text-primary',
                        'hover:bg-bg-tertiary transition-colors',
                        'cursor-pointer',
                        isLoading && 'opacity-50 cursor-not-allowed'
                      )}
                      disabled={isLoading}
                    >
                      {followup}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading indicator */}
        {isLoading && (
          <div
            className="max-w-[80%] p-3 rounded-lg bg-bg-tertiary"
            data-testid="ideation-chat-loading"
          >
            <div className="flex gap-1">
              <span
                className="w-2 h-2 bg-text-muted rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-2 h-2 bg-text-muted rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-2 h-2 bg-text-muted rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-border-primary bg-bg-secondary">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe your project or answer the questions..."
            disabled={isLoading}
            aria-label="Message input"
            data-testid="ideation-chat-input"
            className={clsx(
              'flex-1 resize-none rounded-lg px-4 py-2',
              'bg-bg-primary border border-border-primary',
              'text-text-primary placeholder-text-muted',
              'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            data-testid="ideation-send-button"
            className={clsx(
              'p-2 rounded-lg transition-colors self-end',
              canSend
                ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
                : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
            )}
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
