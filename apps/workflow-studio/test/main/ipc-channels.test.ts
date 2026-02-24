// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';

describe('IPC_CHANNELS (P15-F03 additions)', () => {
  it('has WORKFLOW_TOUCH channel', () => {
    expect(IPC_CHANNELS.WORKFLOW_TOUCH).toBe('workflow:touch');
  });

  it('has REPO_CLONE channel', () => {
    expect(IPC_CHANNELS.REPO_CLONE).toBe('repo:clone');
  });

  it('has REPO_VALIDATE_PATH channel', () => {
    expect(IPC_CHANNELS.REPO_VALIDATE_PATH).toBe('repo:validate-path');
  });

  it('has REPO_CLONE_CANCEL channel', () => {
    expect(IPC_CHANNELS.REPO_CLONE_CANCEL).toBe('repo:clone-cancel');
  });

  it('has REPO_CLONE_PROGRESS channel', () => {
    expect(IPC_CHANNELS.REPO_CLONE_PROGRESS).toBe('repo:clone-progress');
  });

  it('has WORKITEM_LIST_FS channel', () => {
    expect(IPC_CHANNELS.WORKITEM_LIST_FS).toBe('workitem:list-fs');
  });

  it('has DIALOG_OPEN_DIRECTORY channel', () => {
    expect(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY).toBe('dialog:open-directory');
  });
});
