import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RepoMountSection from '../../../../src/renderer/components/execution/RepoMountSection';
import type { RepoMount } from '../../../../src/shared/types/repo';

// ---------------------------------------------------------------------------
// Mock window.electronAPI
// ---------------------------------------------------------------------------

const mockOpenDirectory = vi.fn();
const mockValidate = vi.fn();
const mockClone = vi.fn();
const mockCancelClone = vi.fn();

beforeEach(() => {
  mockOpenDirectory.mockReset();
  mockValidate.mockReset();
  mockClone.mockReset();
  mockCancelClone.mockReset();

  (window as any).electronAPI = {
    dialog: { openDirectory: mockOpenDirectory },
    repo: {
      validate: mockValidate,
      clone: mockClone,
      cancelClone: mockCancelClone,
    },
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RepoMountSection', () => {
  it('renders with data-testid attributes', () => {
    render(<RepoMountSection value={null} onChange={vi.fn()} />);

    expect(screen.getByTestId('repo-mount-section')).toBeInTheDocument();
    expect(screen.getByTestId('repo-tab-local')).toBeInTheDocument();
    expect(screen.getByTestId('repo-tab-github')).toBeInTheDocument();
  });

  it('shows Local Directory tab by default', () => {
    render(<RepoMountSection value={null} onChange={vi.fn()} />);

    expect(screen.getByTestId('repo-browse-btn')).toBeInTheDocument();
    expect(screen.getByTestId('repo-path-input')).toBeInTheDocument();
  });

  it('switches to GitHub tab', () => {
    render(<RepoMountSection value={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId('repo-tab-github'));
    expect(screen.getByTestId('repo-github-url')).toBeInTheDocument();
    expect(screen.getByTestId('repo-clone-btn')).toBeInTheDocument();
  });

  it('calls dialog.openDirectory on Browse click and calls onChange', async () => {
    const onChange = vi.fn();
    mockOpenDirectory.mockResolvedValue('/tmp/test-repo');
    mockValidate.mockResolvedValue({ valid: true, hasGit: true });

    render(<RepoMountSection value={null} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('repo-browse-btn'));

    await waitFor(() => {
      expect(mockOpenDirectory).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'local',
          localPath: '/tmp/test-repo',
        }),
      );
    });
  });

  it('shows valid-git validation status after browsing a git repo', async () => {
    mockOpenDirectory.mockResolvedValue('/tmp/git-repo');
    mockValidate.mockResolvedValue({ valid: true, hasGit: true });

    render(<RepoMountSection value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('repo-browse-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('repo-validate-status')).toHaveTextContent('Valid git repo');
    });
  });

  it('shows valid-no-git validation status for non-git directory', async () => {
    mockOpenDirectory.mockResolvedValue('/tmp/no-git');
    mockValidate.mockResolvedValue({ valid: true, hasGit: false });

    render(<RepoMountSection value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('repo-browse-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('repo-validate-status')).toHaveTextContent('No .git found');
    });
  });

  it('calls repo.clone on Clone button click', async () => {
    const onChange = vi.fn();
    mockClone.mockResolvedValue({ success: true, localPath: '/tmp/cloned-repo' });

    render(<RepoMountSection value={null} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('repo-tab-github'));
    fireEvent.change(screen.getByTestId('repo-github-url'), {
      target: { value: 'https://github.com/owner/repo.git' },
    });
    fireEvent.click(screen.getByTestId('repo-clone-btn'));

    await waitFor(() => {
      expect(mockClone).toHaveBeenCalledWith('https://github.com/owner/repo.git');
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'github',
          githubUrl: 'https://github.com/owner/repo.git',
          localPath: '/tmp/cloned-repo',
        }),
      );
    });
  });

  it('shows clone error on failure', async () => {
    mockClone.mockResolvedValue({ success: false, error: 'repo not found' });

    render(<RepoMountSection value={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId('repo-tab-github'));
    fireEvent.change(screen.getByTestId('repo-github-url'), {
      target: { value: 'https://github.com/owner/nonexistent.git' },
    });
    fireEvent.click(screen.getByTestId('repo-clone-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('repo-clone-status')).toHaveTextContent('repo not found');
    });
  });

  it('shows file restrictions editor when a path is set', () => {
    const mount: RepoMount = {
      source: 'local',
      localPath: '/tmp/my-repo',
      fileRestrictions: [],
    };

    render(<RepoMountSection value={mount} onChange={vi.fn()} />);

    expect(screen.getByTestId('file-restrictions-input')).toBeInTheDocument();
  });

  it('adds a file restriction chip via Enter key', () => {
    const onChange = vi.fn();
    const mount: RepoMount = {
      source: 'local',
      localPath: '/tmp/my-repo',
      fileRestrictions: [],
    };

    render(<RepoMountSection value={mount} onChange={onChange} />);

    const input = screen.getByTestId('file-restrictions-input');
    fireEvent.change(input, { target: { value: 'src/**/*.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        fileRestrictions: ['src/**/*.ts'],
      }),
    );
  });

  it('removes a file restriction chip on click', () => {
    const onChange = vi.fn();
    const mount: RepoMount = {
      source: 'local',
      localPath: '/tmp/my-repo',
      fileRestrictions: ['src/**/*.ts', 'test/**/*.ts'],
    };

    render(<RepoMountSection value={mount} onChange={onChange} />);

    const chips = screen.getAllByTestId('file-restriction-chip');
    expect(chips).toHaveLength(2);

    // Click the remove button on the first chip
    const removeBtn = chips[0].querySelector('button');
    expect(removeBtn).toBeTruthy();
    fireEvent.click(removeBtn!);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        fileRestrictions: ['test/**/*.ts'],
      }),
    );
  });

  it('does not show file restrictions editor when no path is set', () => {
    render(<RepoMountSection value={null} onChange={vi.fn()} />);

    expect(screen.queryByTestId('file-restrictions-input')).not.toBeInTheDocument();
  });
});
