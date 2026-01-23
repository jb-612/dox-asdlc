import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  formatDateTime,
  formatDate,
  formatBytes,
  formatPercentage,
  truncate,
  formatSessionId,
  formatTokens,
  formatCost,
  formatDuration,
  formatNumber,
  formatGitSha,
  formatEpicId,
  formatRunId,
} from './formatters';

describe('formatters', () => {
  describe('formatRelativeTime', () => {
    it('formats recent dates as relative time', () => {
      const now = new Date();
      const result = formatRelativeTime(now.toISOString());
      expect(result).toContain('ago');
    });

    it('handles invalid date strings', () => {
      expect(formatRelativeTime('invalid')).toBe('Unknown time');
    });
  });

  describe('formatDateTime', () => {
    it('formats date with time', () => {
      const result = formatDateTime('2026-01-15T14:30:00Z');
      expect(result).toMatch(/Jan 15, 2026/);
    });

    it('handles invalid date strings', () => {
      expect(formatDateTime('invalid')).toBe('Unknown date');
    });
  });

  describe('formatDate', () => {
    it('formats date without time', () => {
      const result = formatDate('2026-01-15T14:30:00Z');
      expect(result).toBe('Jan 15, 2026');
    });

    it('handles invalid date strings', () => {
      expect(formatDate('invalid')).toBe('Unknown date');
    });
  });

  describe('formatBytes', () => {
    it('formats bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(1048576)).toBe('1.0 MB');
    });

    it('formats gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1.0 GB');
    });

    it('handles zero', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('handles undefined', () => {
      expect(formatBytes(undefined)).toBe('Unknown size');
    });
  });

  describe('formatPercentage', () => {
    it('formats without decimals by default', () => {
      expect(formatPercentage(75)).toBe('75%');
    });

    it('formats with specified decimals', () => {
      expect(formatPercentage(75.5, 1)).toBe('75.5%');
      expect(formatPercentage(33.333, 2)).toBe('33.33%');
    });
  });

  describe('truncate', () => {
    it('returns text unchanged if shorter than max', () => {
      expect(truncate('short', 10)).toBe('short');
    });

    it('truncates long text with ellipsis', () => {
      expect(truncate('this is a long text', 10)).toBe('this is...');
    });
  });

  describe('formatSessionId', () => {
    it('returns short IDs unchanged', () => {
      expect(formatSessionId('abc123')).toBe('abc123');
    });

    it('truncates long IDs', () => {
      expect(formatSessionId('abcdef123456789')).toBe('abcdef123456');
    });
  });

  describe('formatTokens', () => {
    it('formats small numbers without suffix', () => {
      expect(formatTokens(500)).toBe('500');
      expect(formatTokens(999)).toBe('999');
    });

    it('formats thousands with K suffix', () => {
      expect(formatTokens(1000)).toBe('1.0K');
      expect(formatTokens(1500)).toBe('1.5K');
      expect(formatTokens(50000)).toBe('50.0K');
    });

    it('formats millions with M suffix', () => {
      expect(formatTokens(1000000)).toBe('1.00M');
      expect(formatTokens(1500000)).toBe('1.50M');
    });
  });

  describe('formatCost', () => {
    it('formats very small costs with 4 decimals', () => {
      expect(formatCost(0.0012)).toBe('$0.0012');
    });

    it('formats small costs with 3 decimals', () => {
      expect(formatCost(0.123)).toBe('$0.123');
    });

    it('formats medium costs with 2 decimals', () => {
      expect(formatCost(12.50)).toBe('$12.50');
    });

    it('formats large costs without decimals', () => {
      expect(formatCost(150.75)).toBe('$151');
    });
  });

  describe('formatDuration', () => {
    it('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('formats seconds', () => {
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(30000)).toBe('30.0s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(60000)).toBe('1m');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(3660000)).toBe('1h 1m');
      expect(formatDuration(3600000)).toBe('1h');
    });
  });

  describe('formatNumber', () => {
    it('formats numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('handles small numbers', () => {
      expect(formatNumber(42)).toBe('42');
    });
  });

  describe('formatGitSha', () => {
    it('returns first 7 characters', () => {
      expect(formatGitSha('abc1234def5678')).toBe('abc1234');
    });

    it('handles short SHAs', () => {
      expect(formatGitSha('abc')).toBe('abc');
    });
  });

  describe('formatEpicId', () => {
    it('uppercases the epic ID', () => {
      expect(formatEpicId('epic-001')).toBe('EPIC-001');
    });
  });

  describe('formatRunId', () => {
    it('returns short IDs unchanged', () => {
      expect(formatRunId('run123')).toBe('run123');
    });

    it('truncates long IDs to 8 characters', () => {
      expect(formatRunId('run-1234567890')).toBe('run-1234');
    });
  });
});
