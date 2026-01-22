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
