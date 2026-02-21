import { useState, useCallback, useMemo } from 'react';
import { useWorkflowStore } from '../../stores/workflowStore';
import {
  validateWorkflow,
  type ValidationResult,
  type ValidationIssue,
  type ValidationSeverity,
} from '../../utils/validation';

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

function severityIcon(severity: ValidationSeverity): string {
  return severity === 'error' ? '\u2716' : '\u26A0'; // heavy X / warning sign
}

function severityColorClass(severity: ValidationSeverity): string {
  return severity === 'error'
    ? 'text-red-400'
    : 'text-yellow-400';
}

function severityBadgeBg(severity: ValidationSeverity): string {
  return severity === 'error'
    ? 'bg-red-600'
    : 'bg-yellow-600';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface IssueBadgeProps {
  count: number;
  severity: ValidationSeverity;
}

function IssueBadge({ count, severity }: IssueBadgeProps): JSX.Element | null {
  if (count === 0) return null;
  return (
    <span
      className={`
        inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
        rounded-full text-xs font-bold text-white
        ${severityBadgeBg(severity)}
      `}
    >
      {count}
    </span>
  );
}

interface IssueRowProps {
  issue: ValidationIssue;
  onClickNodeIds: (nodeIds: string[]) => void;
}

function IssueRow({ issue, onClickNodeIds }: IssueRowProps): JSX.Element {
  const hasNodeIds = issue.nodeIds && issue.nodeIds.length > 0;

  const handleClick = useCallback(() => {
    if (hasNodeIds && issue.nodeIds) {
      onClickNodeIds(issue.nodeIds);
    }
  }, [hasNodeIds, issue.nodeIds, onClickNodeIds]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!hasNodeIds}
      className={`
        w-full text-left flex items-start gap-2 px-3 py-2
        rounded transition-colors
        ${hasNodeIds ? 'hover:bg-gray-700/50 cursor-pointer' : 'cursor-default'}
      `}
    >
      {/* Severity icon */}
      <span className={`flex-shrink-0 mt-0.5 text-sm ${severityColorClass(issue.severity)}`}>
        {severityIcon(issue.severity)}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-mono text-gray-500">{issue.rule}</span>
        <p className="text-sm text-gray-200 leading-snug">{issue.message}</p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ValidationOverlayProps {
  /** Optional class name for positioning the overlay container. */
  className?: string;
}

/**
 * ValidationOverlay -- floating validation panel for the workflow designer.
 *
 * Provides a "Validate" button that runs all validation rules against the
 * current workflow definition. Results are displayed in a collapsible panel
 * showing errors and warnings. Clicking an issue with associated node IDs
 * selects the first affected node on the canvas.
 *
 * Exports `errorNodeIds` via the `getErrorNodeIds` static helper so that
 * parent components can apply red-border highlights to affected canvas nodes.
 */
export default function ValidationOverlay({
  className = '',
}: ValidationOverlayProps): JSX.Element {
  const workflow = useWorkflowStore((s) => s.workflow);
  const selectNode = useWorkflowStore((s) => s.selectNode);

  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Run validation
  const handleValidate = useCallback(() => {
    if (!workflow) return;
    const validationResult = validateWorkflow(workflow);
    setResult(validationResult);
    setIsOpen(true);
  }, [workflow]);

  // Navigate to the first affected node when an issue is clicked
  const handleClickNodeIds = useCallback(
    (nodeIds: string[]) => {
      if (nodeIds.length > 0) {
        selectNode(nodeIds[0]);
      }
    },
    [selectNode],
  );

  // Collect all node IDs that have errors for canvas highlighting
  const errorNodeIds: Set<string> = useMemo(() => {
    if (!result) return new Set<string>();
    const ids = new Set<string>();
    for (const issue of result.errors) {
      if (issue.nodeIds) {
        for (const nid of issue.nodeIds) {
          ids.add(nid);
        }
      }
    }
    return ids;
  }, [result]);

  const allIssues = useMemo(() => {
    if (!result) return [];
    return [...result.errors, ...result.warnings];
  }, [result]);

  const errorCount = result?.errors.length ?? 0;
  const warningCount = result?.warnings.length ?? 0;
  const isValid = result !== null && result.valid && warningCount === 0;

  return (
    <div className={`flex flex-col items-end gap-2 ${className}`}>
      {/* Validate button + badges */}
      <div className="flex items-center gap-2">
        {result && (
          <div className="flex items-center gap-1.5">
            <IssueBadge count={errorCount} severity="error" />
            <IssueBadge count={warningCount} severity="warning" />
            {isValid && (
              <span className="text-xs font-medium text-green-400">
                Valid
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={handleValidate}
          disabled={!workflow}
          className={`
            px-3 py-1.5 rounded text-sm font-medium transition-colors
            ${
              workflow
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Validate
        </button>
        {result && (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="px-2 py-1.5 rounded text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            aria-label={isOpen ? 'Collapse validation panel' : 'Expand validation panel'}
          >
            {isOpen ? '\u25B2' : '\u25BC'}
          </button>
        )}
      </div>

      {/* Floating results panel */}
      {result && isOpen && (
        <div
          className="
            w-[380px] max-h-[400px] overflow-y-auto
            bg-gray-800 border border-gray-600 rounded-lg shadow-2xl
          "
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-gray-200">
              Validation Results
            </h3>
            <div className="flex items-center gap-2">
              <IssueBadge count={errorCount} severity="error" />
              <IssueBadge count={warningCount} severity="warning" />
            </div>
          </div>

          {/* Issues list */}
          {allIssues.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-sm text-green-400 font-medium">
                No issues found. Workflow is valid.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50">
              {allIssues.map((issue, idx) => (
                <IssueRow
                  key={`${issue.rule}-${idx}`}
                  issue={issue}
                  onClickNodeIds={handleClickNodeIds}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Static helper for canvas integration
// ---------------------------------------------------------------------------

/**
 * Extract all node IDs that have validation errors from a ValidationResult.
 * Canvas components can use this to apply red-border styling to affected nodes.
 */
export function getErrorNodeIds(result: ValidationResult | null): Set<string> {
  if (!result) return new Set<string>();
  const ids = new Set<string>();
  for (const issue of result.errors) {
    if (issue.nodeIds) {
      for (const nid of issue.nodeIds) {
        ids.add(nid);
      }
    }
  }
  return ids;
}
