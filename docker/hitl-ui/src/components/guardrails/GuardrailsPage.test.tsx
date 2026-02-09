/**
 * Tests for GuardrailsPage component (P11-F01 T26)
 *
 * Verifies page rendering, title, GuidelinesList presence,
 * empty detail state, editor open on create/edit, audit panel toggle,
 * and ImportExportPanel visibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GuardrailsPage } from './GuardrailsPage';
import type { Guideline } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

const mockSelectGuideline = vi.fn();
const mockOpenEditor = vi.fn();
const mockCloseEditor = vi.fn();
const mockToggleAuditPanel = vi.fn();

interface MockStoreState {
  selectedGuidelineId: string | null;
  isEditorOpen: boolean;
  isCreating: boolean;
  isAuditPanelOpen: boolean;
  selectGuideline: typeof mockSelectGuideline;
  openEditor: typeof mockOpenEditor;
  closeEditor: typeof mockCloseEditor;
  toggleAuditPanel: typeof mockToggleAuditPanel;
}

let storeState: MockStoreState;

vi.mock('../../stores/guardrailsStore', () => ({
  useGuardrailsStore: () => storeState,
}));

// ---------------------------------------------------------------------------
// Mock API hooks
// ---------------------------------------------------------------------------

let mockGuidelineData: Guideline | undefined = undefined;

vi.mock('../../api/guardrails', () => ({
  useGuideline: () => ({ data: mockGuidelineData }),
}));

// ---------------------------------------------------------------------------
// Mock child components to isolate page logic
// ---------------------------------------------------------------------------

vi.mock('./GuidelinesList', () => ({
  GuidelinesList: ({ onCreateNew }: { onCreateNew?: () => void }) => (
    <div data-testid="mock-guidelines-list">
      <button data-testid="mock-create-btn" onClick={onCreateNew}>
        Create
      </button>
    </div>
  ),
}));

vi.mock('./GuidelineEditor', () => ({
  GuidelineEditor: ({
    onSave,
    onCancel,
    isCreating,
  }: {
    onSave?: () => void;
    onCancel?: () => void;
    isCreating?: boolean;
  }) => (
    <div data-testid="mock-guideline-editor">
      <span data-testid="editor-creating">{String(isCreating)}</span>
      <button data-testid="mock-editor-save" onClick={onSave}>
        Save
      </button>
      <button data-testid="mock-editor-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

vi.mock('./GuidelinePreview', () => ({
  GuidelinePreview: () => <div data-testid="mock-guideline-preview" />,
}));

vi.mock('./AuditLogViewer', () => ({
  AuditLogViewer: ({ guidelineId }: { guidelineId?: string | null }) => (
    <div data-testid="mock-audit-log-viewer">
      {guidelineId && (
        <span data-testid="audit-guideline-id">{guidelineId}</span>
      )}
    </div>
  ),
}));

vi.mock('./ImportExportPanel', () => ({
  ImportExportPanel: () => <div data-testid="mock-import-export-panel" />,
}));

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

const sampleGuideline: Guideline = {
  id: 'gl-001',
  name: 'TDD Required',
  description: 'Enforce TDD for all tasks.',
  category: 'tdd_protocol',
  priority: 800,
  enabled: true,
  condition: {},
  action: { action_type: 'instruction', instruction: 'Write tests first.' },
  version: 1,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-20T14:30:00Z',
  created_by: 'admin',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <GuardrailsPage />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GuardrailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuidelineData = undefined;
    storeState = {
      selectedGuidelineId: null,
      isEditorOpen: false,
      isCreating: false,
      isAuditPanelOpen: false,
      selectGuideline: mockSelectGuideline,
      openEditor: mockOpenEditor,
      closeEditor: mockCloseEditor,
      toggleAuditPanel: mockToggleAuditPanel,
    };
  });

  // -------------------------------------------------------------------------
  // 1. Page renders with title
  // -------------------------------------------------------------------------

  it('renders the page with Guardrails Configuration title', () => {
    renderPage();
    expect(screen.getByText('Guardrails Configuration')).toBeInTheDocument();
  });

  it('has the guardrails-page data-testid', () => {
    renderPage();
    expect(screen.getByTestId('guardrails-page')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. GuidelinesList is rendered
  // -------------------------------------------------------------------------

  it('renders the GuidelinesList component', () => {
    renderPage();
    expect(screen.getByTestId('mock-guidelines-list')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Empty detail state when no selection
  // -------------------------------------------------------------------------

  it('shows empty detail state when no guideline is selected', () => {
    renderPage();
    expect(screen.getByTestId('empty-detail')).toBeInTheDocument();
    expect(
      screen.getByText('Select a guideline or create a new one'),
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 4. Editor opens on create new
  // -------------------------------------------------------------------------

  it('calls openEditor(true) when GuidelinesList triggers onCreateNew', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('mock-create-btn'));
    expect(mockSelectGuideline).toHaveBeenCalledWith(null);
    expect(mockOpenEditor).toHaveBeenCalledWith(true);
  });

  // -------------------------------------------------------------------------
  // 5. Editor opens on guideline selection + Edit button
  // -------------------------------------------------------------------------

  it('shows GuidelinePreview and Edit button when a guideline is selected', () => {
    storeState.selectedGuidelineId = 'gl-001';
    mockGuidelineData = sampleGuideline;
    renderPage();

    expect(screen.getByTestId('mock-guideline-preview')).toBeInTheDocument();
    expect(screen.getByTestId('edit-guideline-btn')).toBeInTheDocument();
    expect(screen.getByText('TDD Required')).toBeInTheDocument();
  });

  it('calls openEditor(false) when Edit button is clicked', () => {
    storeState.selectedGuidelineId = 'gl-001';
    mockGuidelineData = sampleGuideline;
    renderPage();

    fireEvent.click(screen.getByTestId('edit-guideline-btn'));
    expect(mockOpenEditor).toHaveBeenCalledWith(false);
  });

  it('shows GuidelineEditor when isEditorOpen is true (edit mode)', () => {
    storeState.selectedGuidelineId = 'gl-001';
    storeState.isEditorOpen = true;
    storeState.isCreating = false;
    mockGuidelineData = sampleGuideline;
    renderPage();

    expect(screen.getByTestId('mock-guideline-editor')).toBeInTheDocument();
    expect(screen.getByTestId('editor-creating').textContent).toBe('false');
  });

  it('shows GuidelineEditor in create mode when isCreating is true', () => {
    storeState.isEditorOpen = true;
    storeState.isCreating = true;
    renderPage();

    expect(screen.getByTestId('mock-guideline-editor')).toBeInTheDocument();
    expect(screen.getByTestId('editor-creating').textContent).toBe('true');
  });

  it('calls closeEditor when editor Save is triggered', () => {
    storeState.isEditorOpen = true;
    storeState.isCreating = true;
    renderPage();

    fireEvent.click(screen.getByTestId('mock-editor-save'));
    expect(mockCloseEditor).toHaveBeenCalled();
  });

  it('calls closeEditor when editor Cancel is triggered', () => {
    storeState.isEditorOpen = true;
    renderPage();

    fireEvent.click(screen.getByTestId('mock-editor-cancel'));
    expect(mockCloseEditor).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 6. Audit panel toggles
  // -------------------------------------------------------------------------

  it('does not show audit panel by default', () => {
    renderPage();
    expect(screen.queryByTestId('audit-panel')).not.toBeInTheDocument();
  });

  it('shows audit panel when isAuditPanelOpen is true', () => {
    storeState.isAuditPanelOpen = true;
    renderPage();

    expect(screen.getByTestId('audit-panel')).toBeInTheDocument();
    expect(screen.getByTestId('mock-audit-log-viewer')).toBeInTheDocument();
  });

  it('calls toggleAuditPanel when Audit Log button is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('toggle-audit-btn'));
    expect(mockToggleAuditPanel).toHaveBeenCalled();
  });

  it('passes selectedGuidelineId to AuditLogViewer', () => {
    storeState.isAuditPanelOpen = true;
    storeState.selectedGuidelineId = 'gl-001';
    renderPage();

    expect(screen.getByTestId('audit-guideline-id').textContent).toBe(
      'gl-001',
    );
  });

  // -------------------------------------------------------------------------
  // 7. Import/Export panel is visible
  // -------------------------------------------------------------------------

  it('renders the ImportExportPanel', () => {
    renderPage();
    expect(
      screen.getByTestId('mock-import-export-panel'),
    ).toBeInTheDocument();
  });
});
