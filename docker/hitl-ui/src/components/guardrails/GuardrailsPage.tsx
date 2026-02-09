/**
 * GuardrailsPage - Main guardrails management page (P11-F01 T26)
 *
 * Integrates all guardrails sub-components into a two-column layout
 * with a collapsible audit log panel at the bottom.
 *
 * Left column: GuidelinesList (filterable, sortable, paginated)
 * Right column: GuidelineEditor | GuidelinePreview | Empty state
 * Bottom: AuditLogViewer (collapsible)
 * Header: Import/Export controls, Audit toggle
 */

import { useGuardrailsStore } from '../../stores/guardrailsStore';
import { useGuideline } from '../../api/guardrails';
import { GuidelinesList } from './GuidelinesList';
import { GuidelineEditor } from './GuidelineEditor';
import { GuidelinePreview } from './GuidelinePreview';
import { AuditLogViewer } from './AuditLogViewer';
import { ImportExportPanel } from './ImportExportPanel';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GuardrailsPage() {
  const {
    selectedGuidelineId,
    isEditorOpen,
    isCreating,
    isAuditPanelOpen,
    selectGuideline,
    openEditor,
    closeEditor,
    toggleAuditPanel,
  } = useGuardrailsStore();

  // Fetch selected guideline detail
  const { data: selectedGuideline } = useGuideline(selectedGuidelineId);

  const handleCreateNew = () => {
    selectGuideline(null);
    openEditor(true);
  };

  const handleSave = () => {
    closeEditor();
    // Query cache is invalidated by mutation hooks
  };

  return (
    <div className="h-full flex flex-col" data-testid="guardrails-page">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <h1 className="text-xl font-semibold">Guardrails Configuration</h1>
        <div className="flex items-center gap-2">
          <ImportExportPanel />
          <button
            onClick={toggleAuditPanel}
            data-testid="toggle-audit-btn"
            className={`px-3 py-1.5 text-sm rounded ${
              isAuditPanelOpen
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Audit Log
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Guidelines list */}
        <div className="w-1/3 min-w-[300px] border-r dark:border-gray-700 overflow-y-auto">
          <GuidelinesList onCreateNew={handleCreateNew} />
        </div>

        {/* Right: Editor or Preview or Empty state */}
        <div className="flex-1 overflow-y-auto p-4">
          {isEditorOpen ? (
            <GuidelineEditor
              guideline={isCreating ? null : selectedGuideline}
              isCreating={isCreating}
              onSave={handleSave}
              onCancel={closeEditor}
            />
          ) : selectedGuideline ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">
                  {selectedGuideline.name}
                </h2>
                <button
                  onClick={() => openEditor(false)}
                  data-testid="edit-guideline-btn"
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Edit
                </button>
              </div>
              <GuidelinePreview />
            </div>
          ) : (
            <div
              className="flex items-center justify-center h-full text-gray-400"
              data-testid="empty-detail"
            >
              <p>Select a guideline or create a new one</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Collapsible Audit Log */}
      {isAuditPanelOpen && (
        <div
          className="border-t dark:border-gray-700 max-h-80 overflow-y-auto"
          data-testid="audit-panel"
        >
          <AuditLogViewer guidelineId={selectedGuidelineId} />
        </div>
      )}
    </div>
  );
}

export default GuardrailsPage;
