// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- fs/promises and child_process (must be before import)
// ---------------------------------------------------------------------------

const mockReaddir = vi.fn();
const mockReadFile = vi.fn();

vi.mock('fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const mockExecAsync = vi.fn();

// Mock child_process.exec with a [util.promisify.custom] symbol so that
// promisify(exec) returns our mockExecAsync directly.
vi.mock('child_process', async () => {
  const { promisify } = await import('util');
  const execFn = Object.assign(
    (cmd: string, optsOrCb: unknown, maybeCb?: unknown) => {
      const cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
      if (typeof cb === 'function') (cb as Function)(null, '', '');
      return { on: vi.fn(), stdout: null, stderr: null, kill: vi.fn() };
    },
    {
      [promisify.custom]: (cmd: string, opts?: unknown) => mockExecAsync(cmd, opts),
    },
  );
  return { exec: execFn };
});

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { WorkItemService } from '../../src/main/services/workitem-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal Dirent-like object for readdir({ withFileTypes: true }). */
function makeDirent(name: string, isDir: boolean) {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    parentPath: '',
    path: '',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkItemService', () => {
  let service: WorkItemService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkItemService('/fake/project');
  });

  // =========================================================================
  // listPRDs (via list('prd'))
  // =========================================================================

  describe('list("prd") / listPRDs', () => {
    it('scans .workitems/ directories and extracts title from # heading in design.md', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('P01-F01-feature', true),
      ]);
      mockReadFile.mockResolvedValue('# My Feature Title\n\nSome description content here.');

      const result = await service.list('prd');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'P01-F01-feature',
          type: 'prd',
          source: 'filesystem',
          title: 'My Feature Title',
        }),
      );
      expect(result[0].path).toContain('design.md');
      expect(result[0].content).toContain('# My Feature Title');
    });

    it('falls back to directory name when design.md has no heading', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('P02-F01-no-heading', true),
      ]);
      mockReadFile.mockResolvedValue('Some content without a heading marker.');

      const result = await service.list('prd');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('P02-F01-no-heading');
    });

    it('truncates description to 200 characters', async () => {
      const longContent = '# Title\n' + 'A'.repeat(300);
      mockReaddir.mockResolvedValue([
        makeDirent('P03-F01-long', true),
      ]);
      mockReadFile.mockResolvedValue(longContent);

      const result = await service.list('prd');

      expect(result).toHaveLength(1);
      expect(result[0].description).toHaveLength(200);
    });

    it('skips directories that do not contain design.md', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('P04-F01-has-design', true),
        makeDirent('P04-F02-no-design', true),
      ]);

      // First call succeeds (P04-F01-has-design), second call fails (P04-F02-no-design)
      mockReadFile
        .mockResolvedValueOnce('# Has Design\nContent here.')
        .mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

      const result = await service.list('prd');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('P04-F01-has-design');
    });

    it('skips non-directory entries in .workitems/', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('README.md', false),
        makeDirent('P05-F01-real', true),
      ]);
      mockReadFile.mockResolvedValue('# Real Feature\nContent.');

      const result = await service.list('prd');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('P05-F01-real');
      // readFile should only be called once (for the directory entry, not the file entry)
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when .workitems/ directory is empty', async () => {
      mockReaddir.mockResolvedValue([]);

      const result = await service.list('prd');

      expect(result).toEqual([]);
    });

    it('returns empty array when .workitems/ directory does not exist', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await service.list('prd');

      expect(result).toEqual([]);
    });

    it('handles multiple directories with design.md files', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('P06-F01-alpha', true),
        makeDirent('P06-F02-beta', true),
        makeDirent('P06-F03-gamma', true),
      ]);
      mockReadFile
        .mockResolvedValueOnce('# Alpha Feature\nAlpha body.')
        .mockResolvedValueOnce('# Beta Feature\nBeta body.')
        .mockResolvedValueOnce('# Gamma Feature\nGamma body.');

      const result = await service.list('prd');

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.title)).toEqual([
        'Alpha Feature',
        'Beta Feature',
        'Gamma Feature',
      ]);
    });

    it('stores full file content in the content field', async () => {
      const fullContent = '# Feature X\n\nDetailed description\n\n## Section\nMore text.';
      mockReaddir.mockResolvedValue([
        makeDirent('P07-F01-full-content', true),
      ]);
      mockReadFile.mockResolvedValue(fullContent);

      const result = await service.list('prd');

      expect(result[0].content).toBe(fullContent);
    });
  });

  // =========================================================================
  // listGitHubIssues (via list('issue'))
  // =========================================================================

  describe('list("issue") / listGitHubIssues', () => {
    it('calls gh issue list and parses JSON output', async () => {
      const ghOutput = JSON.stringify([
        {
          number: 42,
          title: 'Fix the bug',
          body: 'The bug description here.',
          labels: [{ name: 'bug' }],
        },
        {
          number: 43,
          title: 'Add feature',
          body: 'Feature request details.',
          labels: [{ name: 'enhancement' }, { name: 'priority:high' }],
        },
      ]);
      mockExecAsync.mockResolvedValue({ stdout: ghOutput, stderr: '' });

      const result = await service.list('issue');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'issue-42',
          type: 'issue',
          source: 'github',
          title: '#42: Fix the bug',
          labels: ['bug'],
        }),
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          id: 'issue-43',
          type: 'issue',
          source: 'github',
          title: '#43: Add feature',
          labels: ['enhancement', 'priority:high'],
        }),
      );
    });

    it('truncates issue body description to 200 characters', async () => {
      const longBody = 'B'.repeat(500);
      const ghOutput = JSON.stringify([
        { number: 1, title: 'Long Issue', body: longBody, labels: [] },
      ]);
      mockExecAsync.mockResolvedValue({ stdout: ghOutput, stderr: '' });

      const result = await service.list('issue');

      expect(result[0].description).toHaveLength(200);
    });

    it('handles null/missing body gracefully', async () => {
      const ghOutput = JSON.stringify([
        { number: 10, title: 'No Body', body: null, labels: [] },
      ]);
      mockExecAsync.mockResolvedValue({ stdout: ghOutput, stderr: '' });

      const result = await service.list('issue');

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('');
      expect(result[0].content).toBe('');
    });

    it('handles missing labels gracefully', async () => {
      const ghOutput = JSON.stringify([
        { number: 11, title: 'No Labels', body: 'Some body', labels: null },
      ]);
      mockExecAsync.mockResolvedValue({ stdout: ghOutput, stderr: '' });

      const result = await service.list('issue');

      expect(result).toHaveLength(1);
      expect(result[0].labels).toEqual([]);
    });

    it('returns empty array when gh command fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('gh: command not found'));

      const result = await service.list('issue');

      expect(result).toEqual([]);
    });

    it('returns empty array when gh returns empty JSON array', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '[]', stderr: '' });

      const result = await service.list('issue');

      expect(result).toEqual([]);
    });

    it('executes gh command with correct cwd', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '[]', stderr: '' });

      await service.list('issue');

      expect(mockExecAsync).toHaveBeenCalledWith(
        'gh issue list --json number,title,body,labels --limit 20',
        expect.objectContaining({ cwd: '/fake/project' }),
      );
    });
  });

  // =========================================================================
  // list(type) dispatch
  // =========================================================================

  describe('list(type) dispatch', () => {
    it('dispatches to listPRDs for type "prd"', async () => {
      mockReaddir.mockResolvedValue([]);

      const result = await service.list('prd');

      expect(result).toEqual([]);
      expect(mockReaddir).toHaveBeenCalled();
    });

    it('dispatches to listGitHubIssues for type "issue"', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '[]', stderr: '' });

      const result = await service.list('issue');

      expect(result).toEqual([]);
    });

    it('returns empty array for type "idea" (placeholder)', async () => {
      const result = await service.list('idea');

      expect(result).toEqual([]);
      expect(mockReaddir).not.toHaveBeenCalled();
      expect(mockExecAsync).not.toHaveBeenCalled();
    });

    it('returns empty array for type "manual" (placeholder)', async () => {
      const result = await service.list('manual');

      expect(result).toEqual([]);
    });

    it('returns empty array for unknown type', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await service.list('unknown' as any);

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // listAll
  // =========================================================================

  describe('listAll', () => {
    it('combines PRDs and GitHub issues', async () => {
      // Set up PRDs
      mockReaddir.mockResolvedValue([
        makeDirent('P08-F01-prd', true),
      ]);
      mockReadFile.mockResolvedValue('# PRD Item\nContent.');

      // Set up GitHub issues
      const ghOutput = JSON.stringify([
        { number: 99, title: 'Issue Item', body: 'Issue body.', labels: [] },
      ]);
      mockExecAsync.mockResolvedValue({ stdout: ghOutput, stderr: '' });

      const result = await service.listAll();

      expect(result).toHaveLength(2);
      const types = result.map((r) => r.type);
      expect(types).toContain('prd');
      expect(types).toContain('issue');
    });

    it('returns only PRDs when GitHub issues fail', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('P09-F01-only-prd', true),
      ]);
      mockReadFile.mockResolvedValue('# Only PRD\nContent.');
      mockExecAsync.mockRejectedValue(new Error('gh not available'));

      const result = await service.listAll();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('prd');
    });

    it('returns only issues when .workitems/ is missing', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));
      const ghOutput = JSON.stringify([
        { number: 50, title: 'Only Issue', body: 'Body.', labels: [] },
      ]);
      mockExecAsync.mockResolvedValue({ stdout: ghOutput, stderr: '' });

      const result = await service.listAll();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('issue');
    });

    it('returns empty array when both sources fail', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));
      mockExecAsync.mockRejectedValue(new Error('gh not found'));

      const result = await service.listAll();

      expect(result).toEqual([]);
    });

    it('fetches PRDs and issues in parallel', async () => {
      // Verify that both are called (Promise.all behavior)
      let readdirCalled = false;
      let execCalled = false;

      mockReaddir.mockImplementation(async () => {
        readdirCalled = true;
        return [];
      });
      mockExecAsync.mockImplementation(async () => {
        execCalled = true;
        return { stdout: '[]', stderr: '' };
      });

      await service.listAll();

      expect(readdirCalled).toBe(true);
      expect(execCalled).toBe(true);
    });
  });

  // =========================================================================
  // get(id)
  // =========================================================================

  describe('get(id)', () => {
    it('returns a PRD when id matches a PRD entry', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('P10-F01-target', true),
      ]);
      mockReadFile.mockResolvedValue('# Target PRD\nContent.');
      mockExecAsync.mockResolvedValue({ stdout: '[]', stderr: '' });

      const result = await service.get('P10-F01-target');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('P10-F01-target');
      expect(result!.type).toBe('prd');
    });

    it('returns a GitHub issue when id matches an issue', async () => {
      mockReaddir.mockResolvedValue([]);
      const ghOutput = JSON.stringify([
        { number: 77, title: 'Found Issue', body: 'Found body.', labels: [] },
      ]);
      mockExecAsync.mockResolvedValue({ stdout: ghOutput, stderr: '' });

      const result = await service.get('issue-77');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('issue-77');
      expect(result!.type).toBe('issue');
    });

    it('returns null when id matches neither PRDs nor issues', async () => {
      mockReaddir.mockResolvedValue([]);
      mockExecAsync.mockResolvedValue({ stdout: '[]', stderr: '' });

      const result = await service.get('nonexistent-id');

      expect(result).toBeNull();
    });

    it('searches PRDs first before falling back to issues', async () => {
      // If a PRD matches, issues should not be checked
      mockReaddir.mockResolvedValue([
        makeDirent('P11-F01-prd-first', true),
      ]);
      mockReadFile.mockResolvedValue('# PRD First\nContent.');

      const result = await service.get('P11-F01-prd-first');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('prd');
      // execAsync should NOT have been called since PRD was found first
      expect(mockExecAsync).not.toHaveBeenCalled();
    });

    it('returns null when both sources fail', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));
      mockExecAsync.mockRejectedValue(new Error('gh not found'));

      const result = await service.get('any-id');

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Constructor
  // =========================================================================

  describe('constructor', () => {
    it('stores the project root for use in listPRDs and listGitHubIssues', async () => {
      const customService = new WorkItemService('/custom/root');
      mockReaddir.mockResolvedValue([]);

      await customService.list('prd');

      // readdir should be called with /custom/root/.workitems
      expect(mockReaddir).toHaveBeenCalledWith(
        expect.stringContaining('/custom/root/.workitems'),
        expect.any(Object),
      );
    });
  });
});
