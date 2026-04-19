import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } from 'electron';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

app.setName('floating-anki');

// One-shot migration from earlier name "anki-floating".
(() => {
  const appData = app.getPath('appData');
  const oldDir = path.join(appData, 'anki-floating');
  const newDir = path.join(appData, 'floating-anki');
  if (fsSync.existsSync(oldDir) && !fsSync.existsSync(newDir)) {
    try { fsSync.renameSync(oldDir, newDir); } catch { /* ignore */ }
  }
})();

type Bounds = { x?: number; y?: number; width: number; height: number };
type WindowState = { id: string; apkgPath: string | null; bounds: Bounds };
type Config = { windows: WindowState[] };

const DEFAULT_BOUNDS: Bounds = { width: 340, height: 260 };

let configCache: Config | null = null;
let tray: Tray | null = null;
const windows = new Map<string, BrowserWindow>();

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

async function loadConfig(): Promise<Config> {
  if (configCache) return configCache;
  try {
    const raw = await fs.readFile(configPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.windows)) {
      configCache = { windows: parsed.windows };
    } else {
      // Migrate from single-window format { apkgPath, bounds }.
      configCache = {
        windows: [
          {
            id: crypto.randomUUID(),
            apkgPath: parsed.apkgPath ?? null,
            bounds: parsed.bounds ?? DEFAULT_BOUNDS,
          },
        ],
      };
    }
  } catch {
    configCache = { windows: [] };
  }
  return configCache!;
}

async function saveConfig() {
  if (!configCache) return;
  await fs.writeFile(configPath(), JSON.stringify(configCache, null, 2));
}

function updateWindowState(id: string, patch: Partial<Omit<WindowState, 'id'>>) {
  if (!configCache) return;
  const idx = configCache.windows.findIndex((w) => w.id === id);
  if (idx < 0) return;
  configCache.windows[idx] = { ...configCache.windows[idx], ...patch };
  saveConfig();
}

function createWindow(state: WindowState) {
  const w = new BrowserWindow({
    ...state.bounds,
    minWidth: 260,
    minHeight: 180,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--window-id=${state.id}`],
    },
  });

  w.setAlwaysOnTop(true, 'floating');
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) w.loadURL(devUrl);
  else w.loadFile(path.join(__dirname, '../dist/index.html'));

  windows.set(state.id, w);

  const persist = () => updateWindowState(state.id, { bounds: w.getBounds() });
  w.on('moved', persist);
  w.on('resized', persist);
  w.on('closed', () => {
    windows.delete(state.id);
    if (!configCache) return;
    configCache.windows = configCache.windows.filter((x) => x.id !== state.id);
    saveConfig();
  });
}

async function openNewWindow() {
  const cfg = await loadConfig();
  const cursor = cfg.windows.length;
  const offset = cursor * 24;
  const state: WindowState = {
    id: crypto.randomUUID(),
    apkgPath: null,
    bounds: { ...DEFAULT_BOUNDS, x: 120 + offset, y: 120 + offset },
  };
  cfg.windows.push(state);
  await saveConfig();
  createWindow(state);
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('🎴');
  const menu = Menu.buildFromTemplate([
    { label: 'New window', click: () => openNewWindow() },
    {
      label: 'Show all',
      click: () => windows.forEach((w) => w.show()),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

// --- IPC ---

ipcMain.handle('self:state', async (_e, id: string) => {
  const cfg = await loadConfig();
  return cfg.windows.find((w) => w.id === id) ?? null;
});

ipcMain.handle('self:set-apkg', async (_e, id: string, apkgPath: string | null) => {
  updateWindowState(id, { apkgPath });
});

ipcMain.handle('window:new', async () => openNewWindow());

ipcMain.handle('window:close', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.close();
});

ipcMain.handle('apkg:pick', async (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return null;
  const res = await dialog.showOpenDialog(w, {
    title: 'Choose an Anki .apkg deck',
    properties: ['openFile'],
    filters: [{ name: 'Anki Deck', extensions: ['apkg'] }],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle('apkg:read', async (_e, filePath: string) => {
  const buf = await fs.readFile(filePath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
});

function reviewsPath(apkgPath: string) {
  const key = crypto.createHash('sha1').update(apkgPath).digest('hex').slice(0, 16);
  return path.join(app.getPath('userData'), `reviews-${key}.json`);
}

ipcMain.handle('reviews:get', async (_e, apkgPath: string) => {
  try {
    const raw = await fs.readFile(reviewsPath(apkgPath), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
});

ipcMain.handle('reviews:save', async (_e, apkgPath: string, reviews: unknown) => {
  await fs.writeFile(reviewsPath(apkgPath), JSON.stringify(reviews));
});

// --- Lifecycle ---

app.whenReady().then(async () => {
  const cfg = await loadConfig();
  if (cfg.windows.length === 0) {
    await openNewWindow();
  } else {
    for (const state of cfg.windows) createWindow(state);
  }
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openNewWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
