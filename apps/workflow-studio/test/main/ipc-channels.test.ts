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

describe('IPC_CHANNELS (P15-F09 merge conflict)', () => {
  it('has EXECUTION_MERGE_CONFLICT channel', () => {
    expect(IPC_CHANNELS.EXECUTION_MERGE_CONFLICT).toBe('execution:merge-conflict');
  });

  it('has EXECUTION_MERGE_RESOLVE channel (#281)', () => {
    expect(IPC_CHANNELS.EXECUTION_MERGE_RESOLVE).toBe('execution:merge-resolve');
  });
});

describe('IPC_CHANNELS monitoring channels match preload (#287)', () => {
  it('MONITORING_RECEIVER_START matches preload string', () => {
    expect(IPC_CHANNELS.MONITORING_RECEIVER_START).toBe('monitoring:receiver-start');
  });

  it('MONITORING_RECEIVER_STOP matches preload string', () => {
    expect(IPC_CHANNELS.MONITORING_RECEIVER_STOP).toBe('monitoring:receiver-stop');
  });
});
