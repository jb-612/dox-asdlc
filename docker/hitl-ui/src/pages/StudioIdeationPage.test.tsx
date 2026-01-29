/**
 * Tests for StudioIdeationPage component (P05-F11 T17)
 *
 * 3-column layout page for PRD Ideation Studio:
 * - Session bar with title, save draft, model select
 * - Chat panel with IdeationChat
 * - Maturity panel with MaturityTracker, CategoryProgress, GapsPanel
 * - Output panel with PRDPreviewPanel, UserStoriesList, SubmitPRDButton, GateStatusBanner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StudioIdeationPage from './StudioIdeationPage';
import type { MaturityState, IdeationMessage, Requirement } from '../types/ideation';
import { MATURITY_LEVELS } from '../types/ideation';

// Mock ideation store
const mockStartSession = vi.fn();
const mockSendMessage = vi.fn();
const mockResetSession = vi.fn();
const mockIdeationStore = {
  sessionId: null as string | null,
  projectName: '',
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
};

vi.mock('../stores/ideationStore', () => ({
  useIdeationStore: (selector: (state: typeof mockIdeationStore) => unknown) =>
    selector(mockIdeationStore),
}));

// Mock ideation API
vi.mock('../api/ideation', () => ({
  saveIdeationDraft: vi.fn().mockResolvedValue(undefined),
  listIdeationDrafts: vi.fn().mockResolvedValue([]),
}));

// Wrapper for router
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('StudioIdeationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdeationStore.sessionId = null;
    mockIdeationStore.projectName = '';
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
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('studio-ideation-page')).toBeInTheDocument();
    });

    it('renders page title', () => {
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByRole('heading', { name: /ideation studio/i })).toBeInTheDocument();
    });

    it('applies custom className', () => {
      renderWithRouter(<StudioIdeationPage className="my-custom-class" />);
      expect(screen.getByTestId('studio-ideation-page')).toHaveClass('my-custom-class');
    });
  });

  describe('Layout Structure', () => {
    it('renders 3-column layout', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('chat-column')).toBeInTheDocument();
      expect(screen.getByTestId('maturity-column')).toBeInTheDocument();
      expect(screen.getByTestId('output-column')).toBeInTheDocument();
    });

    it('renders session bar', () => {
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('session-bar')).toBeInTheDocument();
    });

    it('renders chat panel when session is active', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('ideation-chat')).toBeInTheDocument();
    });

    it('renders maturity tracker when session is active', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('maturity-tracker')).toBeInTheDocument();
    });

    it('renders output panel when session is active', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('output-panel')).toBeInTheDocument();
    });
  });

  describe('Session Bar', () => {
    it('shows project title input', () => {
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByPlaceholderText(/project name/i)).toBeInTheDocument();
    });

    it('shows Save Draft button', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    });

    it('shows model selector', () => {
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('model-selector')).toBeInTheDocument();
    });

    it('Save Draft button is disabled when no session', () => {
      mockIdeationStore.sessionId = null;
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
    });

    it('Save Draft button is enabled when session is active', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByRole('button', { name: /save draft/i })).not.toBeDisabled();
    });
  });

  describe('Session Initialization', () => {
    it('shows start session view when no session', () => {
      mockIdeationStore.sessionId = null;
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByText(/start a new ideation session/i)).toBeInTheDocument();
    });

    it('has start session button', () => {
      mockIdeationStore.sessionId = null;
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByRole('button', { name: /start session/i })).toBeInTheDocument();
    });

    it('start session button is disabled without project name', () => {
      mockIdeationStore.sessionId = null;
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
    });

    it('calls startSession when start button clicked with project name', async () => {
      mockIdeationStore.sessionId = null;
      renderWithRouter(<StudioIdeationPage />);

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
      renderWithRouter(<StudioIdeationPage />);
      // Use testid since 45% appears in both MaturityTracker and SubmitPRDButton
      expect(screen.getByTestId('maturity-percentage')).toHaveTextContent('45%');
    });

    it('displays category progress', () => {
      renderWithRouter(<StudioIdeationPage />);
      // Categories show up in both CategoryProgress components and GapsPanel
      expect(screen.getAllByText('Problem Statement').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Functional Requirements').length).toBeGreaterThanOrEqual(1);
    });

    it('displays gaps panel', () => {
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('gaps-panel')).toBeInTheDocument();
    });

    it('displays requirements list', () => {
      mockIdeationStore.extractedRequirements = [
        { id: 'req-1', description: 'Test requirement', type: 'functional', priority: 'must_have', categoryId: 'functional', createdAt: new Date().toISOString() },
      ];
      renderWithRouter(<StudioIdeationPage />);
      // RequirementsList is present and shows the requirement
      expect(screen.getByText('Test requirement')).toBeInTheDocument();
    });
  });

  describe('Output Panel', () => {
    beforeEach(() => {
      mockIdeationStore.sessionId = 'test-session';
    });

    it('displays PRD preview panel empty state when no PRD', () => {
      renderWithRouter(<StudioIdeationPage />);
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
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('prd-preview-panel')).toBeInTheDocument();
      expect(screen.getByText('Test PRD')).toBeInTheDocument();
    });

    it('displays user stories list', () => {
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('user-stories-list')).toBeInTheDocument();
    });

    it('displays submit PRD button', () => {
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('submit-prd-button')).toBeInTheDocument();
    });

    it('displays gate status banner when submitted', () => {
      mockIdeationStore.submittedGateId = 'gate-123';
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('gate-status-banner')).toBeInTheDocument();
    });

    it('hides gate status banner when not submitted', () => {
      mockIdeationStore.submittedGateId = null;
      renderWithRouter(<StudioIdeationPage />);
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

      renderWithRouter(<StudioIdeationPage />);

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
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('ideation-chat-loading')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error toast when error exists', () => {
      mockIdeationStore.sessionId = 'test-session';
      mockIdeationStore.error = 'Something went wrong';
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('renders collapse buttons for columns', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByTestId('collapse-maturity-btn')).toBeInTheDocument();
      expect(screen.getByTestId('collapse-output-btn')).toBeInTheDocument();
    });

    it('can collapse maturity panel', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithRouter(<StudioIdeationPage />);
      fireEvent.click(screen.getByTestId('collapse-maturity-btn'));
      expect(screen.getByTestId('maturity-column')).toHaveClass('collapsed');
    });

    it('can collapse output panel', () => {
      mockIdeationStore.sessionId = 'test-session';
      renderWithRouter(<StudioIdeationPage />);
      fireEvent.click(screen.getByTestId('collapse-output-btn'));
      expect(screen.getByTestId('output-column')).toHaveClass('collapsed');
    });
  });

  describe('Accessibility', () => {
    it('has main landmark', () => {
      renderWithRouter(<StudioIdeationPage />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('has proper heading hierarchy', () => {
      renderWithRouter(<StudioIdeationPage />);
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent(/ideation studio/i);
    });

    it('project input has accessible label', () => {
      renderWithRouter(<StudioIdeationPage />);
      const input = screen.getByPlaceholderText(/project name/i);
      expect(input).toHaveAttribute('aria-label');
    });
  });
});
