import { useState, useCallback, useMemo, useEffect } from 'react';
import type { WorkItemReference, WorkItemType } from '../../../shared/types/workitem';
import WorkItemCard from './WorkItemCard';

// ---------------------------------------------------------------------------
// Static placeholder data for Ideas tab (no backend yet)
// ---------------------------------------------------------------------------

const MOCK_IDEAS: WorkItemReference[] = [
  {
    id: 'idea-1',
    type: 'idea',
    source: 'manual',
    title: 'AI-powered commit message generation',
    description: 'Use the workflow context and diff to automatically generate meaningful commit messages.',
    labels: ['idea', 'automation'],
  },
];

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'prds' | 'issues' | 'ideas' | 'manual';

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'prds', label: 'PRDs' },
  { id: 'issues', label: 'Issues' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'manual', label: 'Manual' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface WorkItemPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: WorkItemReference) => void;
}

/**
 * Modal dialog for selecting or creating a work item reference.
 *
 * Tabs:
 *  - PRDs: lists work items from .workitems/ directory (mock data for now)
 *  - Issues: lists GitHub issues (mock data for now)
 *  - Ideas: placeholder list
 *  - Manual: textarea for free-form work item input
 *
 * Search input filters items by title. Returns selected WorkItemReference
 * to parent via onSelect callback.
 */
export default function WorkItemPickerDialog({
  isOpen,
  onClose,
  onSelect,
}: WorkItemPickerDialogProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<TabId>('prds');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<WorkItemReference | null>(null);

  // Manual tab state
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');

  // PRD items from IPC (P15-F03 T19)
  const [fsPrds, setFsPrds] = useState<WorkItemReference[]>([]);
  const [prdsLoading, setPrdsLoading] = useState(false);
  const [prdsError, setPrdsError] = useState<string | null>(null);

  // GitHub Issues state (P15-F12 T07)
  const [ghIssues, setGhIssues] = useState<WorkItemReference[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [ghStatus, setGhStatus] = useState<{ available: boolean; authenticated: boolean } | null>(null);

  // Fetch PRDs from filesystem when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    setPrdsLoading(true);
    setPrdsError(null);

    // Load settings to get workItemDirectory, then fetch from filesystem
    const fetchPrds = async () => {
      try {
        const settings = await window.electronAPI.settings.load();
        const dir = settings.workItemDirectory;
        if (!dir) {
          setFsPrds([]);
          setPrdsLoading(false);
          return;
        }
        const items = await window.electronAPI.workitem.listFs(dir);
        setFsPrds(items as WorkItemReference[]);
      } catch (err: unknown) {
        setPrdsError(err instanceof Error ? err.message : 'Failed to load work items');
        setFsPrds([]);
      } finally {
        setPrdsLoading(false);
      }
    };

    fetchPrds();
  }, [isOpen]);

  // Check GitHub CLI availability on mount (P15-F12 T07)
  useEffect(() => {
    if (!isOpen) return;

    window.electronAPI.workitem.checkGhAvailable().then(setGhStatus).catch(() => {
      setGhStatus({ available: false, authenticated: false });
    });
  }, [isOpen]);

  // Fetch GitHub issues when Issues tab becomes active (P15-F12 T07)
  useEffect(() => {
    if (!isOpen || activeTab !== 'issues') return;
    if (!ghStatus || !ghStatus.available || !ghStatus.authenticated) return;

    setIssuesLoading(true);
    window.electronAPI.workitem
      .list('issue')
      .then((items) => {
        setGhIssues(items as WorkItemReference[]);
      })
      .catch(() => {
        setGhIssues([]);
      })
      .finally(() => {
        setIssuesLoading(false);
      });
  }, [isOpen, activeTab, ghStatus]);

  // Get items for current tab
  const tabItems = useMemo((): WorkItemReference[] => {
    switch (activeTab) {
      case 'prds':
        return fsPrds;
      case 'issues':
        return ghIssues;
      case 'ideas':
        return MOCK_IDEAS;
      case 'manual':
        return [];
    }
  }, [activeTab, fsPrds, ghIssues]);

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return tabItems;
    const lower = searchQuery.toLowerCase();
    return tabItems.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        (item.description && item.description.toLowerCase().includes(lower)),
    );
  }, [tabItems, searchQuery]);

  const handleItemClick = useCallback((item: WorkItemReference) => {
    setSelectedItem(item);
  }, []);

  const handleSelect = useCallback(() => {
    if (activeTab === 'manual') {
      if (!manualTitle.trim()) return;
      const manualItem: WorkItemReference = {
        id: `manual-${Date.now()}`,
        type: 'manual',
        source: 'manual',
        title: manualTitle.trim(),
        description: manualDescription.trim() || undefined,
      };
      onSelect(manualItem);
    } else if (selectedItem) {
      onSelect(selectedItem);
    }
    onClose();
  }, [activeTab, selectedItem, manualTitle, manualDescription, onSelect, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const canSelect =
    activeTab === 'manual' ? manualTitle.trim().length > 0 : selectedItem !== null;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-[640px] max-h-[80vh] bg-gray-800 rounded-xl border border-gray-600 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100 mb-3">
            Select Work Item
          </h2>

          {/* Tabs */}
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedItem(null);
                }}
                className={`
                  px-3 py-1.5 text-sm font-medium rounded-t transition-colors
                  ${
                    activeTab === tab.id
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search (not shown for Manual tab) */}
        {activeTab !== 'manual' && (
          <div className="px-5 py-3 border-b border-gray-700/50">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title..."
              className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-[200px]">
          {activeTab === 'prds' && prdsLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
              Loading work items...
            </div>
          ) : activeTab === 'prds' && prdsError ? (
            <div className="flex items-center justify-center h-full text-red-400 text-sm">
              {prdsError}
            </div>
          ) : activeTab === 'issues' && ghStatus && !ghStatus.available ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2">
              <span className="text-lg">⚠️</span>
              <span>GitHub CLI not installed.</span>
              <span className="text-xs text-gray-500">
                Install it from <code className="text-gray-300">https://cli.github.com</code>
              </span>
            </div>
          ) : activeTab === 'issues' && ghStatus && ghStatus.available && !ghStatus.authenticated ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2">
              <span className="text-lg">🔒</span>
              <span>Not authenticated with GitHub.</span>
              <span className="text-xs text-gray-500">
                Run <code className="text-gray-300">gh auth login</code> to authenticate.
              </span>
            </div>
          ) : activeTab === 'issues' && issuesLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
              Loading issues...
            </div>
          ) : activeTab === 'manual' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Enter work item title..."
                  className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Description
                </label>
                <textarea
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Describe the work item (optional)..."
                  rows={6}
                  className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none resize-none"
                />
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              {searchQuery.trim()
                ? 'No items match your search.'
                : activeTab === 'prds'
                  ? 'No work items found. Check Settings > Work Item Directory.'
                  : activeTab === 'ideas'
                    ? 'No ideas yet. Use the Manual tab to create one.'
                    : 'No items found.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <WorkItemCard
                  key={item.id}
                  item={item}
                  onClick={handleItemClick}
                  selected={selectedItem?.id === item.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSelect}
            disabled={!canSelect}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${
                canSelect
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
