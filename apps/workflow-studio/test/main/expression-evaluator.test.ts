// @vitest-environment node
// ---------------------------------------------------------------------------
// F15-T03: Expression evaluator
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { evaluateExpression } from '../../src/main/services/expression-evaluator';

describe('F15-T03: evaluateExpression', () => {

  // --- Basic comparisons ---
  it('status == "success" -> true', () => {
    expect(evaluateExpression('status == "success"', { status: 'success' })).toBe(true);
  });

  it('status == "success" -> false when status is "failed"', () => {
    expect(evaluateExpression('status == "success"', { status: 'failed' })).toBe(false);
  });

  it('count > 5 -> true when count is 10', () => {
    expect(evaluateExpression('count > 5', { count: 10 })).toBe(true);
  });

  it('count > 5 -> false when count is 3', () => {
    expect(evaluateExpression('count > 5', { count: 3 })).toBe(false);
  });

  it('x != y -> true when different', () => {
    expect(evaluateExpression('x != y', { x: 1, y: 2 })).toBe(true);
  });

  it('a <= b -> true when equal', () => {
    expect(evaluateExpression('a <= b', { a: 5, b: 5 })).toBe(true);
  });

  it('a >= b -> false when less', () => {
    expect(evaluateExpression('a >= b', { a: 3, b: 5 })).toBe(false);
  });

  it('a < b -> true', () => {
    expect(evaluateExpression('a < b', { a: 1, b: 2 })).toBe(true);
  });

  // --- Logical operators ---
  it('a && b -> true when both truthy', () => {
    expect(evaluateExpression('a && b', { a: true, b: true })).toBe(true);
  });

  it('a && b -> false when one falsy', () => {
    expect(evaluateExpression('a && b', { a: true, b: false })).toBe(false);
  });

  it('a || b -> true when one truthy', () => {
    expect(evaluateExpression('a || b', { a: false, b: true })).toBe(true);
  });

  it('!failed -> true when failed is false', () => {
    expect(evaluateExpression('!failed', { failed: false })).toBe(true);
  });

  it('!failed -> false when failed is true', () => {
    expect(evaluateExpression('!failed', { failed: true })).toBe(false);
  });

  // --- Property access ---
  it('items.length >= 1 -> true', () => {
    expect(evaluateExpression('items.length >= 1', { items: [1, 2, 3] })).toBe(true);
  });

  it('items.length == 0 -> true when empty', () => {
    expect(evaluateExpression('items.length == 0', { items: [] })).toBe(true);
  });

  // --- Undefined variable -> false ---
  it('undefinedVar -> false', () => {
    expect(evaluateExpression('undefinedVar', {})).toBe(false);
  });

  // --- String literals ---
  it('handles single-quoted strings', () => {
    expect(evaluateExpression("status == 'done'", { status: 'done' })).toBe(true);
  });

  // --- Numeric literals ---
  it('numeric comparison with literal', () => {
    expect(evaluateExpression('count == 42', { count: 42 })).toBe(true);
  });

  // --- Security: disallowed constructs ---
  it('throws on __proto__ access', () => {
    expect(() => evaluateExpression('obj.__proto__', { obj: {} })).toThrow();
  });

  it('throws on constructor access', () => {
    expect(() => evaluateExpression('obj.constructor', { obj: {} })).toThrow();
  });

  it('throws on prototype access', () => {
    expect(() => evaluateExpression('obj.prototype', { obj: {} })).toThrow();
  });

  it('throws on function call syntax', () => {
    expect(() => evaluateExpression('foo()', { foo: () => true })).toThrow();
  });

  it('throws on assignment', () => {
    expect(() => evaluateExpression('x = 5', { x: 1 })).toThrow();
  });

  // --- Invalid expressions ---
  it('throws on empty expression', () => {
    expect(() => evaluateExpression('', {})).toThrow();
  });

  it('throws on invalid syntax', () => {
    expect(() => evaluateExpression('a +++ b', { a: 1, b: 2 })).toThrow();
  });
});
