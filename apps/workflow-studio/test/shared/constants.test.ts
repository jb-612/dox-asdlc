import { describe, it, expect } from 'vitest';
import { BLOCK_TYPE_METADATA, AVAILABLE_BLOCK_TYPES } from '../../src/shared/constants';

// ---------------------------------------------------------------------------
// F11-T01: Block metadata defaults
// ---------------------------------------------------------------------------

describe('BLOCK_TYPE_METADATA (F11-T01)', () => {
  const blockTypes = ['plan', 'dev', 'test', 'review', 'devops'] as const;

  for (const bt of blockTypes) {
    it(`${bt} block has non-empty defaultSystemPromptPrefix`, () => {
      expect(BLOCK_TYPE_METADATA[bt].defaultSystemPromptPrefix.length).toBeGreaterThan(0);
    });

    it(`${bt} block has non-empty defaultOutputChecklist`, () => {
      expect(BLOCK_TYPE_METADATA[bt].defaultOutputChecklist.length).toBeGreaterThan(0);
    });
  }

  it('dev block agentNodeType is coding', () => {
    expect(BLOCK_TYPE_METADATA.dev.agentNodeType).toBe('coding');
  });

  it('test block agentNodeType is utest', () => {
    expect(BLOCK_TYPE_METADATA.test.agentNodeType).toBe('utest');
  });

  it('review block agentNodeType is reviewer', () => {
    expect(BLOCK_TYPE_METADATA.review.agentNodeType).toBe('reviewer');
  });

  it('devops block agentNodeType is deployment', () => {
    expect(BLOCK_TYPE_METADATA.devops.agentNodeType).toBe('deployment');
  });
});

// ---------------------------------------------------------------------------
// F11-T02: AVAILABLE_BLOCK_TYPES phase filter
// ---------------------------------------------------------------------------

describe('AVAILABLE_BLOCK_TYPES (F11-T02)', () => {
  it('includes all 5 block types', () => {
    expect(AVAILABLE_BLOCK_TYPES).toHaveLength(5);
  });

  it('includes plan, dev, test, review, devops', () => {
    expect(AVAILABLE_BLOCK_TYPES).toContain('plan');
    expect(AVAILABLE_BLOCK_TYPES).toContain('dev');
    expect(AVAILABLE_BLOCK_TYPES).toContain('test');
    expect(AVAILABLE_BLOCK_TYPES).toContain('review');
    expect(AVAILABLE_BLOCK_TYPES).toContain('devops');
  });
});
