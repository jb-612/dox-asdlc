/**
 * EvidenceTab - Displays test reports, diffs, security scans, and logs
 */

import { useState, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  ShieldCheckIcon,
  CommandLineIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Test report */
export interface TestReport {
  /** Report ID */
  id: string;
  /** Report name */
  name: string;
  /** Report type */
  type: 'unit' | 'integration' | 'e2e';
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Total tests */
  total: number;
  /** Report content */
  content: string;
}

/** Diff */
export interface Diff {
  /** Diff ID */
  id: string;
  /** File path */
  file: string;
  /** Diff content */
  content: string;
  /** Lines added */
  additions: number;
  /** Lines deleted */
  deletions: number;
}

/** Security scan */
export interface SecurityScan {
  /** Scan ID */
  id: string;
  /** Scan name */
  name: string;
  /** Scan status */
  status: 'passed' | 'warning' | 'failed';
  /** Number of findings */
  findings: number;
  /** Scan details */
  details: string;
}

/** Log entry */
export interface LogEntry {
  /** Log ID */
  id: string;
  /** Log type */
  type: 'stdout' | 'stderr';
  /** Log content */
  content: string;
}

/** Evidence */
export interface Evidence {
  /** Test reports */
  testReports: TestReport[];
  /** Diffs */
  diffs: Diff[];
  /** Security scans */
  securityScans: SecurityScan[];
  /** Logs */
  logs: LogEntry[];
}

export interface EvidenceTabProps {
  /** Evidence data */
  evidence: Evidence;
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
}

// Status icons and colors
const statusConfig = {
  passed: { icon: CheckCircleIcon, className: 'text-status-success' },
  warning: { icon: ExclamationTriangleIcon, className: 'text-status-warning' },
  failed: { icon: XCircleIcon, className: 'text-status-error' },
};

export default function EvidenceTab({
  evidence,
  isLoading = false,
  className,
}: EvidenceTabProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Toggle item expansion
  const toggleExpand = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx('space-y-4', className)}
        data-testid="evidence-loading"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-border-primary bg-bg-secondary p-4"
            data-testid="section-skeleton"
          >
            <div className="h-5 w-32 bg-bg-tertiary rounded animate-pulse mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-64 bg-bg-tertiary rounded animate-pulse" />
              <div className="h-4 w-48 bg-bg-tertiary rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', className)} data-testid="evidence-tab">
      <h3 className="text-lg font-semibold text-text-primary">Evidence</h3>

      {/* Test Reports Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-4"
        data-testid="test-reports-section"
      >
        <div className="flex items-center gap-2 mb-3">
          <DocumentTextIcon className="h-5 w-5 text-text-muted" />
          <h4 className="font-medium text-text-primary">Test Reports</h4>
          <span className="text-xs text-text-muted">({evidence.testReports.length})</span>
        </div>

        {evidence.testReports.length === 0 ? (
          <p className="text-sm text-text-muted">No test reports available</p>
        ) : (
          <div className="space-y-2">
            {evidence.testReports.map((report) => {
              const isExpanded = expandedItems.has(`report-${report.id}`);
              const passRate = Math.round((report.passed / report.total) * 100);

              return (
                <div
                  key={report.id}
                  className="rounded-lg bg-bg-tertiary overflow-hidden"
                  data-testid={`report-${report.id}`}
                >
                  <button
                    onClick={() => toggleExpand(`report-${report.id}`)}
                    className="w-full p-2 flex items-center justify-between hover:bg-bg-primary transition-colors"
                    data-testid={`expand-${report.id}`}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-primary">{report.name}</span>
                      <span className="text-xs text-text-muted px-1.5 py-0.5 rounded bg-bg-primary">
                        {report.type}
                      </span>
                      <span
                        className={clsx(
                          'text-xs font-mono',
                          passRate === 100 ? 'text-status-success' : 'text-status-warning'
                        )}
                      >
                        {report.passed}/{report.total}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDownIcon className="h-4 w-4 text-text-muted" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-text-muted" />
                    )}
                  </button>

                  {isExpanded && (
                    <div
                      className="p-2 border-t border-border-secondary"
                      data-testid={`content-${report.id}`}
                    >
                      <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">
                        {report.content}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Diffs Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-4"
        data-testid="diffs-section"
      >
        <div className="flex items-center gap-2 mb-3">
          <DocumentDuplicateIcon className="h-5 w-5 text-text-muted" />
          <h4 className="font-medium text-text-primary">Diffs</h4>
          <span className="text-xs text-text-muted">({evidence.diffs.length})</span>
        </div>

        {evidence.diffs.length === 0 ? (
          <p className="text-sm text-text-muted">No diffs available</p>
        ) : (
          <div className="space-y-2">
            {evidence.diffs.map((diff) => {
              const isExpanded = expandedItems.has(`diff-${diff.id}`);

              return (
                <div
                  key={diff.id}
                  className="rounded-lg bg-bg-tertiary overflow-hidden"
                  data-testid={`diff-${diff.id}`}
                >
                  <button
                    onClick={() => toggleExpand(`diff-${diff.id}`)}
                    className="w-full p-2 flex items-center justify-between hover:bg-bg-primary transition-colors"
                    data-testid={`expand-${diff.id}`}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-text-primary">{diff.file}</span>
                      <span className="text-xs text-status-success">+{diff.additions}</span>
                      <span className="text-xs text-status-error">-{diff.deletions}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDownIcon className="h-4 w-4 text-text-muted" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-text-muted" />
                    )}
                  </button>

                  {isExpanded && (
                    <div
                      className="p-2 border-t border-border-secondary"
                      data-testid={`content-${diff.id}`}
                    >
                      <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">
                        {diff.content}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Security Scans Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-4"
        data-testid="security-scans-section"
      >
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheckIcon className="h-5 w-5 text-text-muted" />
          <h4 className="font-medium text-text-primary">Security Scans</h4>
          <span className="text-xs text-text-muted">({evidence.securityScans.length})</span>
        </div>

        {evidence.securityScans.length === 0 ? (
          <p className="text-sm text-text-muted">No security scans available</p>
        ) : (
          <div className="space-y-2">
            {evidence.securityScans.map((scan) => {
              const isExpanded = expandedItems.has(`scan-${scan.id}`);
              const StatusIcon = statusConfig[scan.status].icon;

              return (
                <div
                  key={scan.id}
                  className="rounded-lg bg-bg-tertiary overflow-hidden"
                  data-testid={`scan-${scan.id}`}
                >
                  <button
                    onClick={() => toggleExpand(`scan-${scan.id}`)}
                    className="w-full p-2 flex items-center justify-between hover:bg-bg-primary transition-colors"
                    data-testid={`expand-${scan.id}`}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-2">
                      <StatusIcon className={clsx('h-4 w-4', statusConfig[scan.status].className)} />
                      <span className="text-sm text-text-primary">{scan.name}</span>
                      <span className={clsx('text-xs capitalize', statusConfig[scan.status].className)}>
                        {scan.status}
                      </span>
                      {scan.findings > 0 && (
                        <span className="text-xs text-text-muted">
                          {scan.findings} finding{scan.findings !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDownIcon className="h-4 w-4 text-text-muted" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-text-muted" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-2 border-t border-border-secondary">
                      <p className="text-xs text-text-secondary">{scan.details}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Logs Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-4"
        data-testid="logs-section"
      >
        <div className="flex items-center gap-2 mb-3">
          <CommandLineIcon className="h-5 w-5 text-text-muted" />
          <h4 className="font-medium text-text-primary">Logs</h4>
          <span className="text-xs text-text-muted">({evidence.logs.length})</span>
        </div>

        {evidence.logs.length === 0 ? (
          <p className="text-sm text-text-muted">No logs available</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {evidence.logs.map((log) => (
              <div
                key={log.id}
                className={clsx(
                  'text-xs font-mono px-2 py-1 rounded',
                  log.type === 'stderr' ? 'text-status-warning bg-status-warning/10' : 'text-text-secondary bg-bg-tertiary'
                )}
                data-testid={`log-${log.id}`}
              >
                {log.content}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
