/**
 * Tests for loading state components
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  LoadingSpinner,
  LoadingOverlay,
  SkeletonLine,
  SkeletonCard,
  SkeletonTable,
  StreamingIndicator,
} from './LoadingStates';

describe('LoadingSpinner', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<LoadingSpinner />);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<LoadingSpinner className="custom-class" />);
      expect(screen.getByTestId('loading-spinner')).toHaveClass('custom-class');
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      render(<LoadingSpinner size="sm" />);
      expect(screen.getByTestId('loading-spinner')).toHaveClass('h-4');
    });

    it('renders medium size (default)', () => {
      render(<LoadingSpinner />);
      expect(screen.getByTestId('loading-spinner')).toHaveClass('h-6');
    });

    it('renders large size', () => {
      render(<LoadingSpinner size="lg" />);
      expect(screen.getByTestId('loading-spinner')).toHaveClass('h-8');
    });
  });

  describe('Colors', () => {
    it('renders primary color (default)', () => {
      render(<LoadingSpinner />);
      expect(screen.getByTestId('loading-spinner')).toHaveClass('text-accent-blue');
    });

    it('renders white color', () => {
      render(<LoadingSpinner color="white" />);
      expect(screen.getByTestId('loading-spinner')).toHaveClass('text-white');
    });

    it('renders muted color', () => {
      render(<LoadingSpinner color="muted" />);
      expect(screen.getByTestId('loading-spinner')).toHaveClass('text-text-tertiary');
    });
  });
});

describe('LoadingOverlay', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<LoadingOverlay />);
      expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
    });

    it('shows spinner', () => {
      render(<LoadingOverlay />);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Message', () => {
    it('shows default message', () => {
      render(<LoadingOverlay />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows custom message', () => {
      render(<LoadingOverlay message="Fetching data..." />);
      expect(screen.getByText('Fetching data...')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders fullscreen variant', () => {
      render(<LoadingOverlay variant="fullscreen" />);
      expect(screen.getByTestId('loading-overlay')).toHaveClass('fixed');
    });

    it('renders inline variant', () => {
      render(<LoadingOverlay variant="inline" />);
      expect(screen.getByTestId('loading-overlay')).toHaveClass('relative');
    });
  });
});

describe('SkeletonLine', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<SkeletonLine />);
      expect(screen.getByTestId('skeleton-line')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<SkeletonLine className="custom-class" />);
      expect(screen.getByTestId('skeleton-line')).toHaveClass('custom-class');
    });
  });

  describe('Widths', () => {
    it('renders full width (default)', () => {
      render(<SkeletonLine />);
      expect(screen.getByTestId('skeleton-line')).toHaveClass('w-full');
    });

    it('renders 3/4 width', () => {
      render(<SkeletonLine width="3/4" />);
      expect(screen.getByTestId('skeleton-line')).toHaveClass('w-3/4');
    });

    it('renders 1/2 width', () => {
      render(<SkeletonLine width="1/2" />);
      expect(screen.getByTestId('skeleton-line')).toHaveClass('w-1/2');
    });

    it('renders 1/3 width', () => {
      render(<SkeletonLine width="1/3" />);
      expect(screen.getByTestId('skeleton-line')).toHaveClass('w-1/3');
    });

    it('renders 1/4 width', () => {
      render(<SkeletonLine width="1/4" />);
      expect(screen.getByTestId('skeleton-line')).toHaveClass('w-1/4');
    });
  });

  describe('Heights', () => {
    it('renders default height', () => {
      render(<SkeletonLine />);
      expect(screen.getByTestId('skeleton-line')).toHaveClass('h-4');
    });

    it('renders small height', () => {
      render(<SkeletonLine height="sm" />);
      expect(screen.getByTestId('skeleton-line')).toHaveClass('h-3');
    });

    it('renders large height', () => {
      render(<SkeletonLine height="lg" />);
      expect(screen.getByTestId('skeleton-line')).toHaveClass('h-6');
    });
  });
});

describe('SkeletonCard', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<SkeletonCard />);
      expect(screen.getByTestId('skeleton-card')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<SkeletonCard className="custom-class" />);
      expect(screen.getByTestId('skeleton-card')).toHaveClass('custom-class');
    });
  });

  describe('Lines', () => {
    it('renders default number of lines', () => {
      // Header has 2 lines + body has 3 lines = 5 total
      render(<SkeletonCard />);
      const lines = screen.getAllByTestId('skeleton-line');
      expect(lines.length).toBe(5);
    });

    it('renders custom number of lines', () => {
      // Header has 2 lines + body has 5 lines = 7 total
      render(<SkeletonCard lines={5} />);
      const lines = screen.getAllByTestId('skeleton-line');
      expect(lines.length).toBe(7);
    });

    it('renders only body lines when header hidden', () => {
      render(<SkeletonCard showHeader={false} lines={3} />);
      const lines = screen.getAllByTestId('skeleton-line');
      expect(lines.length).toBe(3);
    });
  });

  describe('Header', () => {
    it('shows header by default', () => {
      render(<SkeletonCard />);
      expect(screen.getByTestId('skeleton-header')).toBeInTheDocument();
    });

    it('hides header when showHeader is false', () => {
      render(<SkeletonCard showHeader={false} />);
      expect(screen.queryByTestId('skeleton-header')).not.toBeInTheDocument();
    });
  });
});

describe('SkeletonTable', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<SkeletonTable />);
      expect(screen.getByTestId('skeleton-table')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<SkeletonTable className="custom-class" />);
      expect(screen.getByTestId('skeleton-table')).toHaveClass('custom-class');
    });
  });

  describe('Rows and Columns', () => {
    it('renders default rows', () => {
      render(<SkeletonTable />);
      const rows = screen.getAllByTestId('skeleton-row');
      expect(rows.length).toBe(5);
    });

    it('renders custom number of rows', () => {
      render(<SkeletonTable rows={3} />);
      const rows = screen.getAllByTestId('skeleton-row');
      expect(rows.length).toBe(3);
    });

    it('renders default columns', () => {
      render(<SkeletonTable />);
      const cells = screen.getAllByTestId('skeleton-cell');
      // 5 rows * 4 columns = 20 cells
      expect(cells.length).toBe(20);
    });

    it('renders custom number of columns', () => {
      render(<SkeletonTable columns={3} rows={2} />);
      const cells = screen.getAllByTestId('skeleton-cell');
      // 2 rows * 3 columns = 6 cells
      expect(cells.length).toBe(6);
    });
  });

  describe('Header', () => {
    it('shows header by default', () => {
      render(<SkeletonTable />);
      expect(screen.getByTestId('skeleton-table-header')).toBeInTheDocument();
    });

    it('hides header when showHeader is false', () => {
      render(<SkeletonTable showHeader={false} />);
      expect(screen.queryByTestId('skeleton-table-header')).not.toBeInTheDocument();
    });
  });
});

describe('StreamingIndicator', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<StreamingIndicator />);
      expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<StreamingIndicator className="custom-class" />);
      expect(screen.getByTestId('streaming-indicator')).toHaveClass('custom-class');
    });
  });

  describe('Content', () => {
    it('shows animated dots', () => {
      render(<StreamingIndicator />);
      expect(screen.getAllByTestId('streaming-dot').length).toBe(3);
    });

    it('shows custom label', () => {
      render(<StreamingIndicator label="Typing..." />);
      expect(screen.getByText('Typing...')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders default variant', () => {
      render(<StreamingIndicator />);
      expect(screen.getByTestId('streaming-indicator')).not.toHaveClass('inline-flex');
    });

    it('renders inline variant', () => {
      render(<StreamingIndicator variant="inline" />);
      expect(screen.getByTestId('streaming-indicator')).toHaveClass('inline-flex');
    });
  });
});
