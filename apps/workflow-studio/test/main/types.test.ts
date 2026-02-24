// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { RepoMount } from '../../src/shared/types/repo';
import type { WorkflowMetadata } from '../../src/shared/types/workflow';

describe('RepoMount type (T02, T23)', () => {
  it('supports all expected fields', () => {
    const mount: RepoMount = {
      source: 'local',
      localPath: '/tmp/my-repo',
      fileRestrictions: ['src/**/*.ts'],
      readOnly: true,
    };

    expect(mount.source).toBe('local');
    expect(mount.localPath).toBe('/tmp/my-repo');
    expect(mount.fileRestrictions).toEqual(['src/**/*.ts']);
    expect(mount.readOnly).toBe(true);
  });

  it('supports github source', () => {
    const mount: RepoMount = {
      source: 'github',
      githubUrl: 'https://github.com/owner/repo.git',
      branch: 'main',
      cloneDepth: 1,
    };

    expect(mount.source).toBe('github');
    expect(mount.githubUrl).toBe('https://github.com/owner/repo.git');
  });

  it('allows all optional fields to be undefined', () => {
    const mount: RepoMount = {
      source: 'local',
    };

    expect(mount.localPath).toBeUndefined();
    expect(mount.fileRestrictions).toBeUndefined();
    expect(mount.readOnly).toBeUndefined();
  });
});

describe('WorkflowMetadata type (T01)', () => {
  it('supports status and lastUsedAt fields', () => {
    const meta: WorkflowMetadata = {
      name: 'Test',
      version: '1.0.0',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      tags: [],
      status: 'active',
      lastUsedAt: '2026-01-15T10:30:00Z',
    };

    expect(meta.status).toBe('active');
    expect(meta.lastUsedAt).toBe('2026-01-15T10:30:00Z');
  });

  it('allows status to be paused', () => {
    const meta: WorkflowMetadata = {
      name: 'Test',
      version: '1.0.0',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      tags: [],
      status: 'paused',
    };

    expect(meta.status).toBe('paused');
  });

  it('allows status and lastUsedAt to be undefined', () => {
    const meta: WorkflowMetadata = {
      name: 'Test',
      version: '1.0.0',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      tags: [],
    };

    expect(meta.status).toBeUndefined();
    expect(meta.lastUsedAt).toBeUndefined();
  });
});
