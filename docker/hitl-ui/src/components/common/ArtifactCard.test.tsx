/**
 * Tests for ArtifactCard component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ArtifactCard from './ArtifactCard';

describe('ArtifactCard', () => {
  const defaultProps = {
    id: 'art_001',
    name: 'test-file.py',
    type: 'file' as const,
    status: 'draft' as const,
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ArtifactCard {...defaultProps} />);
      expect(screen.getByTestId('artifact-card')).toBeInTheDocument();
    });

    it('displays artifact name', () => {
      render(<ArtifactCard {...defaultProps} />);
      expect(screen.getByText('test-file.py')).toBeInTheDocument();
    });

    it('displays file extension', () => {
      render(<ArtifactCard {...defaultProps} />);
      expect(screen.getByText('py')).toBeInTheDocument();
    });

    it('displays file size when provided', () => {
      render(<ArtifactCard {...defaultProps} sizeBytes={1500} />);
      expect(screen.getByText('1.5 KB')).toBeInTheDocument();
    });

    it('displays creation time when provided', () => {
      const createdAt = new Date().toISOString();
      render(<ArtifactCard {...defaultProps} createdAt={createdAt} />);
      // formatRelativeTime returns "less than a minute ago" for recent times
      expect(screen.getByText(/less than a minute ago|minute/i)).toBeInTheDocument();
    });

    it('displays creator when provided', () => {
      render(<ArtifactCard {...defaultProps} createdBy="coding_agent" />);
      expect(screen.getByText('coding_agent')).toBeInTheDocument();
    });

    it('displays preview when provided', () => {
      render(<ArtifactCard {...defaultProps} preview="def hello():\n    print('Hello')" />);
      expect(screen.getByText(/def hello/)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ArtifactCard {...defaultProps} className="my-custom-class" />);
      expect(screen.getByTestId('artifact-card')).toHaveClass('my-custom-class');
    });

    it('sets data-artifact-id attribute', () => {
      render(<ArtifactCard {...defaultProps} />);
      expect(screen.getByTestId('artifact-card')).toHaveAttribute('data-artifact-id', 'art_001');
    });
  });

  describe('Status Display', () => {
    it('shows Draft status badge', () => {
      render(<ArtifactCard {...defaultProps} status="draft" />);
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('shows Pending Review status badge', () => {
      render(<ArtifactCard {...defaultProps} status="pending_review" />);
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
    });

    it('shows Approved status badge', () => {
      render(<ArtifactCard {...defaultProps} status="approved" />);
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('shows Rejected status badge', () => {
      render(<ArtifactCard {...defaultProps} status="rejected" />);
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });
  });

  describe('Artifact Types', () => {
    it('renders file type correctly', () => {
      render(<ArtifactCard {...defaultProps} type="file" />);
      expect(screen.getByTestId('artifact-card')).toBeInTheDocument();
    });

    it('renders diff type correctly', () => {
      render(<ArtifactCard {...defaultProps} type="diff" name="changes.diff" />);
      expect(screen.getByText('diff')).toBeInTheDocument();
    });

    it('renders log type correctly', () => {
      render(<ArtifactCard {...defaultProps} type="log" name="output.log" />);
      expect(screen.getByText('log')).toBeInTheDocument();
    });

    it('renders report type correctly', () => {
      render(<ArtifactCard {...defaultProps} type="report" name="coverage.json" />);
      expect(screen.getByText('json')).toBeInTheDocument();
    });
  });

  describe('Selection State', () => {
    it('applies selected styles when selected', () => {
      render(<ArtifactCard {...defaultProps} selected />);
      expect(screen.getByTestId('artifact-card')).toHaveClass('border-accent-teal');
    });

    it('applies unselected styles by default', () => {
      render(<ArtifactCard {...defaultProps} />);
      expect(screen.getByTestId('artifact-card')).toHaveClass('border-border-primary');
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when card is clicked', () => {
      const onClick = vi.fn();
      render(<ArtifactCard {...defaultProps} onClick={onClick} />);

      fireEvent.click(screen.getByTestId('artifact-card'));
      expect(onClick).toHaveBeenCalled();
    });

    it('applies cursor-pointer when onClick is provided', () => {
      const onClick = vi.fn();
      render(<ArtifactCard {...defaultProps} onClick={onClick} />);
      expect(screen.getByTestId('artifact-card')).toHaveClass('cursor-pointer');
    });
  });

  describe('Action Buttons', () => {
    it('shows Open button when onOpen is provided', () => {
      render(<ArtifactCard {...defaultProps} onOpen={() => {}} />);
      expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
    });

    it('shows Download button when onDownload is provided', () => {
      render(<ArtifactCard {...defaultProps} onDownload={() => {}} />);
      expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    });

    it('shows Save button for draft status when onSave is provided', () => {
      render(<ArtifactCard {...defaultProps} status="draft" onSave={() => {}} />);
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('hides Save button for non-draft status', () => {
      render(<ArtifactCard {...defaultProps} status="approved" onSave={() => {}} />);
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    });

    it('shows Submit button for draft status when onSubmit is provided', () => {
      render(<ArtifactCard {...defaultProps} status="draft" onSubmit={() => {}} />);
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });

    it('shows Submit button for rejected status when onSubmit is provided', () => {
      render(<ArtifactCard {...defaultProps} status="rejected" onSubmit={() => {}} />);
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });

    it('hides Submit button for approved status', () => {
      render(<ArtifactCard {...defaultProps} status="approved" onSubmit={() => {}} />);
      expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
    });

    it('hides all action buttons when showActions is false', () => {
      render(
        <ArtifactCard
          {...defaultProps}
          showActions={false}
          onOpen={() => {}}
          onDownload={() => {}}
          onSave={() => {}}
          onSubmit={() => {}}
        />
      );
      expect(screen.queryByRole('button', { name: /open/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
    });
  });

  describe('Action Callbacks', () => {
    it('calls onOpen when Open button is clicked', () => {
      const onOpen = vi.fn();
      render(<ArtifactCard {...defaultProps} onOpen={onOpen} />);

      fireEvent.click(screen.getByRole('button', { name: /open/i }));
      expect(onOpen).toHaveBeenCalled();
    });

    it('calls onDownload when Download button is clicked', () => {
      const onDownload = vi.fn();
      render(<ArtifactCard {...defaultProps} onDownload={onDownload} />);

      fireEvent.click(screen.getByRole('button', { name: /download/i }));
      expect(onDownload).toHaveBeenCalled();
    });

    it('calls onSave when Save button is clicked', () => {
      const onSave = vi.fn();
      render(<ArtifactCard {...defaultProps} status="draft" onSave={onSave} />);

      fireEvent.click(screen.getByRole('button', { name: /save/i }));
      expect(onSave).toHaveBeenCalled();
    });

    it('calls onSubmit when Submit button is clicked', () => {
      const onSubmit = vi.fn();
      render(<ArtifactCard {...defaultProps} status="draft" onSubmit={onSubmit} />);

      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(onSubmit).toHaveBeenCalled();
    });

    it('does not trigger onClick when action button is clicked', () => {
      const onClick = vi.fn();
      const onOpen = vi.fn();
      render(<ArtifactCard {...defaultProps} onClick={onClick} onOpen={onOpen} />);

      fireEvent.click(screen.getByRole('button', { name: /open/i }));
      expect(onOpen).toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles long filenames with truncation', () => {
      render(
        <ArtifactCard
          {...defaultProps}
          name="very-long-filename-that-should-be-truncated-in-the-display.py"
        />
      );
      const title = screen.getByText(/very-long-filename/);
      expect(title).toHaveClass('truncate');
    });

    it('handles files without extension', () => {
      render(<ArtifactCard {...defaultProps} name="Dockerfile" />);
      expect(screen.getByText('Dockerfile')).toBeInTheDocument();
    });

    it('handles null preview gracefully', () => {
      render(<ArtifactCard {...defaultProps} preview={null} />);
      expect(screen.getByTestId('artifact-card')).toBeInTheDocument();
    });

    it('handles zero byte files', () => {
      render(<ArtifactCard {...defaultProps} sizeBytes={0} />);
      // formatBytes returns "0 B" for 0 bytes
      expect(screen.getByText('0 B')).toBeInTheDocument();
    });
  });
});
