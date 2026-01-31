/**
 * Tests for StudioIdeationPage component (P05-F11 T17)
 *
 * 3-column layout page for PRD Ideation Studio:
 * - Session bar with title, save draft, data source selector, model select
 * - Chat panel with IdeationChat
 * - Maturity panel with MaturityTracker, CategoryProgress, GapsPanel
 * - Output panel with PRDPreviewPanel, UserStoriesList, SubmitPRDButton, GateStatusBanner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudioIdeationPage from './StudioIdeationPage';
import type { MaturityState, IdeationMessage, Requirement } from '../types/ideation';
import { MATURITY_LEVELS } from '../types/ideation';

// Mock ideation store
const mockStartSession = vi.fn();
const mockSendMessage = vi.fn();
const mockResetSession = vi.fn();
const mockSetDataSource = vi.fn();
const mockLoadSession = vi.fn();
const mockSetError = vi.fn();
const mockSubmitForPRD = vi.fn();
const mockSetProjectName = vi.fn();
const mockIdeationStore = {
  sessionId: null as string | null,
  projectName: '',
  projectStatus: 'draft' as const,
  dataSource: 'mock' as 'mock' | 'configured',
  messages: [] as IdeationMessage[],
  isLoading: false,
  maturity: {
    score: 0,
    level: MATURITY_LEVELS[0],
    categories: [],
    canSubmit: false,
    gaps: [],
  } as MaturityState,
  extractedRequirements: [] as Requirement[],
  userStories: [],
  prdDraft: null,
  submittedGateId: null,
  isSubmitting: false,
  error: null,
  startSession: mockStartSession,
  sendMessage: mockSendMessage,
  resetSession: mockResetSession,
  setDataSource: mockSetDataSource,
  loadSession: mockLoadSession,
  setError: mockSetError,
  submitForPRD: mockSubmitForPRD,
  setProjectName: mockSetProjectName,
};

vi.mock('../stores/ideationStore', () => ({
  useIdeationStore: (selector: (state: typeof mockIdeationStore) => unknown) =>
    selector(mockIdeationStore),
}));

// Mock LLM config API hooks
vi.mock('../api/llmConfig', () => ({
  useAgentConfigs: () => ({
    data: [
      {
        role: 'discovery',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKeyId: 'key-1',
        settings: { temperature: 0.7, maxTokens: 4096 },
        enabled: true,
      },
    ],
    isLoading: false,
    error: null,
  }),
  useModels: () => ({
    data: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 8192, costPer1MInput: 3, costPer1MOutput: 15 },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', maxContextTokens: 200000, maxOutputTokens: 8192, costPer1MInput: 15, costPer1MOutput: 75 },
    ],
    isLoading: false,
    error: null,
  }),
}));

// Mock ideation API
vi.mock('../api/ideation', () => ({
  saveIdeationDraft: vi.fn().mockResolvedValue(undefined),
  listIdeationDrafts: vi.fn().mockResolvedValue([]),
  updateProject: vi.fn().mockResolvedValue(undefined),
}));

// Create a query client for tests
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

// Wrapper for router and query client
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('StudioIdeationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdeationStore.sessionId = null;
    mockIdeationStore.projectName = '';
    mockIdeationStore.projectStatus = 'draft';
    mockIdeationStore.dataSource = 'mock';
    mockIdeationStore.messages = [];
    mockIdeationStore.isLoading = false;
    mockIdeationStore.maturity = {
      score: 0,
      level: MATURITY_LEVELS[0],
      categories: [],
      canSubmit: false,
      gaps: [],
    };
    mockIdeationStore.extractedRequirements = [];
    mockIdeationStore.userStories = [];
    mockIdeationStore.prdDraft = null;
    mockIdeationStore.submittedGateId = null;
    mockIdeationStore.isSubmitting = false;
    mockIdeationStore.error = null;
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('studio-ideation-page')).toBeInTheDocument();
    });

    it('renders page title', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByRole('heading', { name: /ideation studio/i })).toBeInTheDocument();
    });

    it('applies custom className', () => {
      renderWithProviders(<StudioIdeationPage className="my-custom-class" />);
      expect(screen.getByTestId('studio-ideation-page')).toHaveClass('my-custom-class');
    });
  });

  describe('Layout Structure', () => {
    it('renders 3-column layout', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('chat-column')).toBeInTheDocument();
      expect(screen.getByTestId('maturity-column')).toBeInTheDocument();
      expect(screen.getByTestId('output-column')).toBeInTheDocument();
    });

    it('renders session bar', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('session-bar')).toBeInTheDocument();
    });

    it('renders chat panel when session is active', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('ideation-chat')).toBeInTheDocument();
    });

    it('renders maturity tracker when session is active', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('maturity-tracker')).toBeInTheDocument();
    });

    it('renders output panel when session is active', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('output-panel')).toBeInTheDocument();
    });
  });

  describe('Session Bar', () => {
    it('shows project title input', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByPlaceholderText(/project name/i)).toBeInTheDocument();
    });

    it('shows Save Draft button', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    });

    it('shows model selector', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('model-selector')).toBeInTheDocument();
    });

    it('Save Draft button is disabled when no session', () => {
      mockIdeationStore.sessionId = null;
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
    });

    it('Save Draft button is enabled when session is active', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByRole('button', { name: /save draft/i })).not.toBeDisabled();
    });
  });

  describe('Data Source Selector', () => {
    it('renders data source selector', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('data-source-selector')).toBeInTheDocument();
    });

    it('defaults to Mock mode', () => {
      renderWithProviders(<StudioIdeationPage />);
      const dataSourceSelect = screen.getByLabelText('Data source') as HTMLSelectElement;
      expect(dataSourceSelect.value).toBe('mock');
    });

    it('shows Mock and Configured LLM options', () => {
      renderWithProviders(<StudioIdeationPage />);
      const dataSourceSelect = screen.getByLabelText('Data source');
      const options = dataSourceSelect.querySelectorAll('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveValue('mock');
      expect(options[0]).toHaveTextContent('Mock Mode');
      expect(options[1]).toHaveValue('configured');
      expect(options[1]).toHaveTextContent('Configured LLM');
    });

    it('does not show configured model display in Mock mode', () => {
      renderWithProviders(<StudioIdeationPage />);
      // In mock mode, no model display text should appear
      expect(screen.queryByText(/Anthropic:/i)).not.toBeInTheDocument();
    });

    it('shows configured model display when Configured LLM is selected', async () => {
      mockIdeationStore.dataSource = 'configured';
      renderWithProviders(<StudioIdeationPage />);

      // When configured mode is selected, it shows a text display of the configured model
      // instead of a dropdown (since the model is admin-configured)
      await waitFor(() => {
        expect(screen.getByText(/Anthropic: Claude Sonnet 4/i)).toBeInTheDocument();
      });
    });

    it('calls setDataSource when switching to Configured LLM', async () => {
      renderWithProviders(<StudioIdeationPage />);

      const dataSourceSelect = screen.getByLabelText('Data source');
      fireEvent.change(dataSourceSelect, { target: { value: 'configured' } });

      await waitFor(() => {
        expect(mockSetDataSource).toHaveBeenCalledWith('configured');
      });
    });

    it('persists data source selector when session is active', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('data-source-selector')).toBeInTheDocument();
    });
  });

  describe('Session Initialization', () => {
    it('shows start session view when no session', () => {
      mockIdeationStore.sessionId = null;
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByText(/start a new ideation session/i)).toBeInTheDocument();
    });

    it('has start session button', () => {
      mockIdeationStore.sessionId = null;
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByRole('button', { name: /start session/i })).toBeInTheDocument();
    });

    it('start session button is disabled without project name', () => {
      mockIdeationStore.sessionId = null;
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
    });

    it('calls startSession when start button clicked with project name', async () => {
      mockIdeationStore.sessionId = null;
      renderWithProviders(<StudioIdeationPage />);

      const input = screen.getByPlaceholderText(/project name/i);
      fireEvent.change(input, { target: { value: 'My New Project' } });
      fireEvent.click(screen.getByRole('button', { name: /start session/i }));

      await waitFor(() => {
        expect(mockStartSession).toHaveBeenCalledWith('My New Project');
      });
    });
  });

  describe('Maturity Panel', () => {
    beforeEach(() => {
      mockIdeationStore.sessionId = 'test-session';
      mockIdeationStore.maturity = {
        score: 45,
        level: MATURITY_LEVELS[2],
        categories: [
          { id: 'problem', name: 'Problem Statement', score: 60, weight: 15, requiredForSubmit: true, sections: [] },
          { id: 'functional', name: 'Functional Requirements', score: 30, weight: 25, requiredForSubmit: true, sections: [] },
        ],
        canSubmit: false,
        gaps: ['Functional Requirements needs more detail'],
      };
    });

    it('displays maturity score', () => {
      renderWithProviders(<StudioIdeationPage />);
      // Use testid since 45% appears in both MaturityTracker and SubmitPRDButton
      expect(screen.getByTestId('maturity-percentage')).toHaveTextContent('45%');
    });

    it('displays category progress', () => {
      renderWithProviders(<StudioIdeationPage />);
      // Categories show up in both CategoryProgress components and GapsPanel
      expect(screen.getAllByText('Problem Statement').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Functional Requirements').length).toBeGreaterThanOrEqual(1);
    });

    it('displays gaps panel', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('gaps-panel')).toBeInTheDocument();
    });

    it('displays requirements list', () => {
      mockIdeationStore.extractedRequirements = [
        { id: 'req-1', description: 'Test requirement', type: 'functional', priority: 'must_have', categoryId: 'functional', createdAt: new Date().toISOString() },
      ];
      renderWithProviders(<StudioIdeationPage />);
      // RequirementsList is present and shows the requirement
      expect(screen.getByText('Test requirement')).toBeInTheDocument();
    });
  });

  describe('Output Panel', () => {
    beforeEach(() => {
      mockIdeationStore.sessionId = 'test-session';
    });

    it('displays PRD preview panel empty state when no PRD', () => {
      renderWithProviders(<StudioIdeationPage />);
      // PRDPreviewPanel shows empty-state when no prdDocument
      expect(screen.getByText(/no prd generated yet/i)).toBeInTheDocument();
    });

    it('displays PRD preview panel when PRD exists', () => {
      mockIdeationStore.prdDraft = {
        id: 'prd-1',
        title: 'Test PRD',
        version: '1.0',
        sections: [{ id: 'sec-1', heading: 'Overview', content: 'Test content', order: 1 }],
        createdAt: new Date().toISOString(),
        status: 'draft',
      };
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('prd-preview-panel')).toBeInTheDocument();
      expect(screen.getByText('Test PRD')).toBeInTheDocument();
    });

    it('displays user stories list', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('user-stories-list')).toBeInTheDocument();
    });

    it('displays submit PRD button', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('submit-prd-button')).toBeInTheDocument();
    });

    it('displays gate status banner when submitted', () => {
      mockIdeationStore.submittedGateId = 'gate-123';
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('gate-status-banner')).toBeInTheDocument();
    });

    it('hides gate status banner when not submitted', () => {
      mockIdeationStore.submittedGateId = null;
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.queryByTestId('gate-status-banner')).not.toBeInTheDocument();
    });
  });

  describe('Gaps Panel Integration', () => {
    beforeEach(() => {
      mockIdeationStore.sessionId = 'test-session';
    });

    it('handles Ask about this from GapsPanel', async () => {
      mockIdeationStore.maturity = {
        score: 30,
        level: MATURITY_LEVELS[1],
        categories: [
          { id: 'problem', name: 'Problem Statement', score: 10, weight: 15, requiredForSubmit: true, sections: [] },
        ],
        canSubmit: false,
        gaps: ['Problem Statement has not been addressed'],
      };

      renderWithProviders(<StudioIdeationPage />);

      // Find the "Ask about this" button in GapsPanel
      const askButtons = screen.getAllByRole('button', { name: /ask about this/i });
      if (askButtons.length > 0) {
        fireEvent.click(askButtons[0]);
        // Should send the suggested question to chat
        await waitFor(() => {
          expect(mockSendMessage).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when isLoading', () => {
      mockIdeationStore.sessionId = 'test-session';
      mockIdeationStore.isLoading = true;
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('ideation-chat-loading')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error toast when error exists', () => {
      mockIdeationStore.sessionId = 'test-session';
      mockIdeationStore.error = 'Something went wrong';
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('renders collapse buttons for columns', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByTestId('collapse-maturity-btn')).toBeInTheDocument();
      expect(screen.getByTestId('collapse-output-btn')).toBeInTheDocument();
    });

    it('can collapse maturity panel', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithProviders(<StudioIdeationPage />);
      fireEvent.click(screen.getByTestId('collapse-maturity-btn'));
      expect(screen.getByTestId('maturity-column')).toHaveClass('collapsed');
    });

    it('can collapse output panel', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithProviders(<StudioIdeationPage />);
      fireEvent.click(screen.getByTestId('collapse-output-btn'));
      expect(screen.getByTestId('output-column')).toHaveClass('collapsed');
    });
  });

  describe('Accessibility', () => {
    it('has main landmark', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('has proper heading hierarchy', () => {
      renderWithProviders(<StudioIdeationPage />);
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent(/ideation studio/i);
    });

    it('project input has accessible label', () => {
      renderWithProviders(<StudioIdeationPage />);
      const input = screen.getByPlaceholderText(/project name/i);
      expect(input).toHaveAttribute('aria-label');
    });

    it('data source selector has accessible label', () => {
      renderWithProviders(<StudioIdeationPage />);
      const select = screen.getByLabelText('Data source');
      expect(select).toBeInTheDocument();
    });

    it('data source selector has Mock Mode option', () => {
      renderWithProviders(<StudioIdeationPage />);
      const select = screen.getByLabelText('Data source');
      expect(select.querySelector('option[value="mock"]')).toBeInTheDocument();
    });
  });

  describe('Project Name Rename', () => {
    beforeEach(() => {
      mockIdeationStore.sessionId = 'test-session';
      mockIdeationStore.projectName = 'Original Project';
    });

    it('displays project name in session bar', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByText('Original Project')).toBeInTheDocument();
    });

    it('shows edit button next to project name', () => {
      renderWithProviders(<StudioIdeationPage />);
      expect(screen.getByRole('button', { name: /edit project name/i })).toBeInTheDocument();
    });

    it('enters edit mode when clicking edit button', () => {
      renderWithProviders(<StudioIdeationPage />);
      fireEvent.click(screen.getByRole('button', { name: /edit project name/i }));
      expect(screen.getByRole('textbox', { name: /edit project name/i })).toBeInTheDocument();
    });

    it('pre-fills input with current project name in edit mode', () => {
      renderWithProviders(<StudioIdeationPage />);
      fireEvent.click(screen.getByRole('button', { name: /edit project name/i }));
      const input = screen.getByRole('textbox', { name: /edit project name/i }) as HTMLInputElement;
      expect(input.value).toBe('Original Project');
    });

    it('shows save and cancel buttons in edit mode', () => {
      renderWithProviders(<StudioIdeationPage />);
      fireEvent.click(screen.getByRole('button', { name: /edit project name/i }));
      expect(screen.getByRole('button', { name: /save project name/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel editing/i })).toBeInTheDocument();
    });

    it('cancels edit mode when clicking cancel button', () => {
      renderWithProviders(<StudioIdeationPage />);
      fireEvent.click(screen.getByRole('button', { name: /edit project name/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel editing/i }));
      // Should show project name text again, not input
      expect(screen.getByText('Original Project')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /edit project name/i })).not.toBeInTheDocument();
    });

    it('cancels edit mode when pressing Escape', () => {
      renderWithProviders(<StudioIdeationPage />);
      fireEvent.click(screen.getByRole('button', { name: /edit project name/i }));
      const input = screen.getByRole('textbox', { name: /edit project name/i });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByRole('textbox', { name: /edit project name/i })).not.toBeInTheDocument();
    });

    it('calls setProjectName and API when saving new name', async () => {
      renderWithProviders(<StudioIdeationPage />);
      fireEvent.click(screen.getByRole('button', { name: /edit project name/i }));
      const input = screen.getByRole('textbox', { name: /edit project name/i });
      fireEvent.change(input, { target: { value: 'New Project Name' } });
      fireEvent.click(screen.getByRole('button', { name: /save project name/i }));

      await waitFor(() => {
        expect(mockSetProjectName).toHaveBeenCalledWith('New Project Name');
      });
    });

    it('saves when pressing Enter', async () => {
      renderWithProviders(<StudioIdeationPage />);
      fireEvent.click(screen.getByRole('button', { name: /edit project name/i }));
      const input = screen.getByRole('textbox', { name: /edit project name/i });
      fireEvent.change(input, { target: { value: 'New Project Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockSetProjectName).toHaveBeenCalledWith('New Project Name');
      });
    });

    it('does not save if name is unchanged', async () => {
      renderWithProviders(<StudioIdeationPage />);
      fireEvent.click(screen.getByRole('button', { name: /edit project name/i }));
      fireEvent.click(screen.getByRole('button', { name: /save project name/i }));

      await waitFor(() => {
        expect(mockSetProjectName).not.toHaveBeenCalled();
      });
    });

    it('does not save if name is empty', async () => {
      renderWithProviders(<StudioIdeationPage />);
      fireEvent.click(screen.getByRole('button', { name: /edit project name/i }));
      const input = screen.getByRole('textbox', { name: /edit project name/i });
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /save project name/i }));

      await waitFor(() => {
        expect(mockSetProjectName).not.toHaveBeenCalled();
      });
    });
  });
});
