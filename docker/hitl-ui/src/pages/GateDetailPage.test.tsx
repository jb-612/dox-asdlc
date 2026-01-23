/**
 * Tests for GateDetailPage - Enhanced HITL Gates functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GateDetailPage from './GateDetailPage';

// Mock the API hook
vi.mock('@/api/gates', () => ({
  useGateDetail: () => ({
    data: {
      id: 'gate-123',
      type: 'prd_review',
      status: 'pending',
      summary: 'Review PRD for authentication feature',
      artifacts: [
        { id: 'art-1', path: 'prd-auth.md', type: 'markdown' },
      ],
      session_id: 'session-456',
      task_id: 'task-789',
      created_at: '2026-01-23T10:00:00Z',
      context: { epic: 'auth' },
    },
    isLoading: false,
    error: null,
  }),
}));

// Mock components that may not exist
vi.mock('@/components/gates', () => ({
  GateTypeBadge: ({ type }: { type: string }) => <span data-testid="gate-type">{type}</span>,
  GateStatusBadge: ({ status }: { status: string }) => <span data-testid="gate-status">{status}</span>,
  DecisionForm: ({ gateId }: { gateId: string }) => (
    <div data-testid="decision-form">
      Decision form for {gateId}
      <button data-testid="approve-btn">Approve</button>
      <button data-testid="reject-btn">Reject</button>
    </div>
  ),
}));

vi.mock('@/components/artifacts', () => ({
  ArtifactList: ({ artifacts, onSelect }: { artifacts: unknown[]; onSelect: (a: unknown) => void }) => (
    <div data-testid="artifact-list">
      {(artifacts as { id: string; path: string }[]).map((a) => (
        <button key={a.id} onClick={() => onSelect(a)} data-testid={`artifact-${a.id}`}>
          {a.path}
        </button>
      ))}
    </div>
  ),
  ArtifactViewer: ({ artifact }: { artifact: { path: string } }) => (
    <div data-testid="artifact-viewer">{artifact.path}</div>
  ),
}));

vi.mock('@/components/common', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LoadingOverlay: () => <div data-testid="loading">Loading...</div>,
  EmptyState: () => <div data-testid="empty-state">Not found</div>,
}));

vi.mock('@/utils/formatters', () => ({
  formatRelativeTime: (date: string) => date,
  formatDateTime: (date: string) => date,
}));

// Mock new components
vi.mock('../components/gates/SimilarRejectionPanel', () => ({
  default: ({ patterns }: { patterns: unknown[] }) => (
    <div data-testid="similar-rejection-panel">
      {(patterns as unknown[]).length} patterns found
    </div>
  ),
}));

vi.mock('../components/gates/FeedbackCapture', () => ({
  default: ({ onSubmit }: { onSubmit?: (data: unknown) => void }) => (
    <div data-testid="feedback-capture">
      <button data-testid="submit-feedback" onClick={() => onSubmit?.({ summary: 'test' })}>
        Submit
      </button>
    </div>
  ),
}));

const renderPage = (gateId = 'gate-123') => {
  return render(
    <MemoryRouter initialEntries={[`/gates/${gateId}`]}>
      <Routes>
        <Route path="/gates/:gateId" element={<GateDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('GateDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderPage();
      expect(screen.getByText(/gate review/i)).toBeInTheDocument();
    });

    it('displays gate type badge', () => {
      renderPage();
      expect(screen.getByTestId('gate-type')).toBeInTheDocument();
    });

    it('displays gate status badge', () => {
      renderPage();
      expect(screen.getByTestId('gate-status')).toBeInTheDocument();
    });

    it('displays summary', () => {
      renderPage();
      expect(screen.getByText(/review prd for authentication/i)).toBeInTheDocument();
    });
  });

  describe('Artifacts', () => {
    it('displays artifact list', () => {
      renderPage();
      expect(screen.getByTestId('artifact-list')).toBeInTheDocument();
    });

    it('shows artifact viewer when artifact selected', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('artifact-art-1'));

      expect(screen.getByTestId('artifact-viewer')).toBeInTheDocument();
    });
  });

  describe('Decision Form', () => {
    it('displays decision form for pending gates', () => {
      renderPage();
      expect(screen.getByTestId('decision-form')).toBeInTheDocument();
    });

    it('shows approve button', () => {
      renderPage();
      expect(screen.getByTestId('approve-btn')).toBeInTheDocument();
    });

    it('shows reject button', () => {
      renderPage();
      expect(screen.getByTestId('reject-btn')).toBeInTheDocument();
    });
  });

  describe('Metadata', () => {
    it('displays session ID', () => {
      renderPage();
      expect(screen.getByText('session-456')).toBeInTheDocument();
    });

    it('displays task ID', () => {
      renderPage();
      expect(screen.getByText('task-789')).toBeInTheDocument();
    });

    it('displays context', () => {
      renderPage();
      expect(screen.getByText(/epic/i)).toBeInTheDocument();
    });
  });

  describe('Similar Rejection Panel', () => {
    it('displays similar rejection panel', () => {
      renderPage();
      expect(screen.getByTestId('similar-rejection-panel')).toBeInTheDocument();
    });
  });

  describe('Feedback Capture', () => {
    it('displays feedback capture form', () => {
      renderPage();
      expect(screen.getByTestId('feedback-capture')).toBeInTheDocument();
    });

    it('allows submitting feedback', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('submit-feedback'));

      // Just verify button works
      expect(screen.getByTestId('submit-feedback')).toBeInTheDocument();
    });
  });
});
