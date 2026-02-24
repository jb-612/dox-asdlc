import type { ScrutinyLevel } from '../../../shared/types/execution';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ScrutinyLevelSelectorProps {
  value: ScrutinyLevel;
  onChange: (level: ScrutinyLevel) => void;
}

// ---------------------------------------------------------------------------
// Segment definitions
// ---------------------------------------------------------------------------

interface Segment {
  level: ScrutinyLevel;
  label: string;
  testId: string;
}

const SEGMENTS: Segment[] = [
  { level: 'summary', label: 'Summary', testId: 'scrutiny-option-summary' },
  { level: 'file_list', label: 'File List', testId: 'scrutiny-option-file_list' },
  { level: 'full_content', label: 'Full Content', testId: 'scrutiny-option-full_content' },
  { level: 'full_detail', label: 'Full Detail', testId: 'scrutiny-option-full_detail' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Segmented control for selecting the scrutiny level of gate deliverables.
 * Renders four options: Summary, File List, Full Content, Full Detail.
 */
export default function ScrutinyLevelSelector({
  value,
  onChange,
}: ScrutinyLevelSelectorProps): JSX.Element {
  return (
    <div
      data-testid="scrutiny-selector"
      className="inline-flex rounded-lg bg-gray-800 p-0.5"
    >
      {SEGMENTS.map((seg) => {
        const isActive = value === seg.level;
        return (
          <button
            key={seg.level}
            type="button"
            data-testid={seg.testId}
            onClick={() => onChange(seg.level)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              ${isActive
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }
            `}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
