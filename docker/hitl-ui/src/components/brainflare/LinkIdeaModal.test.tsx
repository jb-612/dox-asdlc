/**
 * Tests for LinkIdeaModal component (P08-F05 T28)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { LinkIdeaModal } from './LinkIdeaModal';
import type { Idea } from '../../types/ideas';

// Mock the API modules
vi.mock('../../api/ideas', () => ({
  fetchIdeas: vi.fn(),
}));

vi.mock('../../api/correlations', () => ({
  createCorrelation: vi.fn(),
}));

import { fetchIdeas } from '../../api/ideas';
import { createCorrelation } from '../../api/correlations';

const mockSourceIdea: Idea = {
  id: 'idea-001',
  content: 'This is the source idea for testing',
  author_id: 'user-1',
  author_name: 'Test User',
  status: 'active',
  classification: 'functional',
  labels: ['test'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  word_count: 8,
};

const mockOtherIdeas: Idea[] = [
  {
    id: 'idea-002',
    content: 'Another idea to link to',
    author_id: 'user-2',
    author_name: 'Another User',
    status: 'active',
    classification: 'non_functional',
    labels: [],
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    word_count: 5,
  },
  {
    id: 'idea-003',
    content: 'Third idea for selection',
    author_id: 'user-1',
    author_name: 'Test User',
    status: 'active',
    classification: 'functional',
    labels: [],
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
    word_count: 4,
  },
];

describe('LinkIdeaModal', () => {
  const mockOnClose = vi.fn();
  const mockOnLinked = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    (fetchIdeas as ReturnType<typeof vi.fn>).mockResolvedValue({
      ideas: [...mockOtherIdeas, mockSourceIdea],
      total: 3,
      limit: 100,
      offset: 0,
    });
    (createCorrelation as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('renders modal with source idea content', async () => {
    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    expect(screen.getByTestId('link-idea-modal')).toBeInTheDocument();
    expect(screen.getByText('Link Idea')).toBeInTheDocument();
    expect(screen.getByText(mockSourceIdea.content)).toBeInTheDocument();
  });

  it('loads and displays available ideas excluding source', async () => {
    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    // Wait for ideas to load
    await waitFor(() => {
      expect(screen.queryByTestId('loading-ideas')).not.toBeInTheDocument();
    });

    // Check that select exists
    const targetSelect = screen.getByLabelText(/to/i);
    expect(targetSelect).toBeInTheDocument();

    // Verify the select has options (placeholder + ideas)
    // We check that the select is enabled and has options
    expect(targetSelect).not.toBeDisabled();

    // Verify source idea is excluded - try to select it should fail
    // The options should not include source idea-001
    const options = targetSelect.querySelectorAll('option');
    const optionValues = Array.from(options).map((o) => o.getAttribute('value'));
    expect(optionValues).not.toContain('idea-001');
    expect(optionValues).toContain('idea-002');
    expect(optionValues).toContain('idea-003');
  });

  it('shows loading state while fetching ideas', async () => {
    // Make fetch slow
    (fetchIdeas as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ideas: mockOtherIdeas,
                total: 2,
                limit: 100,
                offset: 0,
              }),
            100
          )
        )
    );

    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    expect(screen.getByTestId('loading-ideas')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-ideas')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no ideas available to link', async () => {
    (fetchIdeas as ReturnType<typeof vi.fn>).mockResolvedValue({
      ideas: [mockSourceIdea], // Only source idea, will be filtered out
      total: 1,
      limit: 100,
      offset: 0,
    });

    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('no-ideas')).toBeInTheDocument();
    });
  });

  it('disables submit button when no idea is selected', async () => {
    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-ideas')).not.toBeInTheDocument();
    });

    const submitButton = screen.getByTestId('link-submit-button');
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when idea is selected', async () => {
    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-ideas')).not.toBeInTheDocument();
    });

    // Select an idea
    const select = screen.getByLabelText(/to/i);
    fireEvent.change(select, { target: { value: 'idea-002' } });

    const submitButton = screen.getByTestId('link-submit-button');
    expect(submitButton).not.toBeDisabled();
  });

  it('calls createCorrelation and onLinked on successful submission', async () => {
    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-ideas')).not.toBeInTheDocument();
    });

    // Select an idea
    const select = screen.getByLabelText(/to/i);
    fireEvent.change(select, { target: { value: 'idea-002' } });

    // Change correlation type
    const typeSelect = screen.getByLabelText(/relationship/i);
    fireEvent.change(typeSelect, { target: { value: 'similar' } });

    // Add notes
    const notesInput = screen.getByPlaceholderText(/why are these ideas linked/i);
    fireEvent.change(notesInput, { target: { value: 'Test notes' } });

    // Submit
    const submitButton = screen.getByTestId('link-submit-button');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createCorrelation).toHaveBeenCalledWith({
        source_idea_id: 'idea-001',
        target_idea_id: 'idea-002',
        correlation_type: 'similar',
        notes: 'Test notes',
      });
    });

    expect(mockOnLinked).toHaveBeenCalled();
  });

  it('displays error when correlation creation fails', async () => {
    (createCorrelation as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-ideas')).not.toBeInTheDocument();
    });

    // Select an idea and submit
    const select = screen.getByLabelText(/to/i);
    fireEvent.change(select, { target: { value: 'idea-002' } });

    const submitButton = screen.getByTestId('link-submit-button');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId('link-error')).toHaveTextContent('Network error');
    });

    expect(mockOnLinked).not.toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', async () => {
    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when X button is clicked', async () => {
    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    const closeButton = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when escape key is pressed', async () => {
    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', async () => {
    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    // Click the backdrop (the modal container) directly
    const backdrop = screen.getByTestId('link-idea-modal');
    // Use the first child (the overlay div) to avoid clicking inside the modal content
    fireEvent.click(backdrop);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows description for different correlation types', async () => {
    render(
      <LinkIdeaModal sourceIdea={mockSourceIdea} onClose={mockOnClose} onLinked={mockOnLinked} />
    );

    // Default is 'related'
    expect(screen.getByText('These ideas are related to each other')).toBeInTheDocument();

    // Change to 'similar'
    const typeSelect = screen.getByLabelText(/relationship/i);
    fireEvent.change(typeSelect, { target: { value: 'similar' } });
    expect(screen.getByText('These ideas express similar concepts')).toBeInTheDocument();

    // Change to 'contradicts'
    fireEvent.change(typeSelect, { target: { value: 'contradicts' } });
    expect(
      screen.getByText('These ideas conflict or contradict each other')
    ).toBeInTheDocument();
  });
});
