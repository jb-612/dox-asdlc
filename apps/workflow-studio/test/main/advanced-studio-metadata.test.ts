// @vitest-environment node
// ---------------------------------------------------------------------------
// F15-T02: Control-flow metadata in constants.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { BLOCK_TYPE_METADATA, AVAILABLE_BLOCK_TYPES } from '../../src/shared/constants';

describe('F15-T02: Control-flow block metadata', () => {
  it('BLOCK_TYPE_METADATA has condition entry with phase=3', () => {
    const meta = BLOCK_TYPE_METADATA['condition' as keyof typeof BLOCK_TYPE_METADATA];
    expect(meta).toBeDefined();
    expect(meta.label).toBe('Condition');
    expect(meta.phase).toBe(3);
  });

  it('BLOCK_TYPE_METADATA has forEach entry with phase=3', () => {
    const meta = BLOCK_TYPE_METADATA['forEach' as keyof typeof BLOCK_TYPE_METADATA];
    expect(meta).toBeDefined();
    expect(meta.label).toBe('ForEach');
    expect(meta.phase).toBe(3);
  });

  it('BLOCK_TYPE_METADATA has subWorkflow entry with phase=3', () => {
    const meta = BLOCK_TYPE_METADATA['subWorkflow' as keyof typeof BLOCK_TYPE_METADATA];
    expect(meta).toBeDefined();
    expect(meta.label).toBe('SubWorkflow');
    expect(meta.phase).toBe(3);
  });

  it('control-flow entries do not have agentNodeType', () => {
    const condMeta = BLOCK_TYPE_METADATA['condition' as keyof typeof BLOCK_TYPE_METADATA] as any;
    expect(condMeta.agentNodeType).toBeUndefined();
  });

  it('AVAILABLE_BLOCK_TYPES includes control-flow types at phase>=3', () => {
    // AVAILABLE_BLOCK_TYPES should filter by phase<=3 to include control-flow
    expect(AVAILABLE_BLOCK_TYPES).toContain('condition');
    expect(AVAILABLE_BLOCK_TYPES).toContain('forEach');
    expect(AVAILABLE_BLOCK_TYPES).toContain('subWorkflow');
  });
});
