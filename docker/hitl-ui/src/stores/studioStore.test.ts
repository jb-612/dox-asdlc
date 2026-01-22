import { describe, it, expect, beforeEach } from 'vitest';
import { useStudioStore } from './studioStore';

describe('studioStore', () => {
  beforeEach(() => {
    useStudioStore.getState().resetStudio();
  });

  it('adds and updates messages', () => {
    useStudioStore.getState().addMessage({ role: 'user', content: 'Test' });

    const { messages } = useStudioStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Test');
    expect(messages[0].id).toMatch(/^msg-/);
  });

  it('calculates outline completeness', () => {
    useStudioStore.getState().updateOutline([
      { id: 's1', title: 'Section 1', status: 'complete' },
      { id: 's2', title: 'Section 2', status: 'not_started' },
    ]);

    expect(useStudioStore.getState().completeness).toBe(50);
  });

  it('manages artifacts', () => {
    useStudioStore.getState().addArtifact({
      name: 'PRD.md',
      type: 'prd',
      status: 'draft',
      validationStatus: { isValid: true, warnings: [], errors: [] },
    });

    const { artifacts } = useStudioStore.getState();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].name).toBe('PRD.md');
  });

  it('sets model and RLM state', () => {
    useStudioStore.getState().setSelectedModel('opus');
    useStudioStore.getState().setRlmEnabled(true);

    const state = useStudioStore.getState();
    expect(state.selectedModel).toBe('opus');
    expect(state.rlmEnabled).toBe(true);
  });
});
