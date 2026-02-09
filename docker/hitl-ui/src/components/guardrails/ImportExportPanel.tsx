/**
 * ImportExportPanel - Import/Export controls for guidelines (P11-F01 T28)
 *
 * Provides an export button that downloads all guidelines as a JSON file,
 * and an import button with a hidden file picker for importing guidelines
 * from a JSON file. Shows results/errors after import operations.
 */

import { useRef, useState } from 'react';
import { useExportGuidelines, useImportGuidelines } from '@/api/guardrails';
import type { ImportResult } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ImportExportPanelProps {
  onImportComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportExportPanel({ onImportComplete }: ImportExportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const exportMutation = useExportGuidelines();
  const importMutation = useImportGuidelines();

  // -------------------------------------------------------------------------
  // Export handler
  // -------------------------------------------------------------------------

  const handleExport = async () => {
    setErrorMessage(null);
    setImportResult(null);

    try {
      const guidelines = await exportMutation.mutateAsync();
      const json = JSON.stringify(guidelines, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const dateStr = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.href = url;
      link.download = `guardrails-export-${dateStr}.json`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Export failed');
    }
  };

  // -------------------------------------------------------------------------
  // Import handler
  // -------------------------------------------------------------------------

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setImportResult(null);

    try {
      const text = await file.text();

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setErrorMessage('Invalid JSON file. Please check the file format.');
        return;
      }

      if (!Array.isArray(parsed)) {
        setErrorMessage('File content must be an array of guidelines.');
        return;
      }

      const result = await importMutation.mutateAsync(parsed);
      setImportResult(result);
      onImportComplete?.();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Import failed');
    }

    // Reset file input so the same file can be re-imported
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
      data-testid="import-export-panel"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Import / Export
      </h3>

      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          disabled={exportMutation.isPending}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md
            bg-gray-100 text-gray-700 hover:bg-gray-200
            dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="export-btn"
        >
          {exportMutation.isPending ? 'Exporting...' : 'Export JSON'}
        </button>

        <button
          onClick={handleImportClick}
          disabled={importMutation.isPending}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md
            bg-gray-100 text-gray-700 hover:bg-gray-200
            dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="import-btn"
        >
          {importMutation.isPending ? 'Importing...' : 'Import JSON'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
          data-testid="import-file-input"
        />
      </div>

      {/* Import success result */}
      {importResult && (
        <div className="mt-3 space-y-2">
          <div
            className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400"
            data-testid="import-result"
          >
            <span>Imported {importResult.imported} guidelines</span>
          </div>

          {importResult.errors.length > 0 && (
            <div
              className="text-sm text-amber-700 dark:text-amber-400"
              data-testid="import-errors"
            >
              <span>{importResult.errors.length} errors occurred</span>
              <ul className="mt-1 list-disc list-inside text-xs">
                {importResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div
          className="mt-3 text-sm text-red-600 dark:text-red-400"
          data-testid="import-error-message"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}

export default ImportExportPanel;
