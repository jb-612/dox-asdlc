import { useCallback } from 'react';
import type { WorkItemReference, WorkItemType } from '../../../shared/types/workitem';

// ---------------------------------------------------------------------------
// Type badge colors
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<WorkItemType, { bg: string; text: string; label: string }> = {
  prd: { bg: 'bg-purple-600/20', text: 'text-purple-300', label: 'PRD' },
  issue: { bg: 'bg-red-600/20', text: 'text-red-300', label: 'Issue' },
  idea: { bg: 'bg-cyan-600/20', text: 'text-cyan-300', label: 'Idea' },
  manual: { bg: 'bg-gray-600/20', text: 'text-gray-300', label: 'Manual' },
};

const TYPE_ICONS: Record<WorkItemType, string> = {
  prd: '\u{1F4CB}',     // clipboard
  issue: '\u{1F41B}',   // bug
  idea: '\u{1F4A1}',    // light bulb
  manual: '\u{270F}',   // pencil
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface WorkItemCardProps {
  item: WorkItemReference;
  onClick?: (item: WorkItemReference) => void;
  selected?: boolean;
}

/**
 * Consistent card for displaying a work item in lists and pickers.
 *
 * Shows: type icon, title, description (truncated to 2 lines), labels as badges.
 * Hover state with subtle highlight. Click handler invokes parent callback.
 */
export default function WorkItemCard({
  item,
  onClick,
  selected = false,
}: WorkItemCardProps): JSX.Element {
  const handleClick = useCallback(() => {
    onClick?.(item);
  }, [onClick, item]);

  const typeStyle = TYPE_STYLES[item.type];

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        w-full text-left p-3 rounded-lg border transition-colors
        ${
          selected
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-700 hover:border-gray-500 hover:bg-gray-700/50'
        }
      `}
    >
      <div className="flex items-start gap-2.5">
        {/* Type icon */}
        <span className="text-lg flex-shrink-0 mt-0.5" role="img" aria-label={item.type}>
          {TYPE_ICONS[item.type]}
        </span>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-100 truncate flex-1">
              {item.title}
            </span>
            <span
              className={`
                flex-shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded
                ${typeStyle.bg} ${typeStyle.text}
              `}
            >
              {typeStyle.label}
            </span>
          </div>

          {/* Description (truncated to 2 lines) */}
          {item.description && (
            <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-1.5">
              {item.description}
            </p>
          )}

          {/* Labels */}
          {item.labels && item.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.labels.map((label) => (
                <span
                  key={label}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
