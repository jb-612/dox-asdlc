// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T10: GitHub event parser
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

describe('F17-T10: GitHub event parser', { timeout: 30000 }, () => {
  it('push event extracts ref/repo/sha', async () => {
    const { parseGitHubEvent } = await import('../../src/cli/github-event-parser');
    const payload = {
      ref: 'refs/heads/main',
      repository: { full_name: 'owner/repo' },
      head_commit: { id: 'abc123' },
    };

    const vars = parseGitHubEvent('push', payload);
    expect(vars).toEqual({
      github_event: 'push',
      github_ref: 'refs/heads/main',
      github_repo: 'owner/repo',
      github_sha: 'abc123',
    });
  });

  it('pull_request event extracts number/head/base', async () => {
    const { parseGitHubEvent } = await import('../../src/cli/github-event-parser');
    const payload = {
      action: 'opened',
      number: 42,
      pull_request: {
        head: { ref: 'feature-branch', sha: 'def456' },
        base: { ref: 'main' },
      },
    };

    const vars = parseGitHubEvent('pull_request', payload);
    expect(vars).toEqual({
      github_event: 'pull_request',
      github_pr_number: '42',
      github_pr_head: 'feature-branch',
      github_pr_head_sha: 'def456',
      github_pr_base: 'main',
      github_pr_action: 'opened',
    });
  });

  it('returns null when no event header', async () => {
    const { parseGitHubEvent } = await import('../../src/cli/github-event-parser');
    const result = parseGitHubEvent(null, {});
    expect(result).toBeNull();
  });

  it('generic payload returns event name only', async () => {
    const { parseGitHubEvent } = await import('../../src/cli/github-event-parser');
    const vars = parseGitHubEvent('release', { action: 'published' });
    expect(vars).toEqual({ github_event: 'release' });
  });
});
