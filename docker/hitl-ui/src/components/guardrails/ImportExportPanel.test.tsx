/**
 * Tests for ImportExportPanel component (P11-F01 T28)
 *
 * Verifies export button triggers mutation and file download,
 * import button opens file picker, import results display,
 * error display, and onImportComplete callback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportExportPanel } from './ImportExportPanel';

// ---------------------------------------------------------------------------
// Mock the API hooks
// ---------------------------------------------------------------------------

const mockExportMutate = vi.fn();
const mockImportMutate = vi.fn();

vi.mock('@/api/guardrails', () => ({
  useExportGuidelines: () => ({
    mutateAsync: mockExportMutate,
    isPending: false,
  }),
  useImportGuidelines: () => ({
    mutateAsync: mockImportMutate,
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock File with a working text() method.
 * jsdom File may not always support .text(), so we add it explicitly.
 */
function createJsonFile(content: string, name = 'guidelines.json'): File {
  const file = new File([content], name, { type: 'application/json' });
  // Ensure .text() works in jsdom
  if (!file.text || typeof file.text !== 'function') {
    (file as Record<string, unknown>).text = () => Promise.resolve(content);
  }
  return file;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and URL.revokeObjectURL for download testing
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  describe('Rendering', () => {
    it('renders export and import buttons', () => {
      render(<ImportExportPanel />);

      expect(screen.getByTestId('export-btn')).toBeInTheDocument();
      expect(screen.getByTestId('import-btn')).toBeInTheDocument();
      expect(screen.getByTestId('export-btn')).toHaveTextContent(/Export JSON/i);
      expect(screen.getByTestId('import-btn')).toHaveTextContent(/Import JSON/i);
    });

    it('renders panel heading', () => {
      render(<ImportExportPanel />);

      expect(screen.getByText('Import / Export')).toBeInTheDocument();
    });
  });

  describe('Export', () => {
    it('export button triggers mutation and creates download', async () => {
      const mockGuidelines = [
        { id: 'gl-1', name: 'Guideline 1' },
        { id: 'gl-2', name: 'Guideline 2' },
      ];
      mockExportMutate.mockResolvedValueOnce(mockGuidelines);

      render(<ImportExportPanel />);

      fireEvent.click(screen.getByTestId('export-btn'));

      await waitFor(() => {
        expect(mockExportMutate).toHaveBeenCalledTimes(1);
      });

      // Verify a blob URL was created for download
      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled();
      });

      // Verify the blob URL was cleaned up
      await waitFor(() => {
        expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      });
    });
  });

  describe('Import', () => {
    it('import button opens file picker (hidden input click)', () => {
      render(<ImportExportPanel />);

      const fileInput = screen.getByTestId('import-file-input') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.click(screen.getByTestId('import-btn'));

      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    it('file input only accepts JSON files', () => {
      render(<ImportExportPanel />);

      const fileInput = screen.getByTestId('import-file-input') as HTMLInputElement;
      expect(fileInput.accept).toBe('.json');
    });

    it('import results shown with success count', async () => {
      mockImportMutate.mockResolvedValueOnce({ imported: 5, errors: [] });

      render(<ImportExportPanel />);

      const fileInput = screen.getByTestId('import-file-input') as HTMLInputElement;
      const validJson = JSON.stringify([
        { name: 'G1', category: 'custom', condition: {}, action: { action_type: 'instruction' } },
      ]);
      const file = createJsonFile(validJson);

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-result')).toBeInTheDocument();
        expect(screen.getByTestId('import-result')).toHaveTextContent(/Imported 5 guidelines/i);
      });
    });

    it('import errors shown', async () => {
      mockImportMutate.mockResolvedValueOnce({
        imported: 3,
        errors: ['Row 2: missing name', 'Row 5: invalid category'],
      });

      render(<ImportExportPanel />);

      const fileInput = screen.getByTestId('import-file-input') as HTMLInputElement;
      const validJson = JSON.stringify([
        { name: 'G1', category: 'custom', condition: {}, action: { action_type: 'instruction' } },
      ]);
      const file = createJsonFile(validJson);

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-errors')).toBeInTheDocument();
        expect(screen.getByTestId('import-errors')).toHaveTextContent(/2 errors/i);
      });
    });

    it('onImportComplete callback called on successful import', async () => {
      mockImportMutate.mockResolvedValueOnce({ imported: 3, errors: [] });

      const handleComplete = vi.fn();
      render(<ImportExportPanel onImportComplete={handleComplete} />);

      const fileInput = screen.getByTestId('import-file-input') as HTMLInputElement;
      const validJson = JSON.stringify([
        { name: 'G1', category: 'custom', condition: {}, action: { action_type: 'instruction' } },
      ]);
      const file = createJsonFile(validJson);

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(handleComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('shows parse error for invalid JSON file', async () => {
      render(<ImportExportPanel />);

      const fileInput = screen.getByTestId('import-file-input') as HTMLInputElement;
      const file = createJsonFile('not valid json!!');

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-error-message')).toBeInTheDocument();
        expect(screen.getByTestId('import-error-message')).toHaveTextContent(/Invalid JSON/i);
      });
    });

    it('shows validation error when JSON is not an array', async () => {
      render(<ImportExportPanel />);

      const fileInput = screen.getByTestId('import-file-input') as HTMLInputElement;
      const file = createJsonFile(JSON.stringify({ name: 'not an array' }));

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-error-message')).toBeInTheDocument();
        expect(screen.getByTestId('import-error-message')).toHaveTextContent(/must be an array/i);
      });
    });
  });
});
