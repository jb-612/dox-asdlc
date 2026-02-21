import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { WorkItem, WorkItemType } from '../../shared/types/workitem';

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// WorkItemService
//
// Reads work items from two sources:
//   1. PRDs on the filesystem (.workitems/ directory with design.md files)
//   2. GitHub issues via the `gh` CLI
//
// The service is read-only; it does not create or modify work items.
// ---------------------------------------------------------------------------

export class WorkItemService {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * List work items of the given type. Pass 'prd' for filesystem PRDs,
   * 'issue' for GitHub issues, or 'idea' for the (placeholder) idea bucket.
   */
  async list(type: WorkItemType): Promise<WorkItem[]> {
    switch (type) {
      case 'prd':
        return this.listPRDs();
      case 'issue':
        return this.listGitHubIssues();
      case 'idea':
        return []; // placeholder for future implementation
      case 'manual':
        return []; // placeholder for future implementation
      default:
        return [];
    }
  }

  /**
   * List all work items across every type.
   */
  async listAll(): Promise<WorkItem[]> {
    const [prds, issues] = await Promise.all([
      this.listPRDs(),
      this.listGitHubIssues(),
    ]);
    return [...prds, ...issues];
  }

  // -------------------------------------------------------------------------
  // PRD scanning
  // -------------------------------------------------------------------------

  private async listPRDs(): Promise<WorkItem[]> {
    const workitemsDir = join(this.projectRoot, '.workitems');
    try {
      const entries = await readdir(workitemsDir, { withFileTypes: true });
      const items: WorkItem[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const designPath = join(workitemsDir, entry.name, 'design.md');
        try {
          const content = await readFile(designPath, 'utf-8');
          const title = content.match(/^#\s+(.+)/m)?.[1] || entry.name;
          items.push({
            id: entry.name,
            type: 'prd',
            source: 'filesystem',
            title,
            description: content.slice(0, 200),
            path: designPath,
            content,
          });
        } catch {
          /* skip directories without design.md */
        }
      }
      return items;
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // GitHub issue fetching
  // -------------------------------------------------------------------------

  private async listGitHubIssues(): Promise<WorkItem[]> {
    try {
      const { stdout } = await execAsync(
        'gh issue list --json number,title,body,labels --limit 20',
        { cwd: this.projectRoot },
      );
      const issues = JSON.parse(stdout);
      return issues.map((issue: Record<string, unknown>) => ({
        id: `issue-${issue.number}`,
        type: 'issue' as const,
        source: 'github' as const,
        title: `#${issue.number}: ${issue.title}`,
        description: (typeof issue.body === 'string' ? issue.body : '').slice(0, 200),
        content: typeof issue.body === 'string' ? issue.body : '',
        labels: Array.isArray(issue.labels)
          ? issue.labels.map((l: Record<string, unknown>) => String(l.name ?? ''))
          : [],
      }));
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Single item lookup
  // -------------------------------------------------------------------------

  /**
   * Retrieve a single work item by ID. Searches PRDs first, then issues.
   */
  async get(id: string): Promise<WorkItem | null> {
    // Try PRDs first
    const prds = await this.listPRDs();
    const prd = prds.find((p) => p.id === id);
    if (prd) return prd;

    // Try issues
    const issues = await this.listGitHubIssues();
    return issues.find((i) => i.id === id) || null;
  }
}
