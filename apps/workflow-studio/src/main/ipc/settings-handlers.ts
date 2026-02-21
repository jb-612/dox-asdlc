import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { SettingsService } from '../services/settings-service';
import type { AppSettings } from '../../shared/types/settings';

export function registerSettingsHandlers(settingsService: SettingsService): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_LOAD, async () => {
    return settingsService.load();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, settings: Partial<AppSettings>) => {
    try {
      await settingsService.save(settings);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}
