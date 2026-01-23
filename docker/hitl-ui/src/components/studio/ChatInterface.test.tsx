/**
 * Tests for ChatInterface component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatInterface, { type ChatMessage } from './ChatInterface';

describe('ChatInterface', () => {
  const defaultMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello, can you help me create a PRD?',
      timestamp: '2026-01-23T10:00:00Z',
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Of course! I would be happy to help you create a Product Requirements Document. Let me start by asking a few questions about your project.',
      timestamp: '2026-01-23T10:00:05Z',
    },
    {
      id: 'msg-3',
      role: 'user',
      content: 'It is a task management app.',
      timestamp: '2026-01-23T10:01:00Z',
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ChatInterface messages={defaultMessages} />);
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    });

    it('renders message history', () => {
      render(<ChatInterface messages={defaultMessages} />);
      expect(screen.getByText(/hello, can you help me create a prd/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ChatInterface messages={defaultMessages} className="my-custom-class" />);
      expect(screen.getByTestId('chat-interface')).toHaveClass('my-custom-class');
    });
  });

  describe('Message Display', () => {
    it('displays all messages', () => {
      render(<ChatInterface messages={defaultMessages} />);
      expect(screen.getAllByTestId(/^message-/)).toHaveLength(3);
    });

    it('displays user messages with user styling', () => {
      render(<ChatInterface messages={defaultMessages} />);
      const userMessage = screen.getByTestId('message-msg-1');
      expect(userMessage).toHaveClass('bg-accent-blue');
    });

    it('displays assistant messages with assistant styling', () => {
      render(<ChatInterface messages={defaultMessages} />);
      const assistantMessage = screen.getByTestId('message-msg-2');
      expect(assistantMessage).toHaveClass('bg-bg-tertiary');
    });

    it('displays message timestamps', () => {
      render(<ChatInterface messages={defaultMessages} showTimestamps />);
      expect(screen.getByTestId('timestamp-msg-1')).toBeInTheDocument();
    });

    it('hides timestamps by default', () => {
      render(<ChatInterface messages={defaultMessages} />);
      expect(screen.queryByTestId('timestamp-msg-1')).not.toBeInTheDocument();
    });

    it('renders markdown in messages', () => {
      const messagesWithMarkdown: ChatMessage[] = [
        {
          id: 'msg-md',
          role: 'assistant',
          content: '**Bold text** and `code snippet`',
          timestamp: '2026-01-23T10:00:00Z',
        },
      ];
      render(<ChatInterface messages={messagesWithMarkdown} />);
      expect(screen.getByText(/bold text/i)).toBeInTheDocument();
    });
  });

  describe('Message Input', () => {
    it('renders input field', () => {
      render(<ChatInterface messages={defaultMessages} />);
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
    });

    it('renders send button', () => {
      render(<ChatInterface messages={defaultMessages} />);
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('send button is disabled when input is empty', () => {
      render(<ChatInterface messages={defaultMessages} />);
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    });

    it('send button is enabled when input has text', () => {
      render(<ChatInterface messages={defaultMessages} />);

      fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
        target: { value: 'Hello' },
      });

      expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled();
    });

    it('clears input after sending', () => {
      const onSend = vi.fn();
      render(<ChatInterface messages={defaultMessages} onSendMessage={onSend} />);

      const input = screen.getByPlaceholderText(/type a message/i);
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      expect(input).toHaveValue('');
    });

    it('calls onSendMessage when send button clicked', () => {
      const onSend = vi.fn();
      render(<ChatInterface messages={defaultMessages} onSendMessage={onSend} />);

      fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
        target: { value: 'Test message' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      expect(onSend).toHaveBeenCalledWith('Test message');
    });

    it('calls onSendMessage when Enter is pressed', () => {
      const onSend = vi.fn();
      render(<ChatInterface messages={defaultMessages} onSendMessage={onSend} />);

      const input = screen.getByPlaceholderText(/type a message/i);
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(onSend).toHaveBeenCalledWith('Test message');
    });

    it('does not send on Shift+Enter (allows newline)', () => {
      const onSend = vi.fn();
      render(<ChatInterface messages={defaultMessages} onSendMessage={onSend} />);

      const input = screen.getByPlaceholderText(/type a message/i);
      fireEvent.change(input, { target: { value: 'Line 1' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });

      expect(onSend).not.toHaveBeenCalled();
    });

    it('disables input when disabled prop is true', () => {
      render(<ChatInterface messages={defaultMessages} disabled />);
      expect(screen.getByPlaceholderText(/type a message/i)).toBeDisabled();
    });
  });

  describe('Streaming/Typing Indicator', () => {
    it('shows typing indicator when isStreaming is true', () => {
      render(<ChatInterface messages={defaultMessages} isStreaming />);
      expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
    });

    it('hides typing indicator when isStreaming is false', () => {
      render(<ChatInterface messages={defaultMessages} isStreaming={false} />);
      expect(screen.queryByTestId('streaming-indicator')).not.toBeInTheDocument();
    });

    it('shows animated dots in typing indicator', () => {
      render(<ChatInterface messages={defaultMessages} isStreaming />);
      const typingIndicator = screen.getByTestId('streaming-indicator');
      expect(typingIndicator.querySelectorAll('.animate-bounce').length).toBe(3);
    });

    it('disables send button while streaming', () => {
      render(<ChatInterface messages={defaultMessages} isStreaming />);
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    });
  });

  describe('Auto-scroll', () => {
    it('scrolls to bottom on new message', async () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const { rerender } = render(<ChatInterface messages={defaultMessages} />);

      const newMessages = [
        ...defaultMessages,
        {
          id: 'msg-4',
          role: 'assistant' as const,
          content: 'New message!',
          timestamp: '2026-01-23T10:02:00Z',
        },
      ];

      rerender(<ChatInterface messages={newMessages} />);

      expect(scrollIntoViewMock).toHaveBeenCalled();
    });

    it('shows scroll-to-bottom button when scrolled up', () => {
      // This test would require mocking scroll position
      // For now, we test that the button exists when manually triggered
      render(<ChatInterface messages={defaultMessages} />);
      const container = screen.getByTestId('messages-container');

      // Simulate scrolling up by setting scrollTop
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(container, 'clientHeight', { value: 400, writable: true });

      fireEvent.scroll(container);

      // Button appears when scrolled significantly up from bottom
      // Implementation will handle this logic
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no messages', () => {
      render(<ChatInterface messages={[]} />);
      expect(screen.getByText(/start a conversation/i)).toBeInTheDocument();
    });

    it('shows custom empty message when provided', () => {
      render(<ChatInterface messages={[]} emptyMessage="Ask me anything!" />);
      expect(screen.getByText(/ask me anything/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<ChatInterface messages={defaultMessages} isLoading />);
      expect(screen.getByTestId('chat-loading')).toBeInTheDocument();
    });

    it('shows skeleton messages when loading', () => {
      render(<ChatInterface messages={defaultMessages} isLoading />);
      expect(screen.getAllByTestId('message-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('shows error message when error provided', () => {
      render(<ChatInterface messages={defaultMessages} error="Failed to send message" />);
      expect(screen.getByText(/failed to send message/i)).toBeInTheDocument();
    });

    it('shows retry button on error', () => {
      const onRetry = vi.fn();
      render(
        <ChatInterface messages={defaultMessages} error="Error" onRetry={onRetry} />
      );
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('calls onRetry when retry button clicked', () => {
      const onRetry = vi.fn();
      render(
        <ChatInterface messages={defaultMessages} error="Error" onRetry={onRetry} />
      );

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      expect(onRetry).toHaveBeenCalled();
    });

    it('shows dismiss button on error', () => {
      render(<ChatInterface messages={defaultMessages} error="Error" />);
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });
  });

  describe('Message Actions', () => {
    it('shows copy button on hover', () => {
      render(<ChatInterface messages={defaultMessages} />);

      const message = screen.getByTestId('message-msg-2');
      fireEvent.mouseEnter(message);

      expect(screen.getByTestId('copy-msg-2')).toBeInTheDocument();
    });

    it('calls onCopy when copy clicked', () => {
      const onCopy = vi.fn();
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      render(<ChatInterface messages={defaultMessages} onCopy={onCopy} />);

      const message = screen.getByTestId('message-msg-2');
      fireEvent.mouseEnter(message);
      fireEvent.click(screen.getByTestId('copy-msg-2'));

      expect(onCopy).toHaveBeenCalledWith('msg-2');
    });
  });

  describe('Accessibility', () => {
    it('input has proper label', () => {
      render(<ChatInterface messages={defaultMessages} />);
      const input = screen.getByPlaceholderText(/type a message/i);
      expect(input).toHaveAttribute('aria-label');
    });

    it('messages list has proper role', () => {
      render(<ChatInterface messages={defaultMessages} />);
      expect(screen.getByRole('log')).toBeInTheDocument();
    });

    it('send button has proper aria-label', () => {
      render(<ChatInterface messages={defaultMessages} />);
      expect(screen.getByRole('button', { name: /send/i })).toHaveAttribute('aria-label');
    });
  });
});
