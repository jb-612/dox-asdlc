/**
 * PodDetailDrawer - Slide-out drawer showing pod details
 *
 * Displays:
 * - Pod metadata (name, namespace, labels, annotations)
 * - Owner reference with link
 * - Tabs: Info | Containers | Events | Logs
 */

import { Fragment, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import {
  XMarkIcon,
  InformationCircleIcon,
  CubeIcon,
  BellAlertIcon,
  DocumentTextIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  PlayIcon,
  PauseIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { K8sPod, Container, PodStatus, K8sEventObject } from '../../api/types/kubernetes';

export interface PodDetailDrawerProps {
  /** Pod to display details for */
  pod: K8sPod | null;
  /** Whether drawer is open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Pod events (for Events tab) */
  events?: PodEvent[];
  /** Pod logs (for Logs tab) */
  logs?: string;
  /** Is logs loading */
  isLogsLoading?: boolean;
  /** Selected container for logs */
  selectedContainer?: string;
  /** On container select for logs */
  onContainerSelect?: (containerName: string) => void;
  /** Custom class name */
  className?: string;
}

// Pod event for Events tab
export interface PodEvent {
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  timestamp: string;
  count?: number;
}

// Tab definitions
const tabs = [
  { id: 'info', name: 'Info', icon: InformationCircleIcon },
  { id: 'containers', name: 'Containers', icon: CubeIcon },
  { id: 'events', name: 'Events', icon: BellAlertIcon },
  { id: 'logs', name: 'Logs', icon: DocumentTextIcon },
] as const;

type TabId = typeof tabs[number]['id'];

// Status colors for containers
const containerStateColors = {
  running: 'text-status-success bg-status-success/10',
  waiting: 'text-status-warning bg-status-warning/10',
  terminated: 'text-status-error bg-status-error/10',
};

// Event type colors
const eventTypeColors = {
  Normal: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  Warning: 'text-status-warning bg-status-warning/10 border-status-warning/30',
};

// ============================================================================
// Info Tab Component
// ============================================================================

interface InfoTabProps {
  pod: K8sPod;
}

function InfoTab({ pod }: InfoTabProps) {
  return (
    <div className="space-y-6" data-testid="info-tab">
      {/* Basic Info */}
      <section>
        <h4 className="text-sm font-semibold text-text-primary mb-3">Basic Information</h4>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-text-muted">Name</dt>
            <dd className="text-text-primary font-medium break-all" data-testid="pod-name">
              {pod.name}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Namespace</dt>
            <dd className="text-text-primary" data-testid="pod-namespace">{pod.namespace}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Status</dt>
            <dd data-testid="pod-status">
              <StatusBadge status={pod.status} />
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Phase</dt>
            <dd className="text-text-primary">{pod.phase}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Node</dt>
            <dd className="text-text-primary" data-testid="pod-node">{pod.nodeName || '-'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Age</dt>
            <dd className="text-text-primary">{pod.age}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Pod IP</dt>
            <dd className="text-text-primary font-mono text-xs">{pod.podIP || '-'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Host IP</dt>
            <dd className="text-text-primary font-mono text-xs">{pod.hostIP || '-'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Restarts</dt>
            <dd className={clsx(
              'font-medium',
              pod.restarts > 5 && 'text-status-error',
              pod.restarts > 0 && pod.restarts <= 5 && 'text-status-warning',
              pod.restarts === 0 && 'text-text-primary'
            )}>
              {pod.restarts}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Created</dt>
            <dd className="text-text-primary text-xs">
              {new Date(pod.createdAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </section>

      {/* Owner Reference */}
      <section>
        <h4 className="text-sm font-semibold text-text-primary mb-3">Owner Reference</h4>
        <div className="flex items-center gap-2 text-sm" data-testid="owner-reference">
          <span className="px-2 py-1 rounded bg-bg-tertiary text-text-muted text-xs">
            {pod.ownerKind}
          </span>
          <span className="text-accent-blue hover:underline cursor-pointer">
            {pod.ownerName}
          </span>
        </div>
      </section>

      {/* Labels */}
      {Object.keys(pod.labels).length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-text-primary mb-3">Labels</h4>
          <div className="flex flex-wrap gap-2" data-testid="pod-labels">
            {Object.entries(pod.labels).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex px-2 py-1 rounded bg-bg-tertiary text-xs"
              >
                <span className="text-text-muted">{key}:</span>
                <span className="text-text-primary ml-1">{value}</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// Containers Tab Component
// ============================================================================

interface ContainersTabProps {
  containers: Container[];
}

function ContainersTab({ containers }: ContainersTabProps) {
  return (
    <div className="space-y-4" data-testid="containers-tab">
      {containers.length === 0 ? (
        <p className="text-text-muted text-sm">No containers found</p>
      ) : (
        containers.map((container) => (
          <div
            key={container.name}
            className="p-4 rounded-lg bg-bg-tertiary/50 border border-border-primary"
            data-testid={`container-${container.name}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h5 className="font-medium text-text-primary" data-testid="container-name">
                  {container.name}
                </h5>
                <p className="text-xs text-text-muted font-mono mt-1 break-all" data-testid="container-image">
                  {container.image}
                </p>
              </div>
              <span
                className={clsx(
                  'px-2 py-1 rounded-full text-xs font-medium capitalize',
                  containerStateColors[container.state]
                )}
                data-testid="container-state"
              >
                {container.state}
                {container.stateReason && ` (${container.stateReason})`}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-text-muted">Ready</dt>
                <dd className={container.ready ? 'text-status-success' : 'text-status-error'}>
                  {container.ready ? 'Yes' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Restarts</dt>
                <dd className={clsx(
                  container.restartCount > 5 && 'text-status-error',
                  container.restartCount > 0 && container.restartCount <= 5 && 'text-status-warning',
                  container.restartCount === 0 && 'text-text-primary'
                )}>
                  {container.restartCount}
                </dd>
              </div>
            </dl>
            {container.lastState && (
              <div className="mt-3 pt-3 border-t border-border-primary">
                <p className="text-xs text-text-muted mb-1">Last State:</p>
                <p className="text-xs text-text-secondary">
                  {container.lastState.state}
                  {container.lastState.reason && ` - ${container.lastState.reason}`}
                  {container.lastState.exitCode !== undefined && ` (exit code: ${container.lastState.exitCode})`}
                </p>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// Events Tab Component
// ============================================================================

interface EventsTabProps {
  events: PodEvent[];
}

function EventsTab({ events }: EventsTabProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'Normal' | 'Warning'>('all');

  const filteredEvents = useMemo(() => {
    if (typeFilter === 'all') return events;
    return events.filter((e) => e.type === typeFilter);
  }, [events, typeFilter]);

  return (
    <div className="space-y-4" data-testid="events-tab">
      {/* Type filter */}
      <div className="flex gap-2" data-testid="event-type-filter">
        {(['all', 'Normal', 'Warning'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              typeFilter === type
                ? 'bg-accent-blue text-white'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
            )}
            data-testid={`filter-${type.toLowerCase()}`}
          >
            {type === 'all' ? 'All' : type}
          </button>
        ))}
      </div>

      {/* Events list */}
      {filteredEvents.length === 0 ? (
        <p className="text-text-muted text-sm py-4">No events found</p>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((event, index) => (
            <div
              key={`${event.reason}-${event.timestamp}-${index}`}
              className={clsx(
                'p-3 rounded-lg border',
                eventTypeColors[event.type]
              )}
              data-testid={`event-${index}`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-medium text-sm">{event.reason}</span>
                <span className="text-xs opacity-75">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm opacity-90">{event.message}</p>
              {event.count && event.count > 1 && (
                <p className="text-xs mt-1 opacity-75">Count: {event.count}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Logs Tab Component
// ============================================================================

interface LogsTabProps {
  logs: string;
  isLoading: boolean;
  containers: Container[];
  selectedContainer?: string;
  onContainerSelect?: (name: string) => void;
}

function LogsTab({
  logs,
  isLoading,
  containers,
  selectedContainer,
  onContainerSelect,
}: LogsTabProps) {
  const logsContainerRef = useRef<HTMLPreElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle scroll to detect user scrolling up
  const handleScroll = useCallback(() => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // Copy logs to clipboard
  const handleCopyLogs = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(logs);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  }, [logs]);

  // Download logs as file
  const handleDownloadLogs = useCallback(() => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pod-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [logs]);

  // Filter logs by search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const lines = logs.split('\n');
    const filtered = lines.filter((line) =>
      line.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return filtered.join('\n');
  }, [logs, searchQuery]);

  return (
    <div className="flex flex-col h-[400px]" data-testid="logs-tab">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Container selector */}
        {containers.length > 1 && (
          <select
            value={selectedContainer || containers[0]?.name || ''}
            onChange={(e) => onContainerSelect?.(e.target.value)}
            className="bg-bg-tertiary rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
            data-testid="container-selector"
          >
            {containers.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {/* Search input */}
        <div className="relative flex-1 min-w-[150px]">
          <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-bg-tertiary rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
            data-testid="log-search"
          />
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={clsx(
              'p-1.5 rounded',
              autoScroll
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
            )}
            title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
            data-testid="auto-scroll-toggle"
          >
            {autoScroll ? (
              <PlayIcon className="h-4 w-4" />
            ) : (
              <PauseIcon className="h-4 w-4" />
            )}
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded bg-bg-tertiary text-text-muted hover:text-text-primary"
            title="Copy logs"
            data-testid="copy-logs"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
            {copiedFeedback && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-bg-primary text-text-primary text-xs rounded shadow">
                Copied!
              </span>
            )}
          </button>

          {/* Download button */}
          <button
            onClick={handleDownloadLogs}
            className="p-1.5 rounded bg-bg-tertiary text-text-muted hover:text-text-primary"
            title="Download logs"
            data-testid="download-logs"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Logs viewer */}
      <pre
        ref={logsContainerRef}
        onScroll={handleScroll}
        className={clsx(
          'flex-1 p-4 rounded-lg bg-[#0d1117] text-[#c9d1d9] font-mono text-xs',
          'overflow-auto whitespace-pre-wrap break-words',
          'border border-[#30363d]'
        )}
        data-testid="logs-content"
      >
        {isLoading ? (
          <span className="text-text-muted animate-pulse">Loading logs...</span>
        ) : filteredLogs ? (
          filteredLogs
        ) : (
          <span className="text-text-muted">No logs available</span>
        )}
      </pre>
    </div>
  );
}

// ============================================================================
// Status Badge Component
// ============================================================================

interface StatusBadgeProps {
  status: PodStatus;
}

const statusColors: Record<PodStatus, { bg: string; text: string }> = {
  Running: { bg: 'bg-status-success/10', text: 'text-status-success' },
  Pending: { bg: 'bg-status-warning/10', text: 'text-status-warning' },
  Succeeded: { bg: 'bg-accent-teal/10', text: 'text-accent-teal' },
  Failed: { bg: 'bg-status-error/10', text: 'text-status-error' },
  Unknown: { bg: 'bg-bg-tertiary', text: 'text-text-muted' },
};

function StatusBadge({ status }: StatusBadgeProps) {
  const colors = statusColors[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        colors.bg,
        colors.text
      )}
    >
      {status}
    </span>
  );
}

// ============================================================================
// Main Drawer Component
// ============================================================================

export default function PodDetailDrawer({
  pod,
  isOpen,
  onClose,
  events = [],
  logs = '',
  isLogsLoading = false,
  selectedContainer,
  onContainerSelect,
  className,
}: PodDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('info');

  // Reset to info tab when pod changes
  useEffect(() => {
    if (pod) {
      setActiveTab('info');
    }
  }, [pod?.name, pod?.namespace]);

  if (!pod) return null;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel
                  className={clsx(
                    'pointer-events-auto w-screen max-w-lg',
                    className
                  )}
                  data-testid="pod-detail-drawer"
                >
                  <div className="flex h-full flex-col bg-bg-secondary shadow-xl">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-border-primary">
                      <div className="flex items-start justify-between">
                        <div>
                          <Dialog.Title
                            className="text-lg font-semibold text-text-primary"
                            data-testid="drawer-title"
                          >
                            Pod Details
                          </Dialog.Title>
                          <p className="text-sm text-text-muted mt-1 break-all">
                            {pod.namespace}/{pod.name}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-md p-2 text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                          onClick={onClose}
                          data-testid="close-drawer"
                        >
                          <span className="sr-only">Close panel</span>
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Tabs */}
                    <Tab.Group
                      selectedIndex={tabs.findIndex((t) => t.id === activeTab)}
                      onChange={(index) => setActiveTab(tabs[index].id)}
                    >
                      <Tab.List className="flex border-b border-border-primary px-4" data-testid="tab-list">
                        {tabs.map((tab) => (
                          <Tab
                            key={tab.id}
                            className={({ selected }) =>
                              clsx(
                                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue',
                                selected
                                  ? 'border-b-2 border-accent-blue text-accent-blue'
                                  : 'text-text-muted hover:text-text-primary'
                              )
                            }
                            data-testid={`tab-${tab.id}`}
                          >
                            <tab.icon className="h-4 w-4" />
                            <span>{tab.name}</span>
                          </Tab>
                        ))}
                      </Tab.List>

                      {/* Tab Panels */}
                      <Tab.Panels className="flex-1 overflow-y-auto px-6 py-4">
                        <Tab.Panel>
                          <InfoTab pod={pod} />
                        </Tab.Panel>
                        <Tab.Panel>
                          <ContainersTab containers={pod.containers} />
                        </Tab.Panel>
                        <Tab.Panel>
                          <EventsTab events={events} />
                        </Tab.Panel>
                        <Tab.Panel>
                          <LogsTab
                            logs={logs}
                            isLoading={isLogsLoading}
                            containers={pod.containers}
                            selectedContainer={selectedContainer}
                            onContainerSelect={onContainerSelect}
                          />
                        </Tab.Panel>
                      </Tab.Panels>
                    </Tab.Group>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
