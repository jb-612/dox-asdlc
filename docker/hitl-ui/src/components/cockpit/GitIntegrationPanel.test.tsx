/**
 * Tests for GitIntegrationPanel component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GitIntegrationPanel, { type EnvironmentGitState } from './GitIntegrationPanel';

describe('GitIntegrationPanel', () => {
  const defaultEnvironments: EnvironmentGitState[] = [
    {
      id: 'env-1',
      name: 'Production',
      branch: 'main',
      sha: 'abc123def456',
      pendingCommits: 0,
      recentCommits: [
        { sha: 'abc123d', message: 'feat: Add new feature', author: 'dev1', date: '2026-01-23T10:00:00Z' },
        { sha: 'def456e', message: 'fix: Bug fix', author: 'dev2', date: '2026-01-23T09:00:00Z' },
      ],
      status: 'synced',
      lastSyncAt: '2026-01-23T10:30:00Z',
    },
    {
      id: 'env-2',
      name: 'Staging',
      branch: 'develop',
      sha: 'xyz789abc123',
      pendingCommits: 3,
      recentCommits: [
        { sha: 'xyz789a', message: 'wip: In progress', author: 'dev1', date: '2026-01-23T11:00:00Z' },
      ],
      status: 'pending',
      lastSyncAt: '2026-01-23T09:00:00Z',
    },
    {
      id: 'env-3',
      name: 'Development',
      branch: 'feature/test',
      sha: 'uvw456xyz789',
      pendingCommits: 5,
      recentCommits: [],
      status: 'drift',
      lastSyncAt: '2026-01-22T15:00:00Z',
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.getByTestId('git-integration-panel')).toBeInTheDocument();
    });

    it('renders panel title', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.getByText(/git integration/i)).toBeInTheDocument();
    });

    it('renders all environments', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.getByTestId('env-env-1')).toBeInTheDocument();
      expect(screen.getByTestId('env-env-2')).toBeInTheDocument();
      expect(screen.getByTestId('env-env-3')).toBeInTheDocument();
    });

    it('displays environment names', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.getByText('Production')).toBeInTheDocument();
      expect(screen.getByText('Staging')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} className="my-custom-class" />);
      expect(screen.getByTestId('git-integration-panel')).toHaveClass('my-custom-class');
    });
  });

  describe('Branch Information', () => {
    it('displays branch name', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('develop')).toBeInTheDocument();
      expect(screen.getByText('feature/test')).toBeInTheDocument();
    });

    it('displays SHA (shortened)', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.getByText('abc123d')).toBeInTheDocument();
      expect(screen.getByText('xyz789a')).toBeInTheDocument();
    });

    it('displays pending commits count', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      const stagingEnv = screen.getByTestId('env-env-2');
      expect(stagingEnv).toHaveTextContent('3 pending');

      const devEnv = screen.getByTestId('env-env-3');
      expect(devEnv).toHaveTextContent('5 pending');
    });

    it('shows no pending count when zero', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      const prodEnv = screen.getByTestId('env-env-1');
      expect(prodEnv).not.toHaveTextContent('pending');
    });
  });

  describe('Status Display', () => {
    it('shows synced status', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      const prodEnv = screen.getByTestId('env-env-1');
      expect(prodEnv.querySelector('[data-testid="status-synced"]')).toBeInTheDocument();
    });

    it('shows pending status', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      const stagingEnv = screen.getByTestId('env-env-2');
      expect(stagingEnv.querySelector('[data-testid="status-pending"]')).toBeInTheDocument();
    });

    it('shows drift status with warning', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      const devEnv = screen.getByTestId('env-env-3');
      expect(devEnv.querySelector('[data-testid="status-drift"]')).toBeInTheDocument();
    });

    it('drift indicator has warning styling', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      const driftIndicator = screen.getByTestId('status-drift');
      expect(driftIndicator).toHaveClass('text-status-warning');
    });
  });

  describe('Recent Commits', () => {
    it('displays recent commits when expanded', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);

      // Expand production environment
      fireEvent.click(screen.getByTestId('expand-env-1'));

      expect(screen.getByText('feat: Add new feature')).toBeInTheDocument();
      expect(screen.getByText('fix: Bug fix')).toBeInTheDocument();
    });

    it('shows commit author', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      fireEvent.click(screen.getByTestId('expand-env-1'));

      expect(screen.getByText(/dev1/)).toBeInTheDocument();
      expect(screen.getByText(/dev2/)).toBeInTheDocument();
    });

    it('shows "No recent commits" when empty', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      fireEvent.click(screen.getByTestId('expand-env-3'));

      expect(screen.getByText(/no recent commits/i)).toBeInTheDocument();
    });

    it('collapses when clicked again', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);

      fireEvent.click(screen.getByTestId('expand-env-1'));
      expect(screen.getByText('feat: Add new feature')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('expand-env-1'));
      expect(screen.queryByText('feat: Add new feature')).not.toBeInTheDocument();
    });
  });

  describe('View in Git Links', () => {
    it('renders "View in Git" link', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} repoUrl="https://github.com/org/repo" />);
      expect(screen.getAllByTestId('view-in-git').length).toBeGreaterThan(0);
    });

    it('constructs correct commit URL', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} repoUrl="https://github.com/org/repo" />);
      const link = screen.getAllByTestId('view-in-git')[0];
      expect(link).toHaveAttribute('href', expect.stringContaining('github.com/org/repo'));
    });

    it('hides View in Git link when no repoUrl provided', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.queryByTestId('view-in-git')).not.toBeInTheDocument();
    });

    it('opens link in new tab', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} repoUrl="https://github.com/org/repo" />);
      const link = screen.getAllByTestId('view-in-git')[0];
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Force Sync Action', () => {
    it('shows force sync button', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} onForceSync={vi.fn()} />);
      expect(screen.getAllByTestId('force-sync').length).toBeGreaterThan(0);
    });

    it('hides force sync when no handler', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.queryByTestId('force-sync')).not.toBeInTheDocument();
    });

    it('shows confirmation dialog on click', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} onForceSync={vi.fn()} />);

      fireEvent.click(screen.getAllByTestId('force-sync')[0]);

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText('Force Sync?')).toBeInTheDocument();
    });

    it('calls onForceSync when confirmed', () => {
      const onForceSync = vi.fn();
      render(<GitIntegrationPanel environments={defaultEnvironments} onForceSync={onForceSync} />);

      fireEvent.click(screen.getAllByTestId('force-sync')[0]);
      fireEvent.click(screen.getByTestId('confirm-action'));

      expect(onForceSync).toHaveBeenCalledWith('env-1');
    });

    it('does not call onForceSync when cancelled', () => {
      const onForceSync = vi.fn();
      render(<GitIntegrationPanel environments={defaultEnvironments} onForceSync={onForceSync} />);

      fireEvent.click(screen.getAllByTestId('force-sync')[0]);
      fireEvent.click(screen.getByTestId('cancel-action'));

      expect(onForceSync).not.toHaveBeenCalled();
    });

    it('closes dialog when cancelled', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} onForceSync={vi.fn()} />);

      fireEvent.click(screen.getAllByTestId('force-sync')[0]);
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('cancel-action'));
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });
  });

  describe('Last Sync Time', () => {
    it('displays last sync time', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      const prodEnv = screen.getByTestId('env-env-1');
      expect(prodEnv).toHaveTextContent(/last sync/i);
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<GitIntegrationPanel environments={[]} isLoading />);
      expect(screen.getByTestId('git-panel-loading')).toBeInTheDocument();
    });

    it('shows skeleton items when loading', () => {
      render(<GitIntegrationPanel environments={[]} isLoading />);
      expect(screen.getAllByTestId('env-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no environments', () => {
      render(<GitIntegrationPanel environments={[]} />);
      expect(screen.getByText(/no environments configured/i)).toBeInTheDocument();
    });
  });

  describe('Refresh Action', () => {
    it('shows refresh button', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} onRefresh={vi.fn()} />);
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('calls onRefresh when clicked', () => {
      const onRefresh = vi.fn();
      render(<GitIntegrationPanel environments={defaultEnvironments} onRefresh={onRefresh} />);

      fireEvent.click(screen.getByTestId('refresh-button'));

      expect(onRefresh).toHaveBeenCalled();
    });

    it('hides refresh button when no handler', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.queryByTestId('refresh-button')).not.toBeInTheDocument();
    });
  });

  describe('Collapsible Panel', () => {
    it('can collapse the entire panel', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} collapsible />);

      const collapseBtn = screen.getByTestId('collapse-panel');
      fireEvent.click(collapseBtn);

      expect(screen.queryByTestId('env-env-1')).not.toBeInTheDocument();
    });

    it('can expand collapsed panel', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} collapsible />);

      fireEvent.click(screen.getByTestId('collapse-panel'));
      expect(screen.queryByTestId('env-env-1')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('collapse-panel'));
      expect(screen.getByTestId('env-env-1')).toBeInTheDocument();
    });

    it('hides collapse button when not collapsible', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.queryByTestId('collapse-panel')).not.toBeInTheDocument();
    });
  });

  describe('Environment Click', () => {
    it('calls onEnvironmentClick when environment is clicked', () => {
      const onClick = vi.fn();
      render(<GitIntegrationPanel environments={defaultEnvironments} onEnvironmentClick={onClick} />);

      fireEvent.click(screen.getByTestId('env-env-2'));

      expect(onClick).toHaveBeenCalledWith('env-2');
    });

    it('adds cursor-pointer when onEnvironmentClick is provided', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} onEnvironmentClick={vi.fn()} />);

      expect(screen.getByTestId('env-env-1')).toHaveClass('cursor-pointer');
    });
  });

  describe('Accessibility', () => {
    it('has proper region role', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('has aria-label', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      expect(screen.getByRole('region')).toHaveAttribute('aria-label', expect.stringContaining('Git'));
    });

    it('expand buttons are accessible', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      const expandBtn = screen.getByTestId('expand-env-1');
      expect(expandBtn).toHaveAttribute('aria-expanded');
    });

    it('status has aria-label', () => {
      render(<GitIntegrationPanel environments={defaultEnvironments} />);
      const status = screen.getByTestId('status-synced');
      expect(status).toHaveAttribute('aria-label');
    });
  });
});
