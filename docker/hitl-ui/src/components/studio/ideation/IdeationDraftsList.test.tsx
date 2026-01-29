/**
 * Tests for IdeationDraftsList component (P05-F11 T19)
 *
 * Features:
 * - List saved drafts with name, date, maturity score
 * - "Resume" button to load draft into store
 * - "Delete" button with confirmation
 * - Empty state when no drafts
 * - Loading state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IdeationDraftsList from './IdeationDraftsList';

// Mock API functions
const mockListDrafts = vi.fn();
const mockDeleteDraft = vi.fn();
const mockLoadDraft = vi.fn();

vi.mock('../../../api/ideation', () => ({
  listIdeationDrafts: () => mockListDrafts(),
  deleteIdeationDraft: (sessionId: string) => mockDeleteDraft(sessionId),
  loadIdeationDraft: (sessionId: string) => mockLoadDraft(sessionId),
}));

describe('IdeationDraftsList', () => {
  const mockDrafts = [
    {
      sessionId: 'draft-1',
      projectName: 'Authentication System',
      maturityScore: 65,
      lastModified: '2026-01-28T10:00:00Z',
    },
    {
      sessionId: 'draft-2',
      projectName: 'E-commerce Platform',
      maturityScore: 85,
      lastModified: '2026-01-27T15:30:00Z',
    },
    {
      sessionId: 'draft-3',
      projectName: 'Analytics Dashboard',
      maturityScore: 30,
      lastModified: '2026-01-26T09:15:00Z',
    },
  ];

  const defaultProps = {
    onResume: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockListDrafts.mockResolvedValue(mockDrafts);
    mockDeleteDraft.mockResolvedValue(undefined);
    mockLoadDraft.mockResolvedValue({
      messages: [],
      maturity: { score: 65, level: { level: 'refined' }, categories: [], canSubmit: false, gaps: [] },
      requirements: [],
    });
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('ideation-drafts-list')).toBeInTheDocument();
      });
    });

    it('applies custom className', async () => {
      render(<IdeationDraftsList {...defaultProps} className="my-custom-class" />);
      await waitFor(() => {
        expect(screen.getByTestId('ideation-drafts-list')).toHaveClass('my-custom-class');
      });
    });

    it('shows title', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/saved drafts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading state while fetching drafts', () => {
      mockListDrafts.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<IdeationDraftsList {...defaultProps} />);
      expect(screen.getByTestId('drafts-loading')).toBeInTheDocument();
    });

    it('shows skeleton cards while loading', () => {
      mockListDrafts.mockImplementation(() => new Promise(() => {}));
      render(<IdeationDraftsList {...defaultProps} />);
      expect(screen.getByTestId('drafts-loading')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no drafts', async () => {
      mockListDrafts.mockResolvedValue([]);
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });

    it('shows helpful message in empty state', async () => {
      mockListDrafts.mockResolvedValue([]);
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/no saved drafts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Draft List Display', () => {
    it('displays all drafts', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Authentication System')).toBeInTheDocument();
        expect(screen.getByText('E-commerce Platform')).toBeInTheDocument();
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      });
    });

    it('shows maturity score for each draft', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/65%/)).toBeInTheDocument();
        expect(screen.getByText(/85%/)).toBeInTheDocument();
        expect(screen.getByText(/30%/)).toBeInTheDocument();
      });
    });

    it('shows last modified date for each draft', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        // Dates are formatted, so check for partial content
        expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
      });
    });

    it('shows draft count', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/3 drafts?/i)).toBeInTheDocument();
      });
    });
  });

  describe('Resume Button', () => {
    it('shows Resume button for each draft', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        const resumeButtons = screen.getAllByRole('button', { name: /resume/i });
        expect(resumeButtons).toHaveLength(3);
      });
    });

    it('calls onResume when Resume button clicked', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Authentication System')).toBeInTheDocument();
      });

      const resumeButtons = screen.getAllByRole('button', { name: /resume/i });
      fireEvent.click(resumeButtons[0]);

      await waitFor(() => {
        expect(mockLoadDraft).toHaveBeenCalledWith('draft-1');
        expect(defaultProps.onResume).toHaveBeenCalled();
      });
    });

    it('disables Resume button while loading draft', async () => {
      mockLoadDraft.mockImplementation(() => new Promise(() => {}));
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Authentication System')).toBeInTheDocument();
      });

      const resumeButtons = screen.getAllByRole('button', { name: /resume/i });
      fireEvent.click(resumeButtons[0]);

      await waitFor(() => {
        expect(resumeButtons[0]).toBeDisabled();
      });
    });
  });

  describe('Delete Button', () => {
    it('shows Delete button for each draft', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        expect(deleteButtons).toHaveLength(3);
      });
    });

    it('shows confirmation dialog when Delete clicked', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Authentication System')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/confirm delete/i)).toBeInTheDocument();
      });
    });

    it('deletes draft when confirmed', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Authentication System')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/confirm delete/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteDraft).toHaveBeenCalledWith('draft-1');
      });
    });

    it('cancels delete when cancelled', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Authentication System')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/confirm delete/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockDeleteDraft).not.toHaveBeenCalled();
        expect(screen.queryByText(/confirm delete/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error when loading fails', async () => {
      mockListDrafts.mockRejectedValue(new Error('Network error'));
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/failed to load drafts/i)).toBeInTheDocument();
      });
    });

    it('shows error when delete fails', async () => {
      mockDeleteDraft.mockRejectedValue(new Error('Delete failed'));
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Authentication System')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm/i });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/failed to delete/i)).toBeInTheDocument();
      });
    });
  });

  describe('Refresh', () => {
    it('has refresh button', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });
    });

    it('reloads drafts when refresh clicked', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Authentication System')).toBeInTheDocument();
      });

      expect(mockListDrafts).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

      await waitFor(() => {
        expect(mockListDrafts).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible list structure', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByRole('list')).toBeInTheDocument();
      });
    });

    it('buttons have accessible names', async () => {
      render(<IdeationDraftsList {...defaultProps} />);
      await waitFor(() => {
        const resumeButtons = screen.getAllByRole('button', { name: /resume/i });
        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        expect(resumeButtons.length).toBe(3);
        expect(deleteButtons.length).toBe(3);
      });
    });
  });
});
