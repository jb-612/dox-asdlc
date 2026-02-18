/**
 * GuidelineCard - Displays a single guideline in a list (P11-F01 T20)
 *
 * Shows guideline name, category badge, priority, condition summary,
 * action type, and a toggle for enabled/disabled state.
 * Supports selection highlighting and click handlers.
 */

import type { Guideline, GuidelineCategory, ActionType, GuidelineCondition } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GuidelineCardProps {
  guideline: Guideline;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Known acronyms that should be fully uppercased in display labels. */
const ACRONYMS = new Set(['tdd', 'hitl']);

/**
 * Convert a snake_case string to Title Case, respecting known acronyms.
 * e.g. "cognitive_isolation" -> "Cognitive Isolation"
 *      "tdd_protocol"        -> "TDD Protocol"
 *      "hitl_gate"           -> "HITL Gate"
 */
function formatCategory(category: GuidelineCategory): string {
  return category
    .split('_')
    .map((word) =>
      ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

/**
 * Convert an action_type to a readable label.
 * Handles special cases like "hitl_require" -> "HITL Require".
 */
function formatActionType(actionType: ActionType): string {
  if (actionType === 'hitl_require') {
    return 'HITL Require';
  }
  return actionType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Build a brief summary of the guideline condition.
 * Prefers agents, falls back to domains, then null.
 */
function getConditionSummary(condition: GuidelineCondition): string | null {
  if (condition.agents && condition.agents.length > 0) {
    return condition.agents.join(', ');
  }
  if (condition.domains && condition.domains.length > 0) {
    return condition.domains.join(', ');
  }
  return null;
}

// ---------------------------------------------------------------------------
// Category badge color mapping
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<GuidelineCategory, string> = {
  cognitive_isolation: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  tdd_protocol: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  hitl_gate: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  tool_restriction: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  path_restriction: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  commit_policy: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  custom: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GuidelineCard({
  guideline,
  isSelected = false,
  onSelect,
  onToggle,
}: GuidelineCardProps) {
  const categoryColor = CATEGORY_COLORS[guideline.category] ?? CATEGORY_COLORS.custom;
  const conditionSummary = getConditionSummary(guideline.condition);

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(guideline.id);
        }
      }}
      className={`p-3 rounded-lg border cursor-pointer transition-colors
        ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}
        ${!guideline.enabled ? 'opacity-60' : ''}`}
      onClick={() => onSelect?.(guideline.id)}
      data-testid={`guideline-card-${guideline.id}`}
      aria-label={`Select guideline: ${guideline.name}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium truncate">{guideline.name}</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${categoryColor}`}
            >
              {formatCategory(guideline.category)}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
            {guideline.description}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
            <span>Priority: {guideline.priority}</span>
            {conditionSummary && <span>&bull; {conditionSummary}</span>}
            <span>&bull; {formatActionType(guideline.action.action_type)}</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(guideline.id);
          }}
          className={`ml-2 relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors
            ${guideline.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          data-testid={`toggle-${guideline.id}`}
          aria-label={guideline.enabled ? 'Disable guideline' : 'Enable guideline'}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform
              ${guideline.enabled ? 'translate-x-5' : 'translate-x-1'}`}
          />
        </button>
      </div>
    </div>
  );
}

export default GuidelineCard;
