/**
 * Tests for OutputQuickviewPanel component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OutputQuickviewPanel, { type OutputArtifact } from './OutputQuickviewPanel';

describe('OutputQuickviewPanel', () => {
  const defaultArtifacts: OutputArtifact[] = [
    {
      id: 'art-1',
      name: 'PRD.md',
      type: 'document',
      status: 'valid',
      createdAt: '2026-01-23T10:00:00Z',
      preview: 'This is the Product Requirements Document...',
    },
    {
      id: 'art-2',
      name: 'UserStories.md',
      type: 'document',
      status: 'pending_review',
      createdAt: '2026-01-23T10:05:00Z',
      preview: 'User stories for the project...',
    },
    {
      id: 'art-3',
      name: 'Architecture.md',
      type: 'document',
      status: 'invalid',
      createdAt: '2026-01-23T10:10:00Z',
      preview: 'System architecture overview...',
      validationError: 'Missing required sections',
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      expect(screen.getByTestId('output-quickview-panel')).toBeInTheDocument();
    });

    it('renders panel title', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      expect(screen.getByText(/outputs/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} className="my-custom-class" />);
      expect(screen.getByTestId('output-quickview-panel')).toHaveClass('my-custom-class');
    });
  });

  describe('Artifact Cards', () => {
    it('displays all artifacts', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      expect(screen.getByTestId('artifact-art-1')).toBeInTheDocument();
      expect(screen.getByTestId('artifact-art-2')).toBeInTheDocument();
      expect(screen.getByTestId('artifact-art-3')).toBeInTheDocument();
    });

    it('displays artifact names', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      expect(screen.getByText('PRD.md')).toBeInTheDocument();
      expect(screen.getByText('UserStories.md')).toBeInTheDocument();
    });

    it('displays artifact preview', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      expect(screen.getByText(/product requirements document/i)).toBeInTheDocument();
    });

    it('displays artifact count', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      expect(screen.getByTestId('artifact-count')).toHaveTextContent('3');
    });
  });

  describe('Validation Status', () => {
    it('shows valid status', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      const artifact = screen.getByTestId('artifact-art-1');
      expect(artifact.querySelector('[data-testid="status-valid"]')).toBeInTheDocument();
    });

    it('shows pending_review status', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      const artifact = screen.getByTestId('artifact-art-2');
      expect(artifact.querySelector('[data-testid="status-pending_review"]')).toBeInTheDocument();
    });

    it('shows invalid status', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      const artifact = screen.getByTestId('artifact-art-3');
      expect(artifact.querySelector('[data-testid="status-invalid"]')).toBeInTheDocument();
    });

    it('shows validation error for invalid artifacts', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      expect(screen.getByText(/missing required sections/i)).toBeInTheDocument();
    });
  });

  describe('Card Actions', () => {
    it('shows Download action', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      expect(screen.getAllByRole('button', { name: /download/i }).length).toBeGreaterThan(0);
    });

    it('shows Save action', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      expect(screen.getAllByRole('button', { name: /save/i }).length).toBeGreaterThan(0);
    });

    it('shows Submit action for valid artifacts', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      const artifact = screen.getByTestId('artifact-art-1');
      expect(artifact.querySelector('[data-testid="action-submit-art-1"]')).toBeInTheDocument();
    });

    it('shows Open action', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      expect(screen.getAllByRole('button', { name: /open/i }).length).toBeGreaterThan(0);
    });

    it('calls onDownload when Download clicked', () => {
      const onDownload = vi.fn();
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} onDownload={onDownload} />);

      fireEvent.click(screen.getByTestId('action-download-art-1'));

      expect(onDownload).toHaveBeenCalledWith('art-1');
    });

    it('calls onSave when Save clicked', () => {
      const onSave = vi.fn();
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} onSave={onSave} />);

      fireEvent.click(screen.getByTestId('action-save-art-1'));

      expect(onSave).toHaveBeenCalledWith('art-1');
    });

    it('calls onSubmit when Submit clicked', () => {
      const onSubmit = vi.fn();
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByTestId('action-submit-art-1'));

      expect(onSubmit).toHaveBeenCalledWith('art-1');
    });

    it('calls onOpen when Open clicked', () => {
      const onOpen = vi.fn();
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} onOpen={onOpen} />);

      fireEvent.click(screen.getByTestId('action-open-art-1'));

      expect(onOpen).toHaveBeenCalledWith('art-1');
    });

    it('disables Submit for invalid artifacts', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      const submitBtn = screen.getByTestId('action-submit-art-3');
      expect(submitBtn).toBeDisabled();
    });
  });

  describe('Empty State', () => {
    it('shows message when no artifacts', () => {
      render(<OutputQuickviewPanel artifacts={[]} />);
      expect(screen.getByText(/no outputs yet/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} isLoading />);
      expect(screen.getByTestId('quickview-loading')).toBeInTheDocument();
    });

    it('shows skeleton cards when loading', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} isLoading />);
      expect(screen.getAllByTestId('artifact-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Card Click', () => {
    it('calls onArtifactClick when card is clicked', () => {
      const onClick = vi.fn();
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} onArtifactClick={onClick} />);

      fireEvent.click(screen.getByTestId('artifact-art-1'));

      expect(onClick).toHaveBeenCalledWith('art-1');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });

    it('cards are keyboard accessible', () => {
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} />);
      const card = screen.getByTestId('artifact-art-1');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('cards respond to Enter key', () => {
      const onClick = vi.fn();
      render(<OutputQuickviewPanel artifacts={defaultArtifacts} onArtifactClick={onClick} />);

      const card = screen.getByTestId('artifact-art-1');
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(onClick).toHaveBeenCalledWith('art-1');
    });
  });
});
