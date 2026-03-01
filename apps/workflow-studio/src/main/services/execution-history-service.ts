import { readFileSync, existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import type {
  ExecutionHistoryEntry,
  ExecutionHistorySummary,
} from '../../shared/types/execution';

const MAX_ENTRIES = 100;
const FILE_NAME = 'execution-history.json';

/**
 * Persistent execution history with ring buffer eviction (P15-F14).
 * Stores entries as JSON in <dataDir>/execution-history.json.
 */
export class ExecutionHistoryService {
  private entries: ExecutionHistoryEntry[] = [];
  private filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = join(dataDir, FILE_NAME);
    this.load();
  }

  private load(): void {
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8'));
        this.entries = Array.isArray(parsed) ? parsed : [];
      } catch {
        this.entries = [];
      }
    }
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.entries, null, 2));
  }

  async addEntry(entry: ExecutionHistoryEntry): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      this.entries.push(entry);
      if (this.entries.length > MAX_ENTRIES) {
        this.entries = this.entries.slice(-MAX_ENTRIES);
      }
      await this.persist();
    });
    return this.writeQueue;
  }

  list(): ExecutionHistorySummary[] {
    return this.entries.map(({ id, workflowId, workflowName, status, startedAt, completedAt }) => ({
      id,
      workflowId,
      workflowName,
      status,
      startedAt,
      completedAt,
    }));
  }

  getById(id: string): ExecutionHistoryEntry | null {
    return this.entries.find(e => e.id === id) ?? null;
  }

  async clear(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      this.entries = [];
      await this.persist();
    });
    return this.writeQueue;
  }
}
