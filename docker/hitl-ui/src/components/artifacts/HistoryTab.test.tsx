/**
 * Tests for HistoryTab component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import HistoryTab, { type ArtifactVersion } from './HistoryTab';

// Mock CodeDiff
vi.mock('../common/CodeDiff', () => ({
  default: ({ oldContent, newContent }: { oldContent: string; newContent: string }) => (
    <div data-testid="code-diff">
      <span data-testid="diff-old">{oldContent.substring(0, 50)}</span>
      <span data-testid="diff-new">{newContent.substring(0, 50)}</span>
    </div>
  ),
}));

describe('HistoryTab', () => {
  const defaultVersions: ArtifactVersion[] = [
    {
      id: 'v5',
      version: 5,
      sha: 'sha5abc',
      createdAt: '2026-01-23T15:00:00Z',
      author: 'coding-agent',
      message: 'Implemented feature X',
      content: '# Version 5 content',
    },
    {
      id: 'v4',
      version: 4,
      sha: 'sha4def',
      createdAt: '2026-01-23T12:00:00Z',
      author: 'coding-agent',
      message: 'Fixed bug in validation',
      content: '# Version 4 content',
    },
    {
      id: 'v3',
      version: 3,
      sha: 'sha3ghi',
      createdAt: '2026-01-23T10:00:00Z',
      author: 'review-agent',
      message: 'Applied review feedback',
      content: '# Version 3 content',
    },
    {
      id: 'v2',
      version: 2,
      sha: 'sha2jkl',
      createdAt: '2026-01-22T16:00:00Z',
      author: 'coding-agent',
      message: 'Added new section',
      content: '# Version 2 content',
    },
    {
      id: 'v1',
      version: 1,
      sha: 'sha1mno',
      createdAt: '2026-01-22T09:00:00Z',
      author: 'prd-agent',
      message: 'Initial version',
      content: '# Version 1 content',
    },
  ];

  const defaultCurrentVersion = 5;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      expect(screen.getByTestId('history-tab')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <HistoryTab
          versions={defaultVersions}
          currentVersion={defaultCurrentVersion}
          className="my-custom-class"
        />
      );
      expect(screen.getByTestId('history-tab')).toHaveClass('my-custom-class');
    });

    it('shows version count', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      expect(screen.getByTestId('version-count')).toHaveTextContent('5');
    });
  });

  describe('Version Timeline', () => {
    it('displays all versions', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      expect(screen.getByTestId('version-v5')).toBeInTheDocument();
      expect(screen.getByTestId('version-v4')).toBeInTheDocument();
      expect(screen.getByTestId('version-v3')).toBeInTheDocument();
      expect(screen.getByTestId('version-v2')).toBeInTheDocument();
      expect(screen.getByTestId('version-v1')).toBeInTheDocument();
    });

    it('shows version numbers', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      expect(screen.getByText('v5')).toBeInTheDocument();
      expect(screen.getByText('v1')).toBeInTheDocument();
    });

    it('shows version messages', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      expect(screen.getByText('Implemented feature X')).toBeInTheDocument();
      expect(screen.getByText('Initial version')).toBeInTheDocument();
    });

    it('shows version timestamps', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      const version = screen.getByTestId('version-v5');
      expect(within(version).getByTestId('version-time')).toBeInTheDocument();
    });

    it('shows version authors', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      const version = screen.getByTestId('version-v5');
      expect(within(version).getByText(/coding-agent/)).toBeInTheDocument();
    });

    it('shows truncated SHA', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      expect(screen.getByText('sha5abc')).toBeInTheDocument();
    });

    it('highlights current version', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      const currentVersion = screen.getByTestId('version-v5');
      expect(currentVersion).toHaveClass('border-accent-blue');
    });
  });

  describe('View Version', () => {
    it('calls onViewVersion when version clicked', () => {
      const onView = vi.fn();
      render(
        <HistoryTab
          versions={defaultVersions}
          currentVersion={defaultCurrentVersion}
          onViewVersion={onView}
        />
      );

      fireEvent.click(screen.getByTestId('version-v3'));

      expect(onView).toHaveBeenCalledWith('v3');
    });

    it('shows view button for each version', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      expect(screen.getAllByTestId(/^view-btn-/).length).toBe(5);
    });
  });

  describe('Compare Versions', () => {
    it('shows compare mode toggle', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      expect(screen.getByTestId('compare-toggle')).toBeInTheDocument();
    });

    it('enables comparison mode when toggled', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);

      fireEvent.click(screen.getByTestId('compare-toggle'));

      expect(screen.getByTestId('compare-instructions')).toBeInTheDocument();
    });

    it('allows selecting two versions in compare mode', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);

      fireEvent.click(screen.getByTestId('compare-toggle'));
      fireEvent.click(screen.getByTestId('version-v3'));
      fireEvent.click(screen.getByTestId('version-v1'));

      expect(screen.getByTestId('code-diff')).toBeInTheDocument();
    });

    it('shows diff between selected versions', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);

      fireEvent.click(screen.getByTestId('compare-toggle'));
      fireEvent.click(screen.getByTestId('version-v3'));
      fireEvent.click(screen.getByTestId('version-v1'));

      expect(screen.getByTestId('diff-old')).toHaveTextContent('Version 1');
      expect(screen.getByTestId('diff-new')).toHaveTextContent('Version 3');
    });

    it('shows clear selection button in compare mode', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);

      fireEvent.click(screen.getByTestId('compare-toggle'));
      fireEvent.click(screen.getByTestId('version-v3'));

      expect(screen.getByTestId('clear-selection')).toBeInTheDocument();
    });

    it('clears selection when clear button clicked', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);

      fireEvent.click(screen.getByTestId('compare-toggle'));
      fireEvent.click(screen.getByTestId('version-v3'));
      fireEvent.click(screen.getByTestId('clear-selection'));

      expect(screen.queryByTestId('version-v3-selected')).not.toBeInTheDocument();
    });

    it('exits compare mode when toggle clicked again', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);

      fireEvent.click(screen.getByTestId('compare-toggle'));
      fireEvent.click(screen.getByTestId('compare-toggle'));

      expect(screen.queryByTestId('compare-instructions')).not.toBeInTheDocument();
    });

    it('shows selected indicator on chosen versions', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);

      fireEvent.click(screen.getByTestId('compare-toggle'));
      fireEvent.click(screen.getByTestId('version-v3'));

      expect(screen.getByTestId('selected-indicator-v3')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no versions', () => {
      render(<HistoryTab versions={[]} currentVersion={0} />);
      expect(screen.getByText(/no history/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(
        <HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} isLoading />
      );
      expect(screen.getByTestId('history-loading')).toBeInTheDocument();
    });

    it('shows skeleton items when loading', () => {
      render(
        <HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} isLoading />
      );
      expect(screen.getAllByTestId('skeleton-version').length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('versions are keyboard accessible', () => {
      const onView = vi.fn();
      render(
        <HistoryTab
          versions={defaultVersions}
          currentVersion={defaultCurrentVersion}
          onViewVersion={onView}
        />
      );

      const version = screen.getByTestId('version-v3');
      fireEvent.keyDown(version, { key: 'Enter' });

      expect(onView).toHaveBeenCalledWith('v3');
    });

    it('compare toggle has accessible label', () => {
      render(<HistoryTab versions={defaultVersions} currentVersion={defaultCurrentVersion} />);
      expect(screen.getByTestId('compare-toggle')).toHaveAttribute('aria-label');
    });
  });
});
