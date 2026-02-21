import { app, BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { registerAllHandlers } from './ipc';

// Window bounds persistence
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

let mainWindow: BrowserWindow | null = null;

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

  // Load the app
  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  }
}

// App lifecycle
app.whenReady().then(() => {
  registerAllHandlers();
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked and no windows exist
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
