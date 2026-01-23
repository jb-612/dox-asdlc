/**
 * EvidenceBundleViewer - Displays evidence bundles (test results, diffs, reports, logs)
 */

import { useState, useMemo } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  BeakerIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import CodeDiff from './CodeDiff';

export type EvidenceType = 'test_results' | 'diff' | 'report' | 'log' | 'security_scan';

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  message?: string;
  details?: string;
}

export interface TestResultsEvidence {
  type: 'test_results';
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  results: TestResult[];
}

export interface DiffEvidence {
  type: 'diff';
  filename: string;
  language?: string;
  oldContent: string;
  newContent: string;
}

export interface ReportEvidence {
  type: 'report';
  title: string;
  format: 'text' | 'json' | 'html';
  content: string;
}

export interface LogEvidence {
  type: 'log';
  source: string;
  entries: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
  }>;
}

export interface SecurityScanEvidence {
  type: 'security_scan';
  scanner: string;
  findings: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    location?: string;
  }>;
}

export type Evidence =
  | TestResultsEvidence
  | DiffEvidence
  | ReportEvidence
  | LogEvidence
  | SecurityScanEvidence;

export interface EvidenceBundleViewerProps {
  /** Evidence items to display */
  evidence: Evidence[];
  /** Default tab to show */
  defaultTab?: EvidenceType;
  /** Custom class name */
  className?: string;
}

// Get tab label for evidence type
function getTabLabel(type: EvidenceType): string {
  switch (type) {
    case 'test_results':
      return 'Test Results';
    case 'diff':
      return 'Diff';
    case 'report':
      return 'Report';
    case 'log':
      return 'Logs';
    case 'security_scan':
      return 'Security';
    default:
      return type;
  }
}

// Get tab icon for evidence type
function getTabIcon(type: EvidenceType) {
  switch (type) {
    case 'test_results':
      return BeakerIcon;
    case 'diff':
      return CodeBracketIcon;
    case 'report':
      return DocumentTextIcon;
    case 'log':
      return DocumentTextIcon;
    case 'security_scan':
      return ShieldCheckIcon;
    default:
      return DocumentTextIcon;
  }
}

// Get log level color
function getLogLevelColor(level: string): string {
  switch (level) {
    case 'error':
      return 'text-status-error';
    case 'warn':
      return 'text-status-warning';
    case 'info':
      return 'text-status-info';
    case 'debug':
      return 'text-text-muted';
    default:
      return 'text-text-secondary';
  }
}

// Get severity color
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'text-red-500 bg-red-500/10';
    case 'high':
      return 'text-orange-500 bg-orange-500/10';
    case 'medium':
      return 'text-status-warning bg-status-warning/10';
    case 'low':
      return 'text-status-info bg-status-info/10';
    case 'info':
      return 'text-text-muted bg-bg-tertiary';
    default:
      return 'text-text-muted bg-bg-tertiary';
  }
}

export default function EvidenceBundleViewer({
  evidence,
  defaultTab,
  className,
}: EvidenceBundleViewerProps) {
  // Get unique evidence types for tabs
  const tabs = useMemo(() => {
    const types = new Set<EvidenceType>();
    evidence.forEach((e) => types.add(e.type));
    return Array.from(types);
  }, [evidence]);

  const [activeTab, setActiveTab] = useState<EvidenceType>(
    defaultTab && tabs.includes(defaultTab) ? defaultTab : tabs[0]
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Filter evidence by active tab
  const activeEvidence = useMemo(
    () => evidence.filter((e) => e.type === activeTab),
    [evidence, activeTab]
  );

  // Toggle item expansion
  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Render test results
  const renderTestResults = (data: TestResultsEvidence, index: number) => (
    <div key={index} className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-4 p-3 bg-bg-tertiary rounded-lg" data-testid="test-summary">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">Total:</span>
          <span className="font-medium text-text-primary">{data.summary.total}</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="h-4 w-4 text-status-success" />
          <span className="text-status-success">{data.summary.passed}</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircleIcon className="h-4 w-4 text-status-error" />
          <span className="text-status-error">{data.summary.failed}</span>
        </div>
        {data.summary.skipped > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted">{data.summary.skipped} skipped</span>
          </div>
        )}
      </div>

      {/* Results list */}
      <div className="space-y-1" data-testid="test-results-list">
        {data.results.map((result, i) => {
          const itemId = `test-${index}-${i}`;
          const isExpanded = expandedItems.has(itemId);
          const hasDetails = result.message || result.details;

          return (
            <div key={i} className="border border-border-secondary rounded">
              <button
                onClick={() => hasDetails && toggleExpanded(itemId)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-left',
                  hasDetails && 'cursor-pointer hover:bg-bg-tertiary'
                )}
                data-testid={`test-result-${i}`}
              >
                {hasDetails && (
                  <span className="text-text-muted">
                    {isExpanded ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </span>
                )}
                {result.status === 'passed' && (
                  <CheckCircleIcon className="h-4 w-4 text-status-success" />
                )}
                {result.status === 'failed' && (
                  <XCircleIcon className="h-4 w-4 text-status-error" />
                )}
                {result.status === 'skipped' && (
                  <span className="h-4 w-4 rounded-full border-2 border-text-muted" />
                )}
                <span
                  className={clsx(
                    'flex-1 text-sm',
                    result.status === 'passed' && 'text-text-primary',
                    result.status === 'failed' && 'text-status-error',
                    result.status === 'skipped' && 'text-text-muted'
                  )}
                >
                  {result.name}
                </span>
                {result.duration && (
                  <span className="text-xs text-text-muted">{result.duration}ms</span>
                )}
              </button>
              {isExpanded && hasDetails && (
                <div className="px-3 pb-3 pl-9 space-y-2" data-testid={`test-details-${i}`}>
                  {result.message && (
                    <p className="text-sm text-text-secondary">{result.message}</p>
                  )}
                  {result.details && (
                    <pre className="text-xs bg-bg-tertiary rounded p-2 overflow-x-auto text-status-error">
                      {result.details}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render diff
  const renderDiff = (data: DiffEvidence, index: number) => (
    <div key={index} className="space-y-2" data-testid={`diff-view-${index}`}>
      <div className="text-sm text-text-muted font-mono">{data.filename}</div>
      <CodeDiff
        oldContent={data.oldContent}
        newContent={data.newContent}
        language={data.language}
      />
    </div>
  );

  // Render report
  const renderReport = (data: ReportEvidence, index: number) => (
    <div key={index} className="space-y-2" data-testid={`report-view-${index}`}>
      <div className="text-sm font-medium text-text-primary">{data.title}</div>
      {data.format === 'json' ? (
        <pre className="text-sm bg-bg-tertiary rounded p-3 overflow-x-auto text-text-secondary">
          {typeof data.content === 'string'
            ? JSON.stringify(JSON.parse(data.content), null, 2)
            : JSON.stringify(data.content, null, 2)}
        </pre>
      ) : data.format === 'html' ? (
        <div
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: data.content }}
        />
      ) : (
        <pre className="text-sm bg-bg-tertiary rounded p-3 overflow-x-auto text-text-secondary whitespace-pre-wrap">
          {data.content}
        </pre>
      )}
    </div>
  );

  // Render log
  const renderLog = (data: LogEvidence, index: number) => {
    const itemId = `log-${index}`;
    const isExpanded = expandedItems.has(itemId);

    return (
      <div key={index} className="border border-border-secondary rounded" data-testid={`log-view-${index}`}>
        <button
          onClick={() => toggleExpanded(itemId)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-tertiary"
        >
          <span className="text-text-muted">
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </span>
          <DocumentTextIcon className="h-4 w-4 text-text-muted" />
          <span className="flex-1 text-sm text-text-primary">{data.source}</span>
          <span className="text-xs text-text-muted">{data.entries.length} entries</span>
        </button>
        {isExpanded && (
          <div className="max-h-64 overflow-y-auto border-t border-border-secondary" data-testid={`log-entries-${index}`}>
            {data.entries.map((entry, i) => (
              <div
                key={i}
                className="flex gap-2 px-3 py-1 text-xs font-mono border-b border-border-secondary last:border-b-0"
              >
                <span className="text-text-muted whitespace-nowrap">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={clsx(
                    'uppercase w-12 text-center',
                    getLogLevelColor(entry.level)
                  )}
                >
                  {entry.level}
                </span>
                <span className="text-text-secondary flex-1">{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render security scan
  const renderSecurityScan = (data: SecurityScanEvidence, index: number) => (
    <div key={index} className="space-y-3" data-testid={`security-view-${index}`}>
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <ShieldCheckIcon className="h-4 w-4" />
        <span>Scanner: {data.scanner}</span>
        <span className="text-text-muted">• {data.findings.length} findings</span>
      </div>
      <div className="space-y-2" data-testid="security-findings">
        {data.findings.map((finding, i) => {
          const itemId = `security-${index}-${i}`;
          const isExpanded = expandedItems.has(itemId);

          return (
            <div
              key={i}
              className="border border-border-secondary rounded"
            >
              <button
                onClick={() => toggleExpanded(itemId)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-tertiary"
                data-testid={`security-finding-${i}`}
              >
                <span className="text-text-muted">
                  {isExpanded ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </span>
                <span
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded capitalize',
                    getSeverityColor(finding.severity)
                  )}
                >
                  {finding.severity}
                </span>
                <span className="flex-1 text-sm text-text-primary">{finding.title}</span>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 pl-9 space-y-2" data-testid={`security-details-${i}`}>
                  <p className="text-sm text-text-secondary">{finding.description}</p>
                  {finding.location && (
                    <p className="text-xs text-text-muted font-mono">
                      Location: {finding.location}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render evidence based on type
  const renderEvidence = (item: Evidence, index: number) => {
    switch (item.type) {
      case 'test_results':
        return renderTestResults(item, index);
      case 'diff':
        return renderDiff(item, index);
      case 'report':
        return renderReport(item, index);
      case 'log':
        return renderLog(item, index);
      case 'security_scan':
        return renderSecurityScan(item, index);
      default:
        return null;
    }
  };

  if (evidence.length === 0) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center py-8 text-text-muted',
          className
        )}
        data-testid="evidence-empty"
      >
        No evidence available
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'evidence-bundle-viewer rounded-lg border border-border-primary overflow-hidden',
        className
      )}
      data-testid="evidence-viewer"
    >
      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex border-b border-border-primary bg-bg-secondary" data-testid="evidence-tabs">
          {tabs.map((tab) => {
            const Icon = getTabIcon(tab);
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors',
                  activeTab === tab
                    ? 'border-accent-teal text-accent-teal bg-bg-tertiary'
                    : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-bg-tertiary'
                )}
                data-testid={`tab-${tab}`}
              >
                <Icon className="h-4 w-4" />
                {getTabLabel(tab)}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="p-4 bg-bg-primary space-y-4" data-testid="evidence-content">
        {activeEvidence.map((item, index) => renderEvidence(item, index))}
      </div>
    </div>
  );
}
