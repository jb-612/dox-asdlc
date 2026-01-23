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
 * Format token count with K/M suffix
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Format cost as currency
 */
export function formatCost(cost: number): string {
  if (cost >= 100) {
    return `$${Math.round(cost)}`;
  }
  if (cost >= 1) {
    return `$${cost.toFixed(2)}`;
  }
  if (cost >= 0.01) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Format duration in ms to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  if (ms >= 3600000) {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  }
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format git SHA (first 7 chars)
 */
export function formatGitSha(sha: string): string {
  if (sha.length <= 7) return sha;
  return sha.slice(0, 7);
}

/**
 * Format epic ID (uppercase)
 */
export function formatEpicId(epicId: string): string {
  return epicId.toUpperCase();
}

/**
 * Format run ID for display (truncate to 8 chars if long)
 */
export function formatRunId(runId: string): string {
  if (runId.length <= 8) return runId;
  return runId.slice(0, 8);
}
