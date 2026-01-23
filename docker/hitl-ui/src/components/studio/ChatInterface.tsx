/**
 * ChatInterface - Chat component with message history, input, and streaming support
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  PaperAirplaneIcon,
  ClipboardDocumentIcon,
  ArrowDownIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Chat message role */
export type MessageRole = 'user' | 'assistant' | 'system';

/** Chat message */
export interface ChatMessage {
  /** Message ID */
  id: string;
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: string;
}

export interface ChatInterfaceProps {
  /** Messages to display */
  messages: ChatMessage[];
  /** Loading state (initial load) */
  isLoading?: boolean;
  /** Streaming state (assistant is typing) */
  isStreaming?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Show timestamps */
  showTimestamps?: boolean;
  /** Error message */
  error?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Custom class name */
  className?: string;
  /** Ref for input element */
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  /** Callback when message is sent */
  onSendMessage?: (content: string) => void;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  /** Callback when message is copied */
  onCopy?: (messageId: string) => void;
}

// Format timestamp
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Simple markdown rendering (bold, code)
function renderContent(content: string): React.ReactNode {
  // Replace **text** with bold
  // Replace `code` with inline code
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, i) => {
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
}

export default function ChatInterface({
  messages,
  isLoading = false,
  isStreaming = false,
  disabled = false,
  showTimestamps = false,
  error,
  emptyMessage = 'Start a conversation by typing a message below.',
  className,
  inputRef,
  onSendMessage,
  onRetry,
  onCopy,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [showError, setShowError] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Reset error visibility when error changes
  useEffect(() => {
    setShowError(true);
  }, [error]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

  // Handle send
  const handleSend = useCallback(() => {
    if (inputValue.trim() && onSendMessage && !isStreaming && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  }, [inputValue, onSendMessage, isStreaming, disabled]);

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

  // Handle copy
  const handleCopy = useCallback(
    (messageId: string, content: string) => {
      // Call onCopy callback first
      onCopy?.(messageId);
      // Then copy to clipboard (fire and forget)
      navigator.clipboard?.writeText(content).catch((err) => {
        console.error('Failed to copy:', err);
      });
    },
    [onCopy]
  );

  // Handle dismiss error
  const handleDismissError = useCallback(() => {
    setShowError(false);
  }, []);

  const canSend = inputValue.trim().length > 0 && !isStreaming && !disabled;

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('flex flex-col h-full', className)} data-testid="chat-loading">
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={clsx(
                'max-w-[80%] p-3 rounded-lg animate-pulse',
                i % 2 === 0 ? 'bg-bg-tertiary' : 'bg-bg-secondary ml-auto'
              )}
              data-testid="message-skeleton"
            >
              <div className="h-4 bg-bg-primary rounded w-3/4 mb-2" />
              <div className="h-4 bg-bg-primary rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full', className)} data-testid="chat-interface">
      {/* Messages container */}
      <div
        ref={containerRef}
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto p-4 space-y-4"
        data-testid="messages-container"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            {emptyMessage}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              data-testid={`message-${message.id}`}
              className={clsx(
                'max-w-[80%] p-3 rounded-lg relative group',
                message.role === 'user'
                  ? 'bg-accent-blue text-white ml-auto'
                  : 'bg-bg-tertiary text-text-primary'
              )}
              onMouseEnter={() => setHoveredMessage(message.id)}
              onMouseLeave={() => setHoveredMessage(null)}
            >
              <div className="whitespace-pre-wrap break-words">
                {renderContent(message.content)}
              </div>

              {showTimestamps && (
                <div
                  className={clsx(
                    'text-xs mt-1',
                    message.role === 'user' ? 'text-white/70' : 'text-text-muted'
                  )}
                  data-testid={`timestamp-${message.id}`}
                >
                  {formatTimestamp(message.timestamp)}
                </div>
              )}

              {/* Copy button on hover */}
              {hoveredMessage === message.id && (
                <button
                  onClick={() => handleCopy(message.id, message.content)}
                  className={clsx(
                    'absolute -top-2 -right-2 p-1 rounded',
                    'bg-bg-secondary border border-border-primary shadow-sm',
                    'hover:bg-bg-tertiary transition-colors'
                  )}
                  data-testid={`copy-${message.id}`}
                  aria-label={`Copy message ${message.id}`}
                >
                  <ClipboardDocumentIcon className="h-4 w-4 text-text-muted" />
                </button>
              )}
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isStreaming && (
          <div
            className="max-w-[80%] p-3 rounded-lg bg-bg-tertiary"
            data-testid="streaming-indicator"
          >
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && showError && (
        <div className="mx-4 mb-2 p-3 rounded-lg bg-status-error/10 border border-status-error/20 flex items-center gap-3">
          <ExclamationCircleIcon className="h-5 w-5 text-status-error flex-shrink-0" />
          <span className="flex-1 text-sm text-status-error">{error}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm text-accent-blue hover:underline"
            >
              Retry
            </button>
          )}
          <button
            onClick={handleDismissError}
            className="p-1 hover:bg-status-error/20 rounded"
            aria-label="Dismiss error"
          >
            <XMarkIcon className="h-4 w-4 text-status-error" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-border-primary bg-bg-secondary">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            aria-label="Message input"
            data-testid="chat-input"
            className={clsx(
              'flex-1 resize-none rounded-lg px-4 py-2',
              'bg-bg-primary border border-border-primary',
              'text-text-primary placeholder-text-muted',
              'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            data-testid="send-button"
            className={clsx(
              'p-2 rounded-lg transition-colors',
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
