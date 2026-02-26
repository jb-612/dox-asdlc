import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkItemPickerDialog from '../../../../src/renderer/components/workitems/WorkItemPickerDialog';
import type { WorkItemReference } from '../../../../src/shared/types/workitem';

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------

const mockSettingsLoad = vi.fn();
const mockWorkitemListFs = vi.fn();
const mockWorkitemList = vi.fn();
const mockCheckGhAvailable = vi.fn();

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();

  mockSettingsLoad.mockResolvedValue({
    workItemDirectory: '/tmp/test-workitems',
  });

  mockCheckGhAvailable.mockResolvedValue({ available: true, authenticated: true });
  mockWorkitemList.mockResolvedValue([]);

  (window as any).electronAPI = {
    settings: { load: mockSettingsLoad },
    workitem: {
      listFs: mockWorkitemListFs,
      list: mockWorkitemList,
      checkGhAvailable: mockCheckGhAvailable,
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_FS_PRDS: WorkItemReference[] = [
  {
    id: 'prd-001',
    type: 'prd',
    source: 'filesystem',
    title: 'P15-F03 Execution Enhancements',
    description: 'Template filtering and search for the execute tab',
    labels: ['enhancement'],
  },
  {
    id: 'prd-002',
    type: 'prd',
    source: 'filesystem',
    title: 'P15-F04 Step Gate UX',
    description: 'Block-level gating for multi-step workflows',
    labels: ['ux'],
  },
];

function renderDialog(isOpen = true) {
  return render(
    <WorkItemPickerDialog
      isOpen={isOpen}
      onClose={vi.fn()}
      onSelect={vi.fn()}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkItemPickerDialog IPC wiring (T19)', () => {
  it('calls workitem.listFs() when dialog opens', async () => {
    mockWorkitemListFs.mockResolvedValue(MOCK_FS_PRDS);

    renderDialog(true);

    await waitFor(() => {
      expect(mockSettingsLoad).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockWorkitemListFs).toHaveBeenCalledWith('/tmp/test-workitems');
    });
  });

  it('shows a loading spinner while fetching PRDs', async () => {
    // Make the listFs call hang until we resolve it
    let resolveListFs!: (value: WorkItemReference[]) => void;
    mockWorkitemListFs.mockReturnValue(
      new Promise<WorkItemReference[]>((resolve) => {
        resolveListFs = resolve;
      }),
    );

    renderDialog(true);

    // Spinner should be visible while loading
    await waitFor(() => {
      expect(screen.getByText('Loading work items...')).toBeInTheDocument();
    });

    // Resolve and verify spinner disappears
    resolveListFs(MOCK_FS_PRDS);

    await waitFor(() => {
      expect(screen.queryByText('Loading work items...')).not.toBeInTheDocument();
    });
  });

  it('displays fetched PRD data replacing mock data', async () => {
    mockWorkitemListFs.mockResolvedValue(MOCK_FS_PRDS);

    renderDialog(true);

    // Wait for the fetched PRDs to appear
    await waitFor(() => {
      expect(screen.getByText('P15-F03 Execution Enhancements')).toBeInTheDocument();
    });
    expect(screen.getByText('P15-F04 Step Gate UX')).toBeInTheDocument();
  });

  it('shows error state when listFs fails', async () => {
    mockWorkitemListFs.mockRejectedValue(new Error('Permission denied'));

    renderDialog(true);

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeInTheDocument();
    });
  });

  it('shows empty state with settings hint when workItemDirectory is not set', async () => {
    mockSettingsLoad.mockResolvedValue({ workItemDirectory: '' });

    renderDialog(true);

    await waitFor(() => {
      expect(screen.queryByText('Loading work items...')).not.toBeInTheDocument();
    });

    // Should show the empty state message pointing to Settings
    expect(
      screen.getByText('No work items found. Check Settings > Work Item Directory.'),
    ).toBeInTheDocument();
  });

  it('does not fetch PRDs when dialog is closed', () => {
    renderDialog(false);

    expect(mockSettingsLoad).not.toHaveBeenCalled();
    expect(mockWorkitemListFs).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T07: GitHub Issues IPC wiring
// ---------------------------------------------------------------------------

const MOCK_GH_ISSUES: WorkItemReference[] = [
  {
    id: 'issue-42',
    type: 'issue',
    source: 'github',
    title: '#42: Agent context exceeds token limit',
    description: 'When running Repo Mapper on large repos, context pack exceeds 100K token budget.',
    url: 'https://github.com/org/repo/issues/42',
    labels: ['bug', 'context-control'],
  },
  {
    id: 'issue-57',
    type: 'issue',
    source: 'github',
    title: '#57: Add retry logic for flaky SAST scans',
    description: 'SAST scans intermittently fail due to network timeouts.',
    url: 'https://github.com/org/repo/issues/57',
    labels: ['enhancement', 'quality-gate'],
  },
];

describe('WorkItemPickerDialog GitHub Issues wiring (T07)', () => {
  it('calls IPC to fetch issues when Issues tab is clicked', async () => {
    mockWorkitemListFs.mockResolvedValue([]);
    mockWorkitemList.mockResolvedValue(MOCK_GH_ISSUES);

    renderDialog(true);

    // Click the Issues tab
    const issuesTab = screen.getByRole('button', { name: 'Issues' });
    fireEvent.click(issuesTab);

    await waitFor(() => {
      expect(mockWorkitemList).toHaveBeenCalledWith('issue');
    });
  });

  it('displays loading state while fetching issues', async () => {
    mockWorkitemListFs.mockResolvedValue([]);

    let resolveIssues!: (value: WorkItemReference[]) => void;
    mockWorkitemList.mockReturnValue(
      new Promise<WorkItemReference[]>((resolve) => {
        resolveIssues = resolve;
      }),
    );

    renderDialog(true);

    // Switch to Issues tab
    fireEvent.click(screen.getByRole('button', { name: 'Issues' }));

    await waitFor(() => {
      expect(screen.getByText('Loading issues...')).toBeInTheDocument();
    });

    // Resolve and verify spinner disappears
    resolveIssues(MOCK_GH_ISSUES);

    await waitFor(() => {
      expect(screen.queryByText('Loading issues...')).not.toBeInTheDocument();
    });
  });

  it('renders fetched issues after loading', async () => {
    mockWorkitemListFs.mockResolvedValue([]);
    mockWorkitemList.mockResolvedValue(MOCK_GH_ISSUES);

    renderDialog(true);

    // Switch to Issues tab
    fireEvent.click(screen.getByRole('button', { name: 'Issues' }));

    await waitFor(() => {
      expect(screen.getByText('#42: Agent context exceeds token limit')).toBeInTheDocument();
    });
    expect(screen.getByText('#57: Add retry logic for flaky SAST scans')).toBeInTheDocument();
  });

  it('shows "GitHub CLI not installed" when gh is unavailable', async () => {
    mockWorkitemListFs.mockResolvedValue([]);
    mockCheckGhAvailable.mockResolvedValue({ available: false, authenticated: false });

    renderDialog(true);

    // Switch to Issues tab
    fireEvent.click(screen.getByRole('button', { name: 'Issues' }));

    await waitFor(() => {
      expect(screen.getByText(/GitHub CLI not installed/i)).toBeInTheDocument();
    });
  });

  it('shows "Not authenticated" when gh available but not authed', async () => {
    mockWorkitemListFs.mockResolvedValue([]);
    mockCheckGhAvailable.mockResolvedValue({ available: true, authenticated: false });

    renderDialog(true);

    // Switch to Issues tab
    fireEvent.click(screen.getByRole('button', { name: 'Issues' }));

    await waitFor(() => {
      expect(screen.getByText(/gh auth login/i)).toBeInTheDocument();
    });
  });

  it('search input filters displayed issues', async () => {
    mockWorkitemListFs.mockResolvedValue([]);
    mockWorkitemList.mockResolvedValue(MOCK_GH_ISSUES);

    renderDialog(true);

    // Switch to Issues tab
    fireEvent.click(screen.getByRole('button', { name: 'Issues' }));

    await waitFor(() => {
      expect(screen.getByText('#42: Agent context exceeds token limit')).toBeInTheDocument();
    });

    // Type search query that matches only issue 57
    const searchInput = screen.getByPlaceholderText('Search by title...');
    fireEvent.change(searchInput, { target: { value: 'retry' } });

    expect(screen.queryByText('#42: Agent context exceeds token limit')).not.toBeInTheDocument();
    expect(screen.getByText('#57: Add retry logic for flaky SAST scans')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T08: GitHub Issues end-to-end flow
// ---------------------------------------------------------------------------

describe('WorkItemPickerDialog GitHub Issues e2e flow (T08)', () => {
  it('selected issue has source=github and url set', async () => {
    mockWorkitemListFs.mockResolvedValue([]);
    mockWorkitemList.mockResolvedValue(MOCK_GH_ISSUES);

    const onSelect = vi.fn();
    render(
      <WorkItemPickerDialog isOpen={true} onClose={vi.fn()} onSelect={onSelect} />,
    );

    // Switch to Issues tab
    fireEvent.click(screen.getByRole('button', { name: 'Issues' }));

    await waitFor(() => {
      expect(screen.getByText('#42: Agent context exceeds token limit')).toBeInTheDocument();
    });

    // Click the issue card to select it
    fireEvent.click(screen.getByText('#42: Agent context exceeds token limit'));

    // Click the Select button
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'github',
        url: 'https://github.com/org/repo/issues/42',
      }),
    );
  });

  it('WorkItemReference has correct number, title, labels', async () => {
    mockWorkitemListFs.mockResolvedValue([]);
    mockWorkitemList.mockResolvedValue(MOCK_GH_ISSUES);

    const onSelect = vi.fn();
    render(
      <WorkItemPickerDialog isOpen={true} onClose={vi.fn()} onSelect={onSelect} />,
    );

    // Switch to Issues tab
    fireEvent.click(screen.getByRole('button', { name: 'Issues' }));

    await waitFor(() => {
      expect(screen.getByText('#42: Agent context exceeds token limit')).toBeInTheDocument();
    });

    // Click the issue card then Select
    fireEvent.click(screen.getByText('#42: Agent context exceeds token limit'));
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));

    const selected = onSelect.mock.calls[0][0] as WorkItemReference;
    expect(selected.id).toBe('issue-42');
    expect(selected.title).toBe('#42: Agent context exceeds token limit');
    expect(selected.labels).toEqual(['bug', 'context-control']);
    expect(selected.type).toBe('issue');
  });
});
