import { app, BrowserWindow, Tray, Menu, nativeImage, screen, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOUNDS_FILE = path.join(__dirname, 'data', 'bounds.json');
let mainWindow;
let tray = null;

function getSavedBounds() {
  try {
    if (fs.existsSync(BOUNDS_FILE)) {
      return JSON.parse(fs.readFileSync(BOUNDS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { x: 50, y: 70, width: 340, height: 480 };
}

function saveBounds(bounds) {
  try {
    fs.writeFileSync(BOUNDS_FILE, JSON.stringify(bounds, null, 2), 'utf-8');
  } catch (e) {}
}

function getAppIconPath() {
  if (process.platform === 'win32') {
    return path.join(__dirname, 'icon.ico');
  }
  return path.join(__dirname, 'icon_512.png');
}

function createWidgetWindow() {
  if (mainWindow) return;

  const saved = getSavedBounds();
  const iconPath = getAppIconPath();

  mainWindow = new BrowserWindow({
    title: 'Team To do',
    width: saved.width || 340,
    height: saved.height || 480,
    x: saved.x || 50,
    y: saved.y || 70,
    minWidth: 280,
    minHeight: 320,
    maxWidth: 900,
    maxHeight: 1000,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    alwaysOnTop: false,
    show: false,
    icon: iconPath,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Hide traffic lights and set desktop widget behavior on macOS
  if (process.platform === 'darwin') {
    mainWindow.setWindowButtonVisibility(false);
    // Setting level to 'desktop' keeps the widget on the desktop behind all normal application windows
    // It will never pop over or obstruct open apps
    try {
      mainWindow.setLevel('desktop');
    } catch (e) {}
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  }

  mainWindow.loadURL('http://localhost:4173');

  // Open quietly in desktop background without popping over active windows
  mainWindow.once('ready-to-show', () => {
    mainWindow.showInactive();
  });

  // Save bounds on move/resize
  mainWindow.on('moved', () => saveBounds(mainWindow.getBounds()));
  mainWindow.on('resized', () => saveBounds(mainWindow.getBounds()));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let currentWindowMode = 'desktop'; // 'desktop' | 'normal' | 'always-on-top'

function applyWindowMode(mode) {
  currentWindowMode = mode;
  if (!mainWindow) return;

  if (mode === 'desktop') {
    mainWindow.setAlwaysOnTop(false);
    if (process.platform === 'darwin') {
      try {
        mainWindow.setLevel('desktop');
      } catch (e) {}
    }
  } else if (mode === 'always-on-top') {
    if (process.platform === 'darwin') {
      try {
        mainWindow.setLevel('normal');
      } catch (e) {}
    }
    mainWindow.setAlwaysOnTop(true, 'floating');
  } else {
    // normal
    if (process.platform === 'darwin') {
      try {
        mainWindow.setLevel('normal');
      } catch (e) {}
    }
    mainWindow.setAlwaysOnTop(false);
  }
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Team To do',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Pin to Desktop',
      type: 'radio',
      checked: currentWindowMode === 'desktop',
      click: () => applyWindowMode('desktop')
    },
    {
      label: 'Normal Window',
      type: 'radio',
      checked: currentWindowMode === 'normal',
      click: () => applyWindowMode('normal')
    },
    {
      label: 'Always on Top',
      type: 'radio',
      checked: currentWindowMode === 'always-on-top',
      click: () => applyWindowMode('always-on-top')
    },
    { type: 'separator' },
    {
      label: 'Show / Hide Widget',
      click: () => {
        if (!mainWindow) {
          createWidgetWindow();
        } else if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.showInactive();
        }
      }
    },
    {
      label: 'Reset Position to Top-Left',
      click: () => {
        if (mainWindow) {
          mainWindow.setPosition(50, 70);
          saveBounds(mainWindow.getBounds());
        }
      }
    },
    { type: 'separator' },
    {
      label: 'By Yahia Bin Zaman',
      click: () => {
        shell.openExternal('https://github.com/yahiabinzaman');
      }
    },
    {
      label: 'GitHub: yahiabinzaman/team-to-do',
      click: () => {
        shell.openExternal('https://github.com/yahiabinzaman/team-to-do');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function createSystemTray() {
  if (tray) return;

  try {
    let trayIcon;
    if (process.platform === 'win32') {
      trayIcon = nativeImage.createFromPath(path.join(__dirname, 'icon.ico')).resize({ width: 16, height: 16 });
    } else {
      trayIcon = nativeImage.createFromPath(path.join(__dirname, 'icon_512.png')).resize({ width: 18, height: 18 });
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('Team To-Do Widget');
    updateTrayMenu();

    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.showInactive();
        } else {
          mainWindow.showInactive();
        }
      }
    });
  } catch (err) {
    console.error('Tray initialization notice:', err);
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.showInactive();
    }
  });

  app.whenReady().then(() => {
    // On macOS: Set dock icon or hide dock icon for true desktop widget
    if (process.platform === 'darwin' && app.dock) {
      try {
        app.dock.setIcon(path.join(__dirname, 'icon_512.png'));
      } catch (e) {}
    }

    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: false
    });

    createWidgetWindow();
    createSystemTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWidgetWindow();
    });
  });
}

// Keep app alive
app.on('window-all-closed', (e) => {
  if (process.platform === 'darwin') {
    e.preventDefault();
  } else {
    // On Windows, keep in tray unless explicitly quit
    if (!app.isQuiting) {
      e.preventDefault();
    } else {
      app.quit();
    }
  }
});
