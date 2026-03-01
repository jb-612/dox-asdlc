import { readdir, readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import type {
  ExecutionCostSummary,
  DailyAnalytics,
  DailyCostPoint,
} from '../../shared/types/analytics';

const MAX_EXECUTIONS_PER_DAY = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class AnalyticsService {
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async saveExecution(summary: ExecutionCostSummary): Promise<void> {
    const date = summary.startedAt.slice(0, 10);
    if (!DATE_RE.test(date)) return;
    const filePath = join(this.dataDir, `${date}.json`);

    let daily: DailyAnalytics;
    try {
      const raw = await readFile(filePath, 'utf-8');
      daily = JSON.parse(raw) as DailyAnalytics;
    } catch {
      daily = { date, executions: [], totalCostUsd: 0 };
    }

    daily.executions.push(summary);

    if (daily.executions.length > MAX_EXECUTIONS_PER_DAY) {
      daily.executions = daily.executions.slice(
        daily.executions.length - MAX_EXECUTIONS_PER_DAY,
      );
    }

    daily.totalCostUsd = daily.executions.reduce(
      (sum, e) => sum + e.totalCostUsd,
      0,
    );

    await mkdir(this.dataDir, { recursive: true });
    await writeFile(filePath, JSON.stringify(daily, null, 2));
  }

  async getExecutions(
    fromDate: string,
    toDate: string,
  ): Promise<ExecutionCostSummary[]> {
    const dailyFiles = await this.loadDailyFiles(fromDate, toDate);
    return dailyFiles.flatMap((d) => d.executions);
  }

  async getDailyCosts(
    fromDate: string,
    toDate: string,
  ): Promise<DailyCostPoint[]> {
    const dailyFiles = await this.loadDailyFiles(fromDate, toDate);
    return dailyFiles.map((d) => ({
      date: d.date,
      totalCostUsd: d.totalCostUsd,
    }));
  }

  async pruneOldData(retentionDays: number): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    let files: string[];
    try {
      files = await readdir(this.dataDir);
    } catch {
      return;
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const fileDate = file.replace('.json', '');
      if (fileDate < cutoffStr) {
        await unlink(join(this.dataDir, file));
      }
    }
  }

  private async loadDailyFiles(
    fromDate: string,
    toDate: string,
  ): Promise<DailyAnalytics[]> {
    const files = await this.getFilesInRange(fromDate, toDate);
    const results: DailyAnalytics[] = [];

    for (const file of files) {
      try {
        const raw = await readFile(join(this.dataDir, file), 'utf-8');
        results.push(JSON.parse(raw) as DailyAnalytics);
      } catch {
        // Skip corrupt files
      }
    }

    return results;
  }

  private async getFilesInRange(
    fromDate: string,
    toDate: string,
  ): Promise<string[]> {
    let files: string[];
    try {
      files = await readdir(this.dataDir);
    } catch {
      return [];
    }

    return files.filter((f) => {
      if (!f.endsWith('.json')) return false;
      const date = f.replace('.json', '');
      return date >= fromDate && date <= toDate;
    });
  }
}
