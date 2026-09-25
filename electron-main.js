import { app, BrowserWindow, Tray, Menu, nativeImage, screen } from 'electron';
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

  // Hide traffic lights on macOS
  if (process.platform === 'darwin') {
    mainWindow.setWindowButtonVisibility(false);
  }

  mainWindow.loadURL('http://localhost:4173');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Save bounds on move/resize
  mainWindow.on('moved', () => saveBounds(mainWindow.getBounds()));
  mainWindow.on('resized', () => saveBounds(mainWindow.getBounds()));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

    const contextMenu = Menu.buildFromTemplate([
      {
        label: ' Team To-Do Widget',
        enabled: false
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
            mainWindow.show();
            mainWindow.focus();
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
        label: 'Quit',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
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
      mainWindow.show();
      mainWindow.focus();
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
