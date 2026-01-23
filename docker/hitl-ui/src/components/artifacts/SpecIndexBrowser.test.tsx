/**
 * Tests for SpecIndexBrowser component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SpecIndexBrowser, { type SpecIndex, type SpecEntry } from './SpecIndexBrowser';

describe('SpecIndexBrowser', () => {
  const defaultSpecIndex: SpecIndex = {
    discovery: [
      { id: 'prd', name: 'Product Requirements', status: 'complete', artifactId: 'art-1' },
      { id: 'acceptance', name: 'Acceptance Criteria', status: 'complete', artifactId: 'art-2' },
    ],
    design: [
      { id: 'survey', name: 'Technical Survey', status: 'complete', artifactId: 'art-3' },
      { id: 'architecture', name: 'Architecture Design', status: 'in_progress' },
      { id: 'api', name: 'API Specification', status: 'pending' },
    ],
    development: [
      { id: 'tests', name: 'Unit Tests', status: 'in_progress' },
      { id: 'code', name: 'Implementation', status: 'pending' },
      { id: 'review', name: 'Code Review', status: 'pending' },
    ],
    validation: [
      { id: 'security', name: 'Security Scan', status: 'pending' },
      { id: 'performance', name: 'Performance Tests', status: 'pending' },
      { id: 'deployment', name: 'Deployment Validation', status: 'pending' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByTestId('spec-index-browser')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} className="my-custom-class" />);
      expect(screen.getByTestId('spec-index-browser')).toHaveClass('my-custom-class');
    });

    it('renders title', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByText(/spec index/i)).toBeInTheDocument();
    });
  });

  describe('Folder Structure', () => {
    it('renders Discovery folder', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByTestId('folder-discovery')).toBeInTheDocument();
    });

    it('renders Design folder', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByTestId('folder-design')).toBeInTheDocument();
    });

    it('renders Development folder', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByTestId('folder-development')).toBeInTheDocument();
    });

    it('renders Validation folder', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByTestId('folder-validation')).toBeInTheDocument();
    });

    it('displays folder labels', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByText('Discovery')).toBeInTheDocument();
      expect(screen.getByText('Design')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('Validation')).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('folders are expanded by default', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      // Should see entries under Discovery
      expect(screen.getByText('Product Requirements')).toBeInTheDocument();
    });

    it('collapses folder when clicked', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      fireEvent.click(screen.getByTestId('folder-discovery'));

      // Entries should be hidden
      expect(screen.queryByText('Product Requirements')).not.toBeInTheDocument();
    });

    it('expands folder when clicked again', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      const folder = screen.getByTestId('folder-discovery');

      fireEvent.click(folder);
      fireEvent.click(folder);

      expect(screen.getByText('Product Requirements')).toBeInTheDocument();
    });

    it('shows expand icon when collapsed', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      fireEvent.click(screen.getByTestId('folder-discovery'));

      expect(screen.getByTestId('expand-icon-discovery')).toBeInTheDocument();
    });

    it('shows collapse icon when expanded', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByTestId('collapse-icon-discovery')).toBeInTheDocument();
    });
  });

  describe('Spec Entries', () => {
    it('displays entry names', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByText('Product Requirements')).toBeInTheDocument();
      expect(screen.getByText('Acceptance Criteria')).toBeInTheDocument();
      expect(screen.getByText('Technical Survey')).toBeInTheDocument();
    });

    it('shows complete status icon', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      const entry = screen.getByTestId('entry-prd');
      expect(within(entry).getByTestId('status-complete')).toBeInTheDocument();
    });

    it('shows in_progress status icon', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      const entry = screen.getByTestId('entry-architecture');
      expect(within(entry).getByTestId('status-in_progress')).toBeInTheDocument();
    });

    it('shows pending status icon', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      const entry = screen.getByTestId('entry-api');
      expect(within(entry).getByTestId('status-pending')).toBeInTheDocument();
    });

    it('shows failed status icon', () => {
      const indexWithFailed: SpecIndex = {
        ...defaultSpecIndex,
        validation: [
          { id: 'security', name: 'Security Scan', status: 'failed', artifactId: 'art-x' },
        ],
      };
      render(<SpecIndexBrowser specIndex={indexWithFailed} />);
      const entry = screen.getByTestId('entry-security');
      expect(within(entry).getByTestId('status-failed')).toBeInTheDocument();
    });
  });

  describe('Progress Summary', () => {
    it('displays progress summary', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByTestId('progress-summary')).toBeInTheDocument();
    });

    it('shows correct complete count', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      // 3 complete: prd, acceptance, survey
      expect(screen.getByTestId('complete-count')).toHaveTextContent('3');
    });

    it('shows correct in-progress count', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      // 2 in_progress: architecture, tests
      expect(screen.getByTestId('in-progress-count')).toHaveTextContent('2');
    });

    it('shows correct pending count', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      // 6 pending: api, code, review, security, performance, deployment
      expect(screen.getByTestId('pending-count')).toHaveTextContent('6');
    });

    it('shows progress percentage', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      // 3 complete out of 11 total = 27%
      expect(screen.getByTestId('progress-percentage')).toHaveTextContent('27%');
    });

    it('shows progress bar', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    });
  });

  describe('Entry Click', () => {
    it('calls onEntryClick when entry is clicked', () => {
      const onClick = vi.fn();
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} onEntryClick={onClick} />);

      fireEvent.click(screen.getByTestId('entry-prd'));

      expect(onClick).toHaveBeenCalledWith('art-1', 'prd');
    });

    it('does not call onEntryClick for entries without artifactId', () => {
      const onClick = vi.fn();
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} onEntryClick={onClick} />);

      fireEvent.click(screen.getByTestId('entry-api'));

      expect(onClick).not.toHaveBeenCalled();
    });

    it('applies hover style to clickable entries', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      const entry = screen.getByTestId('entry-prd');
      expect(entry).toHaveClass('cursor-pointer');
    });

    it('applies muted style to pending entries', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      const entry = screen.getByTestId('entry-api');
      expect(entry).toHaveClass('opacity-50');
    });
  });

  describe('Folder Progress', () => {
    it('shows folder progress indicator', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      // Discovery: 2/2 complete
      const folder = screen.getByTestId('folder-discovery');
      expect(within(folder).getByTestId('folder-progress')).toHaveTextContent('2/2');
    });

    it('shows correct progress for Design folder', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      // Design: 1/3 complete
      const folder = screen.getByTestId('folder-design');
      expect(within(folder).getByTestId('folder-progress')).toHaveTextContent('1/3');
    });

    it('shows checkmark when folder is fully complete', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      const folder = screen.getByTestId('folder-discovery');
      expect(within(folder).getByTestId('folder-complete')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no entries', () => {
      const emptyIndex: SpecIndex = {
        discovery: [],
        design: [],
        development: [],
        validation: [],
      };
      render(<SpecIndexBrowser specIndex={emptyIndex} />);
      expect(screen.getByText(/no specifications/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} isLoading />);
      expect(screen.getByTestId('spec-index-loading')).toBeInTheDocument();
    });

    it('shows skeleton items when loading', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} isLoading />);
      expect(screen.getAllByTestId('skeleton-item').length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('folders have tree role', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);
      expect(screen.getByRole('tree')).toBeInTheDocument();
    });

    it('entries are keyboard accessible', () => {
      const onClick = vi.fn();
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} onEntryClick={onClick} />);

      const entry = screen.getByTestId('entry-prd');
      fireEvent.keyDown(entry, { key: 'Enter' });

      expect(onClick).toHaveBeenCalledWith('art-1', 'prd');
    });

    it('folders are keyboard accessible', () => {
      render(<SpecIndexBrowser specIndex={defaultSpecIndex} />);

      const folder = screen.getByTestId('folder-discovery');
      fireEvent.keyDown(folder, { key: 'Enter' });

      // Should collapse
      expect(screen.queryByText('Product Requirements')).not.toBeInTheDocument();
    });
  });
});
