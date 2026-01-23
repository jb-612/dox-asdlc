import { formatDistanceToNow, format, parseISO } from 'date-fns';

/**
 * Format a date string as relative time (e.g., "5 minutes ago")
 */
export function formatRelativeTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Unknown time';
  }
}

/**
 * Format a date string as absolute date/time
 */
export function formatDateTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM d, yyyy HH:mm');
  } catch {
    return 'Unknown date';
  }
}

/**
 * Format a date string as date only
 */
export function formatDate(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM d, yyyy');
  } catch {
    return 'Unknown date';
  }
}

/**
 * Format bytes as human-readable size
 */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return 'Unknown size';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format a percentage as string
 */
export function formatPercentage(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format a session ID for display (shortened)
 */
export function formatSessionId(sessionId: string): string {
  if (sessionId.length <= 12) return sessionId;
  return sessionId.slice(0, 12);
}

/**
 * Format token count with K/M suffixes
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

/**
 * Format cost in USD
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  if (cost < 100) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(0)}`;
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format a number with comma separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format a git SHA (first 7 characters)
 */
export function formatGitSha(sha: string): string {
  return sha.slice(0, 7);
}

/**
 * Format an epic ID for display
 */
export function formatEpicId(epicId: string): string {
  return epicId.toUpperCase();
}

/**
 * Format a run ID for display (shortened)
 */
export function formatRunId(runId: string): string {
  if (runId.length <= 8) return runId;
  return runId.slice(0, 8);
}
