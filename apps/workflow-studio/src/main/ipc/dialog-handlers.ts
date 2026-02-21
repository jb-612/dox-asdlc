import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

export function registerDialogHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });
}
