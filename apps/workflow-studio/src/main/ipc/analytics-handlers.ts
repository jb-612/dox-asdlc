import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { AnalyticsService } from '../services/analytics-service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(v: unknown): v is string {
  return typeof v === 'string' && DATE_RE.test(v);
}

export function registerAnalyticsHandlers(
  analyticsService: AnalyticsService,
): void {
  ipcMain.handle(
    IPC_CHANNELS.ANALYTICS_GET_EXECUTIONS,
    (_event, fromDate: string, toDate: string) => {
      if (!isValidDate(fromDate) || !isValidDate(toDate)) return [];
      return analyticsService.getExecutions(fromDate, toDate);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.ANALYTICS_GET_DAILY_COSTS,
    (_event, fromDate: string, toDate: string) => {
      if (!isValidDate(fromDate) || !isValidDate(toDate)) return [];
      return analyticsService.getDailyCosts(fromDate, toDate);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.ANALYTICS_GET_EXECUTION,
    async (_event, executionId: string, fromDate: string, toDate: string) => {
      if (typeof executionId !== 'string' || !executionId) return null;
      if (!isValidDate(fromDate) || !isValidDate(toDate)) return null;
      const all = await analyticsService.getExecutions(fromDate, toDate);
      return all.find((e) => e.executionId === executionId) ?? null;
    },
  );
}
