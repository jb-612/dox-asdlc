/**
 * SeveritySummary Component (T14)
 *
 * Traffic light style summary of findings by severity level.
 * Features:
 * - Three columns: Red (Critical+High), Yellow (Medium), Green (Low+Info)
 * - Click to scroll to severity section
 * - Empty state message when no findings
 */

interface SeveritySummaryProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

/**
 * Scroll to the severity section in the findings list
 */
function scrollToSeverity(severity: string) {
  const element = document.getElementById(`severity-${severity}`);
  element?.scrollIntoView({ behavior: 'smooth' });
}

export function SeveritySummary({
  critical,
  high,
  medium,
  low,
  info,
}: SeveritySummaryProps) {
  const redCount = critical + high;
  const yellowCount = medium;
  const greenCount = low + info;
  const total = redCount + yellowCount + greenCount;

  if (total === 0) {
    return (
      <div
        className="p-6 text-center bg-green-500/10 rounded-lg border border-green-500"
        data-testid="severity-summary-empty"
      >
        <p className="text-lg font-semibold text-green-500">No issues found!</p>
        <p className="text-sm text-text-secondary">
          Your code passed all checks.
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-3 gap-4"
      data-testid="severity-summary"
    >
      {/* Red: Critical + High */}
      <button
        type="button"
        className="p-4 rounded-lg bg-red-500/10 border border-red-500/50 cursor-pointer hover:bg-red-500/20 transition-colors text-left"
        onClick={() => scrollToSeverity('critical')}
        data-testid="severity-red"
      >
        <div className="flex items-center justify-between">
          <span className="text-2xl" aria-hidden="true">
            {/* Red circle emoji representation */}
            <span className="inline-block w-6 h-6 rounded-full bg-red-500" />
          </span>
          <span
            className="text-3xl font-bold text-red-500"
            data-testid="severity-red-count"
          >
            {redCount}
          </span>
        </div>
        <p className="text-sm text-text-secondary mt-1">Critical/High</p>
        {critical > 0 && (
          <p className="text-xs text-red-400" data-testid="critical-detail">
            {critical} critical
          </p>
        )}
      </button>

      {/* Yellow: Medium */}
      <button
        type="button"
        className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/50 cursor-pointer hover:bg-yellow-500/20 transition-colors text-left"
        onClick={() => scrollToSeverity('medium')}
        data-testid="severity-yellow"
      >
        <div className="flex items-center justify-between">
          <span className="text-2xl" aria-hidden="true">
            <span className="inline-block w-6 h-6 rounded-full bg-yellow-500" />
          </span>
          <span
            className="text-3xl font-bold text-yellow-500"
            data-testid="severity-yellow-count"
          >
            {yellowCount}
          </span>
        </div>
        <p className="text-sm text-text-secondary mt-1">Medium</p>
      </button>

      {/* Green: Low + Info */}
      <button
        type="button"
        className="p-4 rounded-lg bg-green-500/10 border border-green-500/50 cursor-pointer hover:bg-green-500/20 transition-colors text-left"
        onClick={() => scrollToSeverity('low')}
        data-testid="severity-green"
      >
        <div className="flex items-center justify-between">
          <span className="text-2xl" aria-hidden="true">
            <span className="inline-block w-6 h-6 rounded-full bg-green-500" />
          </span>
          <span
            className="text-3xl font-bold text-green-500"
            data-testid="severity-green-count"
          >
            {greenCount}
          </span>
        </div>
        <p className="text-sm text-text-secondary mt-1">Low/Info</p>
      </button>
    </div>
  );
}

export default SeveritySummary;
