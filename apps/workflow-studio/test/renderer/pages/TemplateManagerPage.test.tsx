import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import type { WorkflowSummary } from '../../../src/preload/electron-api';

// ---------------------------------------------------------------------------
// Mock window.electronAPI before importing the component
// ---------------------------------------------------------------------------

const mockTemplateList = vi.fn();
const mockTemplateLoad = vi.fn();
const mockTemplateSave = vi.fn();
const mockTemplateDelete = vi.fn();
const mockTemplateToggleStatus = vi.fn();
const mockTemplateDuplicate = vi.fn();

const mockNavigate = vi.fn();

// Mock react-router-dom navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();

  mockTemplateList.mockResolvedValue([]);
  mockTemplateLoad.mockResolvedValue(null);
  mockTemplateSave.mockResolvedValue({ success: true });
  mockTemplateDelete.mockResolvedValue({ success: true });
  mockTemplateToggleStatus.mockResolvedValue({ success: true, status: 'paused' });
  mockTemplateDuplicate.mockResolvedValue({ success: true });

  Object.defineProperty(window, 'electronAPI', {
    value: {
      template: {
        list: mockTemplateList,
        load: mockTemplateLoad,
        save: mockTemplateSave,
        delete: mockTemplateDelete,
        toggleStatus: mockTemplateToggleStatus,
        duplicate: mockTemplateDuplicate,
      },
      onEvent: vi.fn(),
      removeListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
});

// ---------------------------------------------------------------------------
// Import AFTER mock setup
// ---------------------------------------------------------------------------

import TemplateManagerPage from '../../../src/renderer/pages/TemplateManagerPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTemplate(overrides?: Partial<WorkflowSummary>): WorkflowSummary {
  return {
    id: 'tpl-001',
    name: 'Test Template',
    description: 'A test workflow template',
    version: '1.0.0',
    updatedAt: '2026-02-20T10:00:00Z',
    nodeCount: 5,
    tags: ['ci', 'deploy'],
    status: 'active',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TemplateManagerPage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TemplateManagerPage', () => {
  // =========================================================================
  // Rendering basics
  // =========================================================================

  describe('rendering', () => {
    it('renders the page header with "Templates" title', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Templates')).toBeInTheDocument();
      });
    });

    it('shows a loading state before templates are loaded', () => {
      mockTemplateList.mockReturnValue(new Promise(() => {})); // Never resolves
      renderPage();

      expect(screen.getByText('Loading templates...')).toBeInTheDocument();
    });

    it('calls template.list() on mount', async () => {
      renderPage();

      await waitFor(() => {
        expect(mockTemplateList).toHaveBeenCalledTimes(1);
      });
    });

    it('shows "No templates yet" when the list is empty', async () => {
      mockTemplateList.mockResolvedValue([]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('No templates yet')).toBeInTheDocument();
      });
    });

    it('shows error message when template.list() throws', async () => {
      mockTemplateList.mockRejectedValue(new Error('IPC failed'));
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('IPC failed')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Rendering template list from IPC
  // =========================================================================

  describe('template list rendering', () => {
    it('renders template cards from IPC data', async () => {
      const templates = [
        makeTemplate({ id: 'tpl-1', name: 'CI Pipeline' }),
        makeTemplate({ id: 'tpl-2', name: 'Deploy Workflow' }),
        makeTemplate({ id: 'tpl-3', name: 'Review Swarm' }),
      ];
      mockTemplateList.mockResolvedValue(templates);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('CI Pipeline')).toBeInTheDocument();
      });
      expect(screen.getByText('Deploy Workflow')).toBeInTheDocument();
      expect(screen.getByText('Review Swarm')).toBeInTheDocument();
    });

    it('renders template card with node count', async () => {
      mockTemplateList.mockResolvedValue([makeTemplate({ nodeCount: 8 })]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('8 nodes')).toBeInTheDocument();
      });
    });

    it('renders singular "node" for count of 1', async () => {
      mockTemplateList.mockResolvedValue([makeTemplate({ nodeCount: 1 })]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('1 node')).toBeInTheDocument();
      });
    });

    it('renders template tags as chips on the card', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', tags: ['ci', 'deploy', 'production'] }),
      ]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('template-card-tpl-1')).toBeInTheDocument();
      });

      const card = screen.getByTestId('template-card-tpl-1');
      // Tags appear both in the card and in the tag filter bar, so check within the card
      expect(card.textContent).toContain('ci');
      expect(card.textContent).toContain('deploy');
      expect(card.textContent).toContain('production');
    });

    it('renders template description', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ description: 'Automated CI/CD pipeline for microservices' }),
      ]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Automated CI/CD pipeline for microservices')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Search / text filter
  // =========================================================================

  describe('search by name', () => {
    it('renders a search input', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('template-search')).toBeInTheDocument();
      });
    });

    it('filters templates by name match', async () => {
      const templates = [
        makeTemplate({ id: 'tpl-1', name: 'CI Pipeline', tags: [] }),
        makeTemplate({ id: 'tpl-2', name: 'Deploy Workflow', tags: [] }),
      ];
      mockTemplateList.mockResolvedValue(templates);

      renderPage();

      // Wait for initial data load
      await waitFor(() => {
        expect(screen.getByText('CI Pipeline')).toBeInTheDocument();
      });

      // Switch to fake timers for debounce control
      vi.useFakeTimers();

      const searchInput = screen.getByTestId('template-search');

      // Change fires synchronously, then React schedules a re-render
      fireEvent.change(searchInput, { target: { value: 'Deploy' } });

      // Flush the React re-render which creates the useEffect
      await act(async () => {});

      // Now the useEffect has scheduled a setTimeout(300ms)
      // Advance timers past the debounce
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      vi.useRealTimers();

      expect(screen.queryByText('CI Pipeline')).not.toBeInTheDocument();
      expect(screen.getByText('Deploy Workflow')).toBeInTheDocument();
    });

    it('shows "No templates match your search" when search returns nothing', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'CI Pipeline', tags: [] }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('CI Pipeline')).toBeInTheDocument();
      });

      vi.useFakeTimers();

      const searchInput = screen.getByTestId('template-search');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      // Flush the React re-render which creates the useEffect
      await act(async () => {});

      // Advance past the 300ms debounce
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      vi.useRealTimers();

      expect(screen.getByText('No templates match your search')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Status filter
  // =========================================================================

  describe('status filter', () => {
    it('renders status filter buttons: All, Active, Paused', async () => {
      renderPage();

      await waitFor(() => {
        const statusFilter = screen.getByTestId('status-filter');
        expect(statusFilter).toBeInTheDocument();
      });
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });

    it('defaults to "All" filter', async () => {
      const templates = [
        makeTemplate({ id: 'tpl-1', name: 'Active One', status: 'active' }),
        makeTemplate({ id: 'tpl-2', name: 'Paused One', status: 'paused' }),
      ];
      mockTemplateList.mockResolvedValue(templates);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Active One')).toBeInTheDocument();
      });
      expect(screen.getByText('Paused One')).toBeInTheDocument();
    });

    it('filters to show only active templates when "Active" is clicked', async () => {
      const templates = [
        makeTemplate({ id: 'tpl-1', name: 'Active One', status: 'active' }),
        makeTemplate({ id: 'tpl-2', name: 'Paused One', status: 'paused' }),
      ];
      mockTemplateList.mockResolvedValue(templates);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Active One')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Active'));

      await waitFor(() => {
        expect(screen.queryByText('Paused One')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Active One')).toBeInTheDocument();
    });

    it('filters to show only paused templates when "Paused" is clicked', async () => {
      const templates = [
        makeTemplate({ id: 'tpl-1', name: 'Active One', status: 'active' }),
        makeTemplate({ id: 'tpl-2', name: 'Paused One', status: 'paused' }),
      ];
      mockTemplateList.mockResolvedValue(templates);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Active One')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Paused'));

      await waitFor(() => {
        expect(screen.queryByText('Active One')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Paused One')).toBeInTheDocument();
    });

    it('shows all templates when "All" is clicked after filtering', async () => {
      const templates = [
        makeTemplate({ id: 'tpl-1', name: 'Active One', status: 'active' }),
        makeTemplate({ id: 'tpl-2', name: 'Paused One', status: 'paused' }),
      ];
      mockTemplateList.mockResolvedValue(templates);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Active One')).toBeInTheDocument();
      });

      // Filter to Active only
      fireEvent.click(screen.getByText('Active'));
      await waitFor(() => {
        expect(screen.queryByText('Paused One')).not.toBeInTheDocument();
      });

      // Click All to reset
      fireEvent.click(screen.getByText('All'));
      await waitFor(() => {
        expect(screen.getByText('Active One')).toBeInTheDocument();
        expect(screen.getByText('Paused One')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Tag filter
  // =========================================================================

  describe('tag filter', () => {
    it('renders tag filter chips from all template tags', async () => {
      const templates = [
        makeTemplate({ id: 'tpl-1', tags: ['ci', 'deploy'] }),
        makeTemplate({ id: 'tpl-2', tags: ['deploy', 'production'] }),
      ];
      mockTemplateList.mockResolvedValue(templates);

      renderPage();

      await waitFor(() => {
        const tagFilter = screen.getByTestId('tag-filter');
        expect(tagFilter).toBeInTheDocument();
      });
    });

    it('filters templates by selected tag', async () => {
      const templates = [
        makeTemplate({ id: 'tpl-1', name: 'CI Only', tags: ['ci'] }),
        makeTemplate({ id: 'tpl-2', name: 'Deploy Only', tags: ['deploy'] }),
      ];
      mockTemplateList.mockResolvedValue(templates);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('CI Only')).toBeInTheDocument();
      });

      // Click the "ci" tag chip in the tag-filter area
      const tagFilter = screen.getByTestId('tag-filter');
      const ciButton = tagFilter.querySelector('button');
      if (ciButton) fireEvent.click(ciButton);

      await waitFor(() => {
        // Should show CI Only but not Deploy Only (ci tag filter)
        expect(screen.getByText('CI Only')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Status badge per card
  // =========================================================================

  describe('status badge per card', () => {
    it('renders a status badge on each template card', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'My Template', status: 'active' }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('status-badge-tpl-1')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // New Template button
  // =========================================================================

  describe('new template button', () => {
    it('renders a "New Template" button', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('new-template-btn')).toBeInTheDocument();
      });
    });

    it('navigates to /studio when "New Template" is clicked', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('new-template-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('new-template-btn'));

      expect(mockNavigate).toHaveBeenCalledWith('/studio');
    });
  });

  // =========================================================================
  // Task 3: Status toggle, duplicate, delete
  // =========================================================================

  describe('status toggle', () => {
    it('calls template.toggleStatus when status badge is clicked', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', status: 'active' }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('status-badge-tpl-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('status-badge-tpl-1'));

      await waitFor(() => {
        expect(mockTemplateToggleStatus).toHaveBeenCalledWith('tpl-1');
      });
    });

    it('performs optimistic status update on toggle', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', status: 'active' }),
      ]);
      // Make toggleStatus hang so we can observe optimistic update
      mockTemplateToggleStatus.mockReturnValue(new Promise(() => {}));

      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('status-badge-tpl-1')).toBeInTheDocument();
      });

      // The badge should show "active" initially
      expect(screen.getByText('active')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('status-badge-tpl-1'));
      });

      // After optimistic update, should show "paused"
      await waitFor(() => {
        expect(screen.getByText('paused')).toBeInTheDocument();
      });
    });
  });

  describe('duplicate', () => {
    it('calls template.duplicate when Dup button is clicked', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'My Template' }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('My Template')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Dup'));

      await waitFor(() => {
        expect(mockTemplateDuplicate).toHaveBeenCalledWith('tpl-1');
      });
    });

    it('reloads the template list after duplicating', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'My Template' }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('My Template')).toBeInTheDocument();
      });

      // First call is the initial load
      expect(mockTemplateList).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('Dup'));

      // Should reload list after duplicate
      await waitFor(() => {
        expect(mockTemplateList).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('delete with confirmation', () => {
    it('shows a confirmation dialog when Del button is clicked', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'Doomed Template' }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Doomed Template')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Del'));

      // The ConfirmDialog should appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('shows template name and "cannot be undone" warning in the confirmation dialog', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'Doomed Template' }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Doomed Template')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Del'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        // The dialog message should contain the template name and the warning
        expect(dialog.textContent).toContain('Doomed Template');
        expect(dialog.textContent).toMatch(/cannot be undone/i);
      });
    });

    it('shows a red "Delete" confirm button in the dialog', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'Doomed Template' }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Doomed Template')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Del'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        const deleteBtn = dialog.querySelector('button:last-child');
        expect(deleteBtn).toBeTruthy();
        expect(deleteBtn!.textContent).toBe('Delete');
      });
    });

    it('calls template.delete when confirm button is clicked', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'Doomed Template' }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Doomed Template')).toBeInTheDocument();
      });

      // Open delete confirmation
      fireEvent.click(screen.getByText('Del'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find and click the Delete confirm button inside the dialog
      const dialog = screen.getByRole('dialog');
      const buttons = dialog.querySelectorAll('button');
      const confirmBtn = Array.from(buttons).find((b) => b.textContent === 'Delete');
      expect(confirmBtn).toBeTruthy();

      fireEvent.click(confirmBtn!);

      await waitFor(() => {
        expect(mockTemplateDelete).toHaveBeenCalledWith('tpl-1');
      });
    });

    it('does not call template.delete when Cancel is clicked in the dialog', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'Safe Template' }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Safe Template')).toBeInTheDocument();
      });

      // Open delete confirmation
      fireEvent.click(screen.getByText('Del'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click Cancel
      const dialog = screen.getByRole('dialog');
      const buttons = dialog.querySelectorAll('button');
      const cancelBtn = Array.from(buttons).find((b) => b.textContent === 'Cancel');
      expect(cancelBtn).toBeTruthy();

      fireEvent.click(cancelBtn!);

      // Dialog should close, delete should not be called
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(mockTemplateDelete).not.toHaveBeenCalled();
    });

    it('reloads template list after successful delete', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'Doomed Template' }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Doomed Template')).toBeInTheDocument();
      });

      expect(mockTemplateList).toHaveBeenCalledTimes(1);

      // Open delete confirmation and confirm
      fireEvent.click(screen.getByText('Del'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(
        (b) => b.textContent === 'Delete',
      );
      fireEvent.click(confirmBtn!);

      await waitFor(() => {
        expect(mockTemplateList).toHaveBeenCalledTimes(2);
      });
    });
  });

  // =========================================================================
  // Edit and Use actions
  // =========================================================================

  describe('edit action', () => {
    it('navigates to /studio with templateId when Edit is clicked', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'Editable Template' }),
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Editable Template')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit'));

      expect(mockNavigate).toHaveBeenCalledWith('/studio?templateId=tpl-1');
    });
  });

  describe('use action', () => {
    it('calls template.load and navigates to / when Use is clicked', async () => {
      mockTemplateList.mockResolvedValue([
        makeTemplate({ id: 'tpl-1', name: 'Usable Template' }),
      ]);
      mockTemplateLoad.mockResolvedValue({
        metadata: { createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        nodes: [],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Usable Template')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Use'));

      await waitFor(() => {
        expect(mockTemplateLoad).toHaveBeenCalledWith('tpl-1');
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });
});
