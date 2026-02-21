/**
 * Tests for StudioDiscoveryPage component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StudioDiscoveryPage from './StudioDiscoveryPage';

// Mock store
const mockStudioStore = {
  messages: [] as Array<{ id: string; role: string; content: string; timestamp: string }>,
  workingOutline: [] as Array<{ id: string; title: string; status: string; content?: string }>,
  artifacts: [] as Array<{
    id: string;
    name: string;
    type: string;
    status: 'valid' | 'pending_review' | 'invalid';
    createdAt: string;
    preview: string;
    validationError?: string;
  }>,
  isStreaming: false,
  addMessage: vi.fn(),
  setStreaming: vi.fn(),
  updateOutline: vi.fn(),
  addArtifact: vi.fn(),
};

vi.mock('../stores/studioStore', () => ({
  useStudioStore: (selector: (state: typeof mockStudioStore) => unknown) => selector(mockStudioStore),
}));

// Mock API
const mockSendMessage = vi.fn();
vi.mock('../api/studio', () => ({
  sendChatMessage: (params: { message: string }) => mockSendMessage(params),
}));

// Wrapper component
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('StudioDiscoveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudioStore.messages = [];
    mockStudioStore.workingOutline = [];
    mockStudioStore.artifacts = [];
    mockStudioStore.isStreaming = false;
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByTestId('studio-discovery-page')).toBeInTheDocument();
    });

    it('renders page title', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByRole('heading', { name: /discovery studio/i })).toBeInTheDocument();
    });

    it('applies custom className', () => {
      renderWithRouter(<StudioDiscoveryPage className="my-custom-class" />);
      expect(screen.getByTestId('studio-discovery-page')).toHaveClass('my-custom-class');
    });
  });

  describe('Layout Structure', () => {
    it('renders 3-column layout', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByTestId('chat-column')).toBeInTheDocument();
      expect(screen.getByTestId('outline-column')).toBeInTheDocument();
      expect(screen.getByTestId('output-column')).toBeInTheDocument();
    });

    it('renders chat panel', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
    });

    it('renders outline panel', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByTestId('working-outline-panel')).toBeInTheDocument();
    });

    it('renders output panel', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByTestId('output-quickview-panel')).toBeInTheDocument();
    });
  });

  describe('Chat Integration', () => {
    it('displays messages from store', () => {
      mockStudioStore.messages = [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: '2026-01-23T10:00:00Z' },
        { id: 'msg-2', role: 'assistant', content: 'Hi there!', timestamp: '2026-01-23T10:00:01Z' },
      ];
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });

    it('shows streaming indicator when streaming', () => {
      mockStudioStore.isStreaming = true;
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
    });

    it('handles message send', async () => {
      mockSendMessage.mockResolvedValueOnce({
        message: { id: 'msg-2', role: 'assistant', content: 'Response', timestamp: new Date().toISOString() },
        outline_update: null,
        artifacts: [],
      });
      renderWithRouter(<StudioDiscoveryPage />);

      const input = screen.getByTestId('chat-input');
      const sendButton = screen.getByTestId('send-button');

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockStudioStore.addMessage).toHaveBeenCalled();
      });
    });
  });

  describe('Outline Integration', () => {
    it('displays outline sections from store', () => {
      mockStudioStore.workingOutline = [
        { id: 'sec-1', title: 'Overview', status: 'complete' },
        { id: 'sec-2', title: 'Requirements', status: 'in_progress' },
      ];
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Requirements')).toBeInTheDocument();
    });

    it('shows empty state when no outline', () => {
      mockStudioStore.workingOutline = [];
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByText(/no outline/i)).toBeInTheDocument();
    });

    it('updates completeness indicator', () => {
      mockStudioStore.workingOutline = [
        { id: 'sec-1', title: 'Overview', status: 'complete' },
        { id: 'sec-2', title: 'Requirements', status: 'complete' },
        { id: 'sec-3', title: 'Scope', status: 'pending' },
      ];
      renderWithRouter(<StudioDiscoveryPage />);
      // 2 out of 3 complete = 67%
      expect(screen.getByText(/67%/)).toBeInTheDocument();
    });
  });

  describe('Output Integration', () => {
    it('displays artifacts from store', () => {
      mockStudioStore.artifacts = [
        {
          id: 'art-1',
          name: 'prd-draft.md',
          type: 'markdown',
          status: 'valid',
          createdAt: '2026-01-23T10:00:00Z',
          preview: 'Product requirements document draft',
        },
        {
          id: 'art-2',
          name: 'requirements.json',
          type: 'json',
          status: 'pending_review',
          createdAt: '2026-01-23T10:00:00Z',
          preview: 'Requirements data in JSON format',
        },
      ];
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByText('prd-draft.md')).toBeInTheDocument();
      expect(screen.getByText('requirements.json')).toBeInTheDocument();
    });

    it('shows empty state when no artifacts', () => {
      mockStudioStore.artifacts = [];
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByText(/no outputs/i)).toBeInTheDocument();
    });
  });

  describe('Model Selector', () => {
    it('shows model selector in header', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByTestId('model-cost-selector')).toBeInTheDocument();
    });

    it('shows cost estimate based on selected model', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      // Multiple cost-estimate elements exist (model selector + context pack)
      const estimates = screen.getAllByTestId('cost-estimate');
      expect(estimates.length).toBeGreaterThan(0);
    });
  });

  describe('Context Pack', () => {
    it('shows context pack preview', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByTestId('context-pack-preview')).toBeInTheDocument();
    });
  });

  describe('Page Actions', () => {
    it('shows Preview PRD button', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      // Multiple Preview PRD buttons exist (page header + outline panel)
      const buttons = screen.getAllByRole('button', { name: /preview prd/i });
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('shows Save Draft button', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      // Multiple Save Draft buttons exist (page header + outline panel)
      const buttons = screen.getAllByRole('button', { name: /save draft/i });
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('Preview PRD button is disabled when no outline', () => {
      mockStudioStore.workingOutline = [];
      renderWithRouter(<StudioDiscoveryPage />);
      // Check the first Preview PRD button (header)
      const buttons = screen.getAllByRole('button', { name: /preview prd/i });
      expect(buttons[0]).toBeDisabled();
    });

    it('Save Draft button is disabled when no content', () => {
      mockStudioStore.messages = [];
      mockStudioStore.workingOutline = [];
      renderWithRouter(<StudioDiscoveryPage />);
      // Check the first Save Draft button (header)
      const buttons = screen.getAllByRole('button', { name: /save draft/i });
      expect(buttons[0]).toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading prop is true', () => {
      renderWithRouter(<StudioDiscoveryPage isLoading />);
      expect(screen.getByTestId('page-loading')).toBeInTheDocument();
    });

    it('shows skeleton for chat panel when loading', () => {
      renderWithRouter(<StudioDiscoveryPage isLoading />);
      expect(screen.getByTestId('chat-skeleton')).toBeInTheDocument();
    });

    it('shows skeleton for outline panel when loading', () => {
      renderWithRouter(<StudioDiscoveryPage isLoading />);
      expect(screen.getByTestId('outline-skeleton')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('renders collapsible panels for mobile', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      // On smaller screens, outline and output can be collapsed
      expect(screen.getByTestId('collapse-outline-btn')).toBeInTheDocument();
      expect(screen.getByTestId('collapse-output-btn')).toBeInTheDocument();
    });

    it('can collapse outline panel', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      fireEvent.click(screen.getByTestId('collapse-outline-btn'));
      expect(screen.getByTestId('outline-column')).toHaveClass('collapsed');
    });

    it('can collapse output panel', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      fireEvent.click(screen.getByTestId('collapse-output-btn'));
      expect(screen.getByTestId('output-column')).toHaveClass('collapsed');
    });
  });

  describe('Session Info', () => {
    it('shows session info bar', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByTestId('session-info')).toBeInTheDocument();
    });

    it('shows epic name if available', () => {
      renderWithRouter(<StudioDiscoveryPage epicName="User Authentication" />);
      expect(screen.getByText('User Authentication')).toBeInTheDocument();
    });

    it('shows environment indicator', () => {
      renderWithRouter(<StudioDiscoveryPage environment="development" />);
      expect(screen.getByText(/development/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error state when API fails', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('API Error'));
      renderWithRouter(<StudioDiscoveryPage />);

      const input = screen.getByTestId('chat-input');
      const sendButton = screen.getByTestId('send-button');

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-toast')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('focuses chat input on Ctrl+/', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      fireEvent.keyDown(document, { key: '/', ctrlKey: true });
      expect(screen.getByTestId('chat-input')).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('has main landmark', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('has proper heading hierarchy', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent(/discovery studio/i);
    });

    it('chat input has accessible label', () => {
      renderWithRouter(<StudioDiscoveryPage />);
      const input = screen.getByTestId('chat-input');
      expect(input).toHaveAttribute('aria-label');
    });
  });
});
