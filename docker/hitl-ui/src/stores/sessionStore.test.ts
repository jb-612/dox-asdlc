import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './sessionStore';

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().clearSession();
  });

  it('sets environment', () => {
    useSessionStore.getState().setEnvironment('prod');
    expect(useSessionStore.getState().environment).toBe('prod');
  });

  it('sets repo and epic', () => {
    useSessionStore.getState().setRepo('test-repo');
    useSessionStore.getState().setEpic('EPIC-001');

    const state = useSessionStore.getState();
    expect(state.repo).toBe('test-repo');
    expect(state.epicId).toBe('EPIC-001');
  });

  it('sets git state', () => {
    useSessionStore.getState().setGitState('abc123', 'main');

    const state = useSessionStore.getState();
    expect(state.currentGitSha).toBe('abc123');
    expect(state.currentBranch).toBe('main');
  });

  it('clears session to defaults', () => {
    useSessionStore.getState().setEnvironment('prod');
    useSessionStore.getState().setRepo('test');
    useSessionStore.getState().clearSession();

    const state = useSessionStore.getState();
    expect(state.environment).toBe('dev');
    expect(state.repo).toBe('');
    expect(state.epicId).toBeNull();
  });
});
