import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkflowSummary } from '../../preload/electron-api';
import { useWorkflowStore } from '../stores/workflowStore';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { NODE_TYPE_METADATA } from '../../shared/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'active' | 'paused';

// ---------------------------------------------------------------------------
// Template Card (inline — uses real WorkflowSummary, not WorkflowDefinition)
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: WorkflowSummary;
  onEdit: (id: string) => void;
  onEditInStudio: (id: string) => void;
  onUse: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onDuplicate: (id: string) => void;
}

function TemplateCard({
  template,
  onEdit,
  onEditInStudio,
  onUse,
  onDelete,
  onToggleStatus,
  onDuplicate,
}: TemplateCardProps): JSX.Element {
  const hasStudioTag = (template.tags ?? []).includes('studio-block-composer');
  const status = template.status ?? 'active';

  return (
    <div
      data-testid={`template-card-${template.id}`}
      className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-500 transition-colors flex flex-col"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-100 truncate flex-1">
          {template.name}
        </h3>
        <button
          type="button"
          data-testid={`status-badge-${template.id}`}
          onClick={() => onToggleStatus(template.id)}
          className="shrink-0 cursor-pointer"
          title={`Click to ${status === 'active' ? 'pause' : 'activate'}`}
        >
          <StatusBadge status={status} />
        </button>
      </div>

      {/* Description */}
      {template.description && (
        <p className="px-4 text-xs text-gray-400 line-clamp-2 leading-relaxed">
          {template.description}
        </p>
      )}

      {/* Stats */}
      <div className="px-4 py-2 flex items-center gap-3">
        <span className="text-[10px] text-gray-500">
          {template.nodeCount} node{template.nodeCount !== 1 ? 's' : ''}
        </span>
        {template.updatedAt && (
          <span className="text-[10px] text-gray-500">
            {new Date(template.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Tags */}
      {template.tags && template.tags.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto px-4 py-3 border-t border-gray-700 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onUse(template.id)}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          Use
        </button>
        <button
          type="button"
          onClick={() => onEdit(template.id)}
          className="px-3 py-1.5 text-xs font-medium rounded text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Edit
        </button>
        {hasStudioTag && (
          <button
            type="button"
            data-testid={`edit-in-studio-${template.id}`}
            onClick={() => onEditInStudio(template.id)}
            className="px-3 py-1.5 text-xs font-medium rounded text-blue-400 hover:bg-blue-900/30 transition-colors"
          >
            Studio
          </button>
        )}
        <button
          type="button"
          onClick={() => onDuplicate(template.id)}
          className="px-3 py-1.5 text-xs font-medium rounded text-gray-400 hover:bg-gray-700 transition-colors"
          title="Duplicate"
        >
          Dup
        </button>
        <button
          type="button"
          onClick={() => onDelete(template.id)}
          className="px-3 py-1.5 text-xs font-medium rounded text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
        >
          Del
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TemplateManagerPage(): JSX.Element {
  const navigate = useNavigate();
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);

  // ---- Data state ----
  const [templates, setTemplates] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Filter state ----
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // ---- Delete confirmation state ----
  const [deleteTarget, setDeleteTarget] = useState<WorkflowSummary | null>(null);

  // ---- Debounce search (300ms) ----
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceTimer.current = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [searchText]);

  // ---- Load templates ----
  const loadTemplates = useCallback(async () => {
    try {
      const list = await window.electronAPI.template.list();
      setTemplates(list);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ---- Derived: all unique tags ----
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of templates) {
      for (const tag of t.tags ?? []) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [templates]);

  // ---- Filtered templates ----
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return templates.filter((t) => {
      // Status filter
      const status = t.status ?? 'active';
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      // Tag filter
      if (selectedTag && !(t.tags ?? []).includes(selectedTag)) return false;

      // Text search by name and tags
      if (q) {
        const nameMatch = t.name.toLowerCase().includes(q);
        const tagMatch = (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q));
        if (!nameMatch && !tagMatch) return false;
      }

      return true;
    });
  }, [templates, debouncedSearch, statusFilter, selectedTag]);

  // ---- Handlers ----
  const handleToggleStatus = useCallback(async (id: string) => {
    // Optimistic update
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: (t.status ?? 'active') === 'active' ? 'paused' as const : 'active' as const }
          : t,
      ),
    );
    try {
      await window.electronAPI.template.toggleStatus(id);
    } catch {
      // Revert on failure
      loadTemplates();
    }
  }, [loadTemplates]);

  const handleDuplicate = useCallback(async (id: string) => {
    await window.electronAPI.template.duplicate(id);
    loadTemplates();
  }, [loadTemplates]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await window.electronAPI.template.delete(deleteTarget.id);
    setDeleteTarget(null);
    loadTemplates();
  }, [deleteTarget, loadTemplates]);

  const handleUse = useCallback(async (id: string) => {
    const wf = await window.electronAPI.template.load(id);
    if (wf) {
      const clone = JSON.parse(JSON.stringify(wf));
      clone.metadata.createdAt = new Date().toISOString();
      clone.metadata.updatedAt = new Date().toISOString();
      setWorkflow(clone);
      navigate('/');
    }
  }, [setWorkflow, navigate]);

  const handleEdit = useCallback(async (id: string) => {
    const wf = await window.electronAPI.template.load(id);
    if (wf) {
      setWorkflow(wf);
      navigate('/');
    }
  }, [setWorkflow, navigate]);

  const handleEditInStudio = useCallback((id: string) => {
    navigate(`/studio?templateId=${encodeURIComponent(id)}`);
  }, [navigate]);

  const handleNewTemplate = useCallback(() => {
    const newWorkflow = useWorkflowStore.getState().newWorkflow;
    newWorkflow();
    navigate('/');
  }, [navigate]);

  // ---- Render ----
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Templates</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage workflow templates. Active templates appear in Execute.
          </p>
        </div>
        <button
          type="button"
          data-testid="new-template-btn"
          onClick={handleNewTemplate}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          New Template
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-gray-700/50 flex items-center gap-4 shrink-0 flex-wrap">
        {/* Search */}
        <input
          type="text"
          data-testid="template-search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search templates..."
          className="w-64 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
        />

        {/* Status filter */}
        <div data-testid="status-filter" className="flex items-center gap-1">
          {(['all', 'active', 'paused'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                statusFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div data-testid="tag-filter" className="flex items-center gap-1 flex-wrap">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
                  selectedTag === tag
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">Loading templates...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg
              className="w-12 h-12 text-gray-600 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            {templates.length === 0 ? (
              <>
                <h3 className="text-lg font-medium text-gray-400 mb-1">No templates yet</h3>
                <p className="text-sm text-gray-500">
                  Click "New Template" to create your first workflow template.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-gray-400 mb-1">
                  No templates match your search
                </h3>
                <p className="text-sm text-gray-500">
                  Try adjusting your search or filters.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={handleEdit}
                onEditInStudio={handleEditInStudio}
                onUse={handleUse}
                onDelete={(id) => {
                  const t = templates.find((tpl) => tpl.id === id);
                  if (t) setDeleteTarget(t);
                }}
                onToggleStatus={handleToggleStatus}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Template"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
      {/* Hidden element for E2E test targeting */}
      {deleteTarget && <div data-testid="delete-confirm-dialog" style={{ display: 'none' }} />}
    </div>
  );
}
