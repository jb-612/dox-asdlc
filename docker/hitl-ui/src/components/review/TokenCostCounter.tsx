/**
 * TokenCostCounter Component (T12)
 *
 * Displays token usage and estimated cost during a code review.
 * Shows:
 * - Token count with formatted numbers (K, M suffixes)
 * - Estimated cost in USD
 * - Running indicator when review is in progress
 */

import { CurrencyDollarIcon } from '@heroicons/react/24/outline';

interface TokenCostCounterProps {
  tokensUsed: number;
  estimatedCost: number;
  isRunning: boolean;
}

/**
 * Format token count with K/M suffixes for readability
 */
function formatTokens(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

/**
 * Format cost as USD with 4 decimal places
 */
function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function TokenCostCounter({
  tokensUsed,
  estimatedCost,
  isRunning,
}: TokenCostCounterProps) {
  return (
    <div
      className="flex items-center gap-4 text-sm"
      data-testid="token-cost-counter"
    >
      <div className="flex items-center gap-1 text-text-secondary">
        {isRunning && (
          <span
            className="h-2 w-2 rounded-full bg-green-500 animate-pulse"
            data-testid="running-indicator"
          />
        )}
        <span data-testid="token-count">{formatTokens(tokensUsed)} tokens</span>
      </div>

      <div className="flex items-center gap-1 text-text-secondary">
        <CurrencyDollarIcon className="h-4 w-4" />
        <span data-testid="cost-display">{formatCost(estimatedCost)}</span>
      </div>
    </div>
  );
}

export default TokenCostCounter;
