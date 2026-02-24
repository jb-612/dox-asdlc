import { describe, it, expect } from 'vitest';
import { statusToVariant } from './statusUtils';

describe('statusToVariant', () => {
  it.each([
    ['active', 'success'],
    ['running', 'success'],
    ['completed', 'success'],
    ['success', 'success'],
  ] as const)('maps "%s" to "success"', (status, expected) => {
    expect(statusToVariant(status)).toBe(expected);
  });

  it.each([
    ['paused', 'warning'],
    ['waiting_gate', 'warning'],
    ['partial', 'warning'],
    ['dormant', 'warning'],
  ] as const)('maps "%s" to "warning"', (status, expected) => {
    expect(statusToVariant(status)).toBe(expected);
  });

  it.each([
    ['failed', 'error'],
    ['error', 'error'],
    ['aborted', 'error'],
    ['terminated', 'error'],
  ] as const)('maps "%s" to "error"', (status, expected) => {
    expect(statusToVariant(status)).toBe(expected);
  });

  it.each([
    ['starting', 'info'],
    ['idle', 'info'],
  ] as const)('maps "%s" to "info"', (status, expected) => {
    expect(statusToVariant(status)).toBe(expected);
  });

  it('returns "neutral" for unknown statuses', () => {
    expect(statusToVariant('unknown')).toBe('neutral');
    expect(statusToVariant('something_else')).toBe('neutral');
    expect(statusToVariant('')).toBe('neutral');
  });
});
