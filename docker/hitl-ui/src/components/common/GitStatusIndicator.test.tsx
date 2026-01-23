/**
 * Tests for GitStatusIndicator component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GitStatusIndicator, { type GitState } from './GitStatusIndicator';

describe('GitStatusIndicator', () => {
  const defaultState: GitState = {
    branch: 'main',
    sha: 'abc1234567890def',
    pendingCommits: 0,
    isDirty: false,
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<GitStatusIndicator state={defaultState} />);
      expect(screen.getByTestId('git-status')).toBeInTheDocument();
    });

    it('displays branch name', () => {
      render(<GitStatusIndicator state={defaultState} />);
      expect(screen.getByTestId('branch-name')).toHaveTextContent('main');
    });

    it('displays truncated SHA by default', () => {
      render(<GitStatusIndicator state={defaultState} />);
      expect(screen.getByTestId('sha-value')).toHaveTextContent('abc1234');
    });

    it('displays full SHA when showFullSha is true', () => {
      render(<GitStatusIndicator state={defaultState} showFullSha />);
      expect(screen.getByTestId('sha-value')).toHaveTextContent('abc1234567890def');
    });

    it('applies custom className', () => {
      render(<GitStatusIndicator state={defaultState} className="my-custom-class" />);
      expect(screen.getByTestId('git-status')).toHaveClass('my-custom-class');
    });
  });

  describe('Status Indicators', () => {
    it('shows clean status when no issues', () => {
      render(<GitStatusIndicator state={defaultState} />);
      expect(screen.getByTestId('status-clean')).toBeInTheDocument();
    });

    it('shows pending status when commits are pending', () => {
      const state: GitState = { ...defaultState, pendingCommits: 3 };
      render(<GitStatusIndicator state={state} />);
      expect(screen.getByTestId('status-pending')).toBeInTheDocument();
      expect(screen.getByText('3 pending')).toBeInTheDocument();
    });

    it('shows drift warning when behind remote', () => {
      const state: GitState = { ...defaultState, behind: 5 };
      render(<GitStatusIndicator state={state} />);
      expect(screen.getByTestId('status-drift')).toBeInTheDocument();
      expect(screen.getByText('5 behind')).toBeInTheDocument();
    });

    it('shows dirty status when there are uncommitted changes', () => {
      const state: GitState = { ...defaultState, isDirty: true };
      render(<GitStatusIndicator state={state} />);
      expect(screen.getByTestId('status-dirty')).toBeInTheDocument();
      expect(screen.getByText('Uncommitted changes')).toBeInTheDocument();
    });

    it('can hide drift warning', () => {
      const state: GitState = { ...defaultState, behind: 5 };
      render(<GitStatusIndicator state={state} showDriftWarning={false} />);
      expect(screen.queryByTestId('status-drift')).not.toBeInTheDocument();
    });
  });

  describe('Ahead/Behind Counts', () => {
    it('shows ahead count when ahead of remote', () => {
      const state: GitState = { ...defaultState, ahead: 2 };
      render(<GitStatusIndicator state={state} />);
      expect(screen.getByTestId('ahead-count')).toHaveTextContent('↑2');
    });

    it('shows behind count when behind remote (no drift)', () => {
      const state: GitState = { ...defaultState, behind: 3 };
      render(<GitStatusIndicator state={state} showDriftWarning={false} />);
      expect(screen.getByTestId('behind-count')).toHaveTextContent('↓3');
    });

    it('does not show separate behind count when drift warning is shown', () => {
      const state: GitState = { ...defaultState, behind: 3 };
      render(<GitStatusIndicator state={state} showDriftWarning />);
      expect(screen.queryByTestId('behind-count')).not.toBeInTheDocument();
      expect(screen.getByText('3 behind')).toBeInTheDocument(); // In drift warning
    });
  });

  describe('Git Links', () => {
    const gitUrl = 'https://github.com/org/repo';

    it('renders branch as link when gitUrl provided', () => {
      render(<GitStatusIndicator state={defaultState} gitUrl={gitUrl} />);
      const branchLink = screen.getByTestId('branch-link');
      expect(branchLink).toHaveAttribute('href', `${gitUrl}/tree/main`);
    });

    it('renders SHA as link when gitUrl provided', () => {
      render(<GitStatusIndicator state={defaultState} gitUrl={gitUrl} />);
      const shaLink = screen.getByTestId('sha-link');
      expect(shaLink).toHaveAttribute('href', `${gitUrl}/commit/${defaultState.sha}`);
    });

    it('opens links in new tab', () => {
      render(<GitStatusIndicator state={defaultState} gitUrl={gitUrl} />);
      const branchLink = screen.getByTestId('branch-link');
      expect(branchLink).toHaveAttribute('target', '_blank');
      expect(branchLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders branch as text when gitUrl not provided', () => {
      render(<GitStatusIndicator state={defaultState} />);
      expect(screen.getByTestId('branch-name')).toBeInTheDocument();
      expect(screen.queryByTestId('branch-link')).not.toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('shows View in Git button when callback provided', () => {
      const onViewInGit = vi.fn();
      render(<GitStatusIndicator state={defaultState} onViewInGit={onViewInGit} />);
      expect(screen.getByTestId('view-in-git-button')).toBeInTheDocument();
    });

    it('calls onViewInGit when button clicked', () => {
      const onViewInGit = vi.fn();
      render(<GitStatusIndicator state={defaultState} onViewInGit={onViewInGit} />);
      fireEvent.click(screen.getByTestId('view-in-git-button'));
      expect(onViewInGit).toHaveBeenCalled();
    });

    it('shows sync button when drift detected and callback provided', () => {
      const state: GitState = { ...defaultState, behind: 3 };
      const onSync = vi.fn();
      render(<GitStatusIndicator state={state} onSync={onSync} />);
      expect(screen.getByTestId('sync-button')).toBeInTheDocument();
    });

    it('does not show sync button when no drift', () => {
      const onSync = vi.fn();
      render(<GitStatusIndicator state={defaultState} onSync={onSync} />);
      expect(screen.queryByTestId('sync-button')).not.toBeInTheDocument();
    });

    it('calls onSync when sync button clicked', () => {
      const state: GitState = { ...defaultState, behind: 3 };
      const onSync = vi.fn();
      render(<GitStatusIndicator state={state} onSync={onSync} />);
      fireEvent.click(screen.getByTestId('sync-button'));
      expect(onSync).toHaveBeenCalled();
    });
  });

  describe('Last Sync Time', () => {
    it('shows last sync time when provided', () => {
      const state: GitState = {
        ...defaultState,
        lastSync: '2026-01-23T10:30:00Z',
      };
      render(<GitStatusIndicator state={state} />);
      expect(screen.getByTestId('last-sync')).toBeInTheDocument();
      expect(screen.getByTestId('last-sync')).toHaveTextContent(/Last sync:/);
    });

    it('does not show last sync when not provided', () => {
      render(<GitStatusIndicator state={defaultState} />);
      expect(screen.queryByTestId('last-sync')).not.toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders sm size correctly', () => {
      render(<GitStatusIndicator state={defaultState} size="sm" />);
      expect(screen.getByTestId('git-status')).toHaveClass('text-xs');
    });

    it('renders md size correctly', () => {
      render(<GitStatusIndicator state={defaultState} size="md" />);
      expect(screen.getByTestId('git-status')).toHaveClass('text-sm');
    });

    it('renders lg size correctly', () => {
      render(<GitStatusIndicator state={defaultState} size="lg" />);
      expect(screen.getByTestId('git-status')).toHaveClass('text-base');
    });
  });

  describe('Priority of Status', () => {
    it('shows dirty status over pending', () => {
      const state: GitState = { ...defaultState, isDirty: true, pendingCommits: 2 };
      render(<GitStatusIndicator state={state} />);
      expect(screen.getByTestId('status-dirty')).toBeInTheDocument();
      expect(screen.queryByTestId('status-pending')).not.toBeInTheDocument();
    });

    it('shows drift status over pending', () => {
      const state: GitState = { ...defaultState, behind: 3, pendingCommits: 2 };
      render(<GitStatusIndicator state={state} />);
      expect(screen.getByTestId('status-drift')).toBeInTheDocument();
      expect(screen.queryByTestId('status-pending')).not.toBeInTheDocument();
    });
  });
});
