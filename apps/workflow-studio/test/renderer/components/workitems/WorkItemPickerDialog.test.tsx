import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkItemPickerDialog from '../../../../src/renderer/components/workitems/WorkItemPickerDialog';
import type { WorkItemReference } from '../../../../src/shared/types/workitem';

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------

const mockSettingsLoad = vi.fn();
const mockWorkitemListFs = vi.fn();

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();

  mockSettingsLoad.mockResolvedValue({
    workItemDirectory: '/tmp/test-workitems',
  });

  (window as any).electronAPI = {
    settings: { load: mockSettingsLoad },
    workitem: { listFs: mockWorkitemListFs },
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
