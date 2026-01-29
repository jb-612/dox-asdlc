/**
 * Tests for IdeationChat component (P05-F11 T09)
 *
 * IdeationChat extends the ChatInterface pattern with:
 * - Maturity delta indicators after AI responses
 * - Suggested follow-up questions as clickable chips
 * - Auto-scroll to newest message
 * - Markdown rendering for message content
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IdeationChat from './IdeationChat';
import type { IdeationMessage, MaturityState } from '../../../types/ideation';
import { MATURITY_LEVELS } from '../../../types/ideation';

// Mock the ideation store
const mockSendMessage = vi.fn();
const mockStore = {
  sessionId: 'test-session',
  messages: [] as IdeationMessage[],
  isLoading: false,
  maturity: {
    score: 25,
    level: MATURITY_LEVELS[1],
    categories: [],
    canSubmit: false,
    gaps: [],
  } as MaturityState,
  sendMessage: mockSendMessage,
};

vi.mock('../../../stores/ideationStore', () => ({
  useIdeationStore: (selector: (state: typeof mockStore) => unknown) => selector(mockStore),
}));

describe('IdeationChat', () => {
  const defaultMessages: IdeationMessage[] = [
    {
      id: 'msg-1',
      role: 'assistant',
      content: 'Welcome to the PRD Ideation Studio!',
      timestamp: '2026-01-23T10:00:00Z',
      suggestedFollowups: [
        'What problem are you solving?',
        'Who are the target users?',
      ],
    },
    {
      id: 'msg-2',
      role: 'user',
      content: 'We need an authentication system.',
      timestamp: '2026-01-23T10:01:00Z',
    },
    {
      id: 'msg-3',
      role: 'assistant',
      content: 'Great! I have captured that as part of your requirements.',
      timestamp: '2026-01-23T10:01:30Z',
      maturityDelta: 10,
      suggestedFollowups: [
        'What authentication methods?',
        'Expected user volume?',
      ],
    },
  ];

  const defaultProps = {
    sessionId: 'test-session',
    onMaturityUpdate: vi.fn(),
    onArtifactGenerated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.messages = defaultMessages;
    mockStore.isLoading = false;
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByTestId('ideation-chat')).toBeInTheDocument();
    });

    it('renders message history', () => {
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByText(/welcome to the prd ideation studio/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<IdeationChat {...defaultProps} className="my-custom-class" />);
      expect(screen.getByTestId('ideation-chat')).toHaveClass('my-custom-class');
    });
  });

  describe('Message Display', () => {
    it('displays all messages', () => {
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getAllByTestId(/^ideation-message-/)).toHaveLength(3);
    });

    it('displays user messages with user styling', () => {
      render(<IdeationChat {...defaultProps} />);
      const userMessage = screen.getByTestId('ideation-message-msg-2');
      expect(userMessage).toHaveClass('bg-accent-blue');
    });

    it('displays assistant messages with assistant styling', () => {
      render(<IdeationChat {...defaultProps} />);
      const assistantMessage = screen.getByTestId('ideation-message-msg-1');
      expect(assistantMessage).toHaveClass('bg-bg-tertiary');
    });

    it('renders markdown in messages', () => {
      mockStore.messages = [
        {
          id: 'msg-md',
          role: 'assistant',
          content: '**Bold text** and `code snippet`',
          timestamp: '2026-01-23T10:00:00Z',
        },
      ];
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByText('Bold text')).toBeInTheDocument();
    });
  });

  describe('Maturity Delta Display', () => {
    it('shows maturity delta indicator after AI response', () => {
      render(<IdeationChat {...defaultProps} />);
      const deltaIndicator = screen.getByTestId('maturity-delta-msg-3');
      expect(deltaIndicator).toBeInTheDocument();
      expect(deltaIndicator).toHaveTextContent('+10%');
    });

    it('shows positive delta with green styling', () => {
      render(<IdeationChat {...defaultProps} />);
      const deltaIndicator = screen.getByTestId('maturity-delta-msg-3');
      expect(deltaIndicator).toHaveClass('text-status-success');
    });

    it('does not show delta when not present', () => {
      render(<IdeationChat {...defaultProps} />);
      expect(screen.queryByTestId('maturity-delta-msg-1')).not.toBeInTheDocument();
    });

    it('does not show delta on user messages', () => {
      render(<IdeationChat {...defaultProps} />);
      expect(screen.queryByTestId('maturity-delta-msg-2')).not.toBeInTheDocument();
    });
  });

  describe('Suggested Follow-up Questions', () => {
    it('displays suggested follow-ups as chips', () => {
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByText('What authentication methods?')).toBeInTheDocument();
      expect(screen.getByText('Expected user volume?')).toBeInTheDocument();
    });

    it('clicking a follow-up chip sends it as a message', async () => {
      render(<IdeationChat {...defaultProps} />);
      const chip = screen.getByText('What authentication methods?');
      fireEvent.click(chip);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('What authentication methods?');
      });
    });

    it('only shows follow-ups on the latest assistant message', () => {
      render(<IdeationChat {...defaultProps} />);
      // The first message's follow-ups should not be visible
      expect(screen.queryByText('What problem are you solving?')).not.toBeInTheDocument();
      // Only the latest message's follow-ups should be visible
      expect(screen.getByText('What authentication methods?')).toBeInTheDocument();
    });

    it('does not show follow-ups on user messages', () => {
      mockStore.messages = [
        {
          id: 'msg-user',
          role: 'user',
          content: 'Test message',
          timestamp: '2026-01-23T10:00:00Z',
          suggestedFollowups: ['Should not appear'],
        },
      ];
      render(<IdeationChat {...defaultProps} />);
      expect(screen.queryByText('Should not appear')).not.toBeInTheDocument();
    });
  });

  describe('Message Input', () => {
    it('renders input field', () => {
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByPlaceholderText(/describe your project/i)).toBeInTheDocument();
    });

    it('renders send button', () => {
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('send button is disabled when input is empty', () => {
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    });

    it('send button is enabled when input has text', () => {
      render(<IdeationChat {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText(/describe your project/i), {
        target: { value: 'Hello' },
      });
      expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled();
    });

    it('clears input after sending', async () => {
      render(<IdeationChat {...defaultProps} />);
      const input = screen.getByPlaceholderText(/describe your project/i);
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('calls sendMessage when send button clicked', async () => {
      render(<IdeationChat {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText(/describe your project/i), {
        target: { value: 'Test message' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('Test message');
      });
    });

    it('calls sendMessage when Enter is pressed', async () => {
      render(<IdeationChat {...defaultProps} />);
      const input = screen.getByPlaceholderText(/describe your project/i);
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('Test message');
      });
    });

    it('does not send on Shift+Enter (allows newline)', () => {
      render(<IdeationChat {...defaultProps} />);
      const input = screen.getByPlaceholderText(/describe your project/i);
      fireEvent.change(input, { target: { value: 'Line 1' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when isLoading is true', () => {
      mockStore.isLoading = true;
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByTestId('ideation-chat-loading')).toBeInTheDocument();
    });

    it('disables send button while loading', () => {
      mockStore.isLoading = true;
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    });

    it('shows animated typing indicator while loading', () => {
      mockStore.isLoading = true;
      render(<IdeationChat {...defaultProps} />);
      const loadingIndicator = screen.getByTestId('ideation-chat-loading');
      expect(loadingIndicator.querySelectorAll('.animate-bounce').length).toBe(3);
    });
  });

  describe('Auto-scroll', () => {
    it('scrolls to bottom on new message', async () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const { rerender } = render(<IdeationChat {...defaultProps} />);

      mockStore.messages = [
        ...defaultMessages,
        {
          id: 'msg-4',
          role: 'assistant',
          content: 'New message!',
          timestamp: '2026-01-23T10:02:00Z',
        },
      ];

      rerender(<IdeationChat {...defaultProps} />);

      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no messages', () => {
      mockStore.messages = [];
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByText(/start by describing your project/i)).toBeInTheDocument();
    });

    it('shows custom empty message when provided', () => {
      mockStore.messages = [];
      render(<IdeationChat {...defaultProps} emptyMessage="Begin your ideation session" />);
      expect(screen.getByText(/begin your ideation session/i)).toBeInTheDocument();
    });
  });

  describe('Initial Context', () => {
    it('shows initial context when provided', () => {
      mockStore.messages = [];
      render(
        <IdeationChat
          {...defaultProps}
          initialContext="Building an e-commerce platform"
        />
      );
      expect(screen.getByText(/e-commerce platform/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('input has proper aria-label', () => {
      render(<IdeationChat {...defaultProps} />);
      const input = screen.getByPlaceholderText(/describe your project/i);
      expect(input).toHaveAttribute('aria-label');
    });

    it('messages list has proper role', () => {
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByRole('log')).toBeInTheDocument();
    });

    it('send button has proper aria-label', () => {
      render(<IdeationChat {...defaultProps} />);
      expect(screen.getByRole('button', { name: /send/i })).toHaveAttribute('aria-label');
    });

    it('follow-up chips are keyboard accessible', () => {
      render(<IdeationChat {...defaultProps} />);
      const chip = screen.getByText('What authentication methods?');
      expect(chip).toHaveAttribute('role', 'button');
      expect(chip).toHaveAttribute('tabIndex', '0');
    });
  });
});
