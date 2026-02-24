import { app, BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { registerAllHandlers } from './ipc';
import { CLISpawner } from './services/cli-spawner';
import { WorkItemService } from './services/workitem-service';
import { WorkflowFileService } from './services/workflow-file-service';
import { SettingsService } from './services/settings-service';
import { SessionHistoryService } from './services/session-history-service';

// ---------------------------------------------------------------------------
// Window bounds persistence
// ---------------------------------------------------------------------------

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

function getBoundsFilePath(): string {
  const userDataPath = app.getPath('userData');
  return join(userDataPath, 'window-bounds.json');
}

function loadWindowBounds(): WindowBounds | null {
  try {
    const filePath = getBoundsFilePath();
    if (existsSync(filePath)) {
      const data = readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as WindowBounds;
    }
  } catch {
    // Ignore errors, use defaults
  }
  return null;
}

function saveWindowBounds(win: BrowserWindow): void {
  try {
    const bounds = win.getBounds();
    const isMaximized = win.isMaximized();
    const data: WindowBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
    };
    const filePath = getBoundsFilePath();
    const dir = join(filePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch {
    // Ignore errors on save
  }
}

function ensureBoundsVisible(bounds: WindowBounds): WindowBounds {
  const displays = screen.getAllDisplays();
  const isVisible = displays.some((display) => {
    const { x, y, width, height } = display.workArea;
    return (
      bounds.x >= x - 100 &&
      bounds.y >= y - 100 &&
      bounds.x < x + width - 100 &&
      bounds.y < y + height - 100
    );
  });

  if (!isVisible) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    return {
      x: Math.round((width - DEFAULT_WIDTH) / 2),
      y: Math.round((height - DEFAULT_HEIGHT) / 2),
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      isMaximized: false,
    };
  }

  return bounds;
}

// ---------------------------------------------------------------------------
// Service instances (initialised after app.whenReady)
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;
let cliSpawner: CLISpawner | null = null;
const settingsService = new SettingsService();

function createWindow(): void {
  const savedBounds = loadWindowBounds();
  const bounds = savedBounds
    ? ensureBoundsVisible(savedBounds)
    : { x: undefined, y: undefined, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, isMaximized: false };

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 900,
    minHeight: 600,
    title: 'aSDLC Workflow Studio',
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, '..', 'preload', 'preload.js'),
    },
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (bounds.isMaximized) {
      mainWindow?.maximize();
    }
    mainWindow?.show();
  });

  // Save window bounds on resize/move
  mainWindow.on('resize', () => {
    if (mainWindow) saveWindowBounds(mainWindow);
  });
  mainWindow.on('move', () => {
    if (mainWindow) saveWindowBounds(mainWindow);
  });
  mainWindow.on('maximize', () => {
    if (mainWindow) saveWindowBounds(mainWindow);
  });
  mainWindow.on('unmaximize', () => {
    if (mainWindow) saveWindowBounds(mainWindow);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

}

function loadWindowContent(): void {
  if (!mainWindow) return;
  // Load the app — called after IPC handlers are registered to avoid
  // "No handler registered" errors from renderer startup IPC calls.
  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  // Load persisted settings
  const settings = await settingsService.load();

  // Create the BrowserWindow (but don't load any URL yet)
  createWindow();

  // Instantiate services that depend on the BrowserWindow
  cliSpawner = new CLISpawner(mainWindow!);

  const projectRoot = process.env.ASDLC_PROJECT_ROOT || process.cwd();
  const workItemService = new WorkItemService(projectRoot);
  const workflowFileService = new WorkflowFileService(settings.workflowDirectory);
  const templateFileService = new WorkflowFileService(
    settings.templateDirectory || join(app.getPath('userData'), 'templates'),
  );

  const sessionHistoryService = new SessionHistoryService();

  // Register all IPC handlers BEFORE loading the renderer URL so that
  // startup IPC calls from the renderer are never met with "no handler".
  registerAllHandlers({
    cliSpawner,
    workItemService,
    workflowFileService,
    templateFileService,
    settingsService,
    sessionHistoryService,
  });

  // Now load the renderer — handlers are ready
  loadWindowContent();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked and no windows exist
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Kill all CLI child processes before quitting
  cliSpawner?.killAll();

  // On macOS, apps typically stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ---------------------------------------------------------------------------
// Temp directory cleanup (P15-F03, T22)
//
// Clean up wf-repo-* directories in the system temp dir on quit.
// ---------------------------------------------------------------------------

app.on('before-quit', () => {
  try {
    const tempDir = tmpdir();
    const entries = readdirSync(tempDir);
    let cleaned = 0;

    for (const entry of entries) {
      if (entry.startsWith('wf-repo-')) {
        try {
          rmSync(join(tempDir, entry), { recursive: true, force: true });
          cleaned++;
        } catch {
          // Best effort cleanup -- ignore individual failures
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[Cleanup] Removed ${cleaned} temporary repo directories`);
    }
  } catch {
    // Do not crash on cleanup failure
  }
});
