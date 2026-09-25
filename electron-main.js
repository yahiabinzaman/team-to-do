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
    fs.mkdirSync(path.dirname(BOUNDS_FILE), { recursive: true });
    fs.writeFileSync(BOUNDS_FILE, JSON.stringify(bounds, null, 2), 'utf-8');
  } catch (e) {}
}

function getAppIconPath() {
  if (process.platform === 'win32') {
    return path.join(__dirname, 'icon.ico');
  }
  return path.join(__dirname, 'icon_512.png');
}

async function ensureServerRunning() {
  try {
    const res = await fetch('http://localhost:4173/api/employees', { signal: AbortSignal.timeout(600) });
    if (res.ok) return;
  } catch (e) {}
  try {
    await import('./server.js');
  } catch (err) {
    console.log('[Server Startup Notice]:', err?.message || err);
  }
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

  // Auto-retry connection if server is still starting up
  mainWindow.webContents.on('did-fail-load', (event, errorCode) => {
    if (errorCode !== -3) { // -3 is ABORTED, ignore
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL('http://localhost:4173');
        }
      }, 800);
    }
  });

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

let aboutWindow = null;

function openAboutWindow() {
  if (aboutWindow) {
    aboutWindow.show();
    aboutWindow.focus();
    return;
  }

  let iconBase64 = '';
  try {
    iconBase64 = fs.readFileSync(path.join(__dirname, 'icon_512.png')).toString('base64');
  } catch (e) {}

  aboutWindow = new BrowserWindow({
    width: 280,
    height: 320,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    center: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
        color: #FFFFFF;
        user-select: none;
        -webkit-user-select: none;
      }
      .about-card {
        width: 100%;
        height: 100%;
        background: #1C1C1E;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 20px;
        padding: 20px 18px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        position: relative;
        -webkit-app-region: drag;
      }
      .close-btn {
        position: absolute;
        top: 14px;
        left: 14px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #FF5F56;
        border: none;
        cursor: pointer;
        -webkit-app-region: no-drag;
      }
      .close-btn:hover { background: #E0443E; }
      .app-icon {
        width: 64px;
        height: 64px;
        border-radius: 15px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
        margin-top: 2px;
        margin-bottom: 10px;
      }
      .app-title {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.3px;
        color: #FFFFFF;
        margin-bottom: 2px;
      }
      .app-version {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 10px;
      }
      .developer-block {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 8px 12px;
        width: 100%;
        margin-bottom: 10px;
        -webkit-app-region: no-drag;
      }
      .dev-label {
        font-size: 9.5px;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
      }
      .dev-name {
        font-size: 12.5px;
        font-weight: 600;
        color: #FFFFFF;
        text-decoration: none;
        display: inline-block;
        transition: color 0.2s;
        cursor: pointer;
      }
      .dev-name:hover {
        color: #0A84FF;
      }
      .btn-github {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #0A84FF;
        color: #FFFFFF;
        text-decoration: none;
        font-size: 11px;
        font-weight: 600;
        padding: 6px 14px;
        border-radius: 999px;
        transition: all 0.2s;
        -webkit-app-region: no-drag;
        box-shadow: 0 4px 10px rgba(10, 132, 255, 0.35);
        cursor: pointer;
      }
      .btn-github:hover {
        background: #0071E3;
        transform: translateY(-1px);
      }
      .copyright {
        font-size: 9px;
        color: rgba(255, 255, 255, 0.4);
        margin-top: 10px;
      }
    </style>
  </head>
  <body>
    <div class="about-card">
      <button class="close-btn" onclick="window.close()" title="Close"></button>
      <img class="app-icon" src="data:image/png;base64,${iconBase64}" alt="Team To do Icon" />
      <div class="app-title">Team To do</div>
      <div class="app-version">Version 1.0.0</div>
      
      <div class="developer-block">
        <div class="dev-label">Designed & Developed by</div>
        <a class="dev-name" href="https://github.com/yahiabinzaman" target="_blank">Yahia Bin Zaman ↗</a>
      </div>

      <a class="btn-github" href="https://github.com/yahiabinzaman/team-to-do" target="_blank">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        GitHub Repository
      </a>

      <div class="copyright">Copyright © 2026 Yahia Bin Zaman</div>
    </div>
  </body>
  </html>
  `;

  aboutWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  aboutWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    if (aboutWindow) {
      aboutWindow.close();
    }
    return { action: 'deny' };
  });

  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
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
      label: 'Reset Position',
      click: () => {
        if (mainWindow) {
          mainWindow.setPosition(50, 70);
          saveBounds(mainWindow.getBounds());
        }
      }
    },
    { type: 'separator' },
    {
      label: 'About Team To do',
      click: () => {
        openAboutWindow();
      }
    },
    {
      label: 'Quit Team To do',
      accelerator: 'CmdOrCtrl+Q',
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
      const templatePath = path.join(__dirname, 'trayTemplate.png');
      trayIcon = nativeImage.createFromPath(templatePath).resize({ width: 18, height: 18 });
      trayIcon.setTemplateImage(true);
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('Team To do');
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

  app.whenReady().then(async () => {
    // Windows App ID for native taskbar grouping & notifications
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.teamtodo.desktopwidget');
    }

    // Native macOS / OS About panel
    app.setAboutPanelOptions({
      applicationName: 'Team To do',
      applicationVersion: '1.0.0',
      version: '1.0.0',
      copyright: 'Copyright © 2026 Yahia Bin Zaman',
      credits: 'Designed & Developed by Yahia Bin Zaman',
      authors: ['Yahia Bin Zaman'],
      website: 'https://github.com/yahiabinzaman/team-to-do',
      iconPath: path.join(__dirname, 'icon_512.png')
    });

    // On macOS: Set dock icon
    if (process.platform === 'darwin' && app.dock) {
      try {
        app.dock.setIcon(path.join(__dirname, 'icon_512.png'));
      } catch (e) {}
    }

    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: false
    });

    // Ensure backend sync server is running
    await ensureServerRunning();

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
