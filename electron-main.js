import { app, BrowserWindow, Tray, Menu, nativeImage, screen, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

//  Native macOS: Accessory activation policy & hide dock so no dock icon ever appears
if (process.platform === 'darwin') {
  try {
    if (typeof app.setActivationPolicy === 'function') {
      app.setActivationPolicy('accessory');
    }
  } catch (e) {}
  if (app.dock) {
    try {
      app.dock.hide();
    } catch (e) {}
  }
}

// Handle system shutdown, restart, and quit signals gracefully without blocking macOS
app.on('before-quit', () => {
  app.isQuiting = true;
});

process.on('SIGTERM', () => {
  app.isQuiting = true;
  app.exit(0);
});

process.on('SIGINT', () => {
  app.isQuiting = true;
  app.exit(0);
});

// Hardware acceleration & performance switches for Windows & macOS
app.commandLine.appendSwitch('enable-smooth-scrolling');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// Prevent crash on port in-use race condition
process.on('uncaughtException', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.log('[Main Process] Port 4973 is already in use. Connected to active server.');
    return;
  }
  console.error('[Main Process Error]:', err);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let tray = null;
let currentWindowMode = 'normal'; // 'desktop' | 'normal' | 'always-on-top'

function getBoundsFilePath() {
  try {
    const userDir = app.getPath('userData');
    return path.join(userDir, 'bounds.json');
  } catch (e) {
    return path.join(__dirname, 'data', 'bounds.json');
  }
}

function getSavedBounds() {
  try {
    const file = getBoundsFilePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {}
  return { x: 40, y: 50, width: 310, height: 420, mode: 'normal' };
}

function saveBounds(bounds) {
  try {
    const file = getBoundsFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const current = getSavedBounds();
    const dataToSave = {
      ...current,
      ...bounds,
      mode: currentWindowMode
    };
    fs.writeFileSync(file, JSON.stringify(dataToSave, null, 2), 'utf-8');
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
    process.env.APPDATA_DIR = app.getPath('userData');
  } catch (e) {}
  try {
    const res = await fetch('http://localhost:4973/api/employees', { signal: AbortSignal.timeout(600) });
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

  // On macOS: Hide dock immediately
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.hide();
    } catch (e) {}
  }

  const saved = getSavedBounds();
  const iconPath = getAppIconPath();

  mainWindow = new BrowserWindow({
    title: 'Team To do',
    width: saved.width || 310,
    height: saved.height || 420,
    x: saved.x || 40,
    y: saved.y || 50,
    minWidth: 260,
    minHeight: 300,
    maxWidth: 900,
    maxHeight: 1000,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    alwaysOnTop: false,
    show: false,
    skipTaskbar: true,
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
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    if (mainWindow.setHiddenInMissionControl) {
      mainWindow.setHiddenInMissionControl(true);
    }
  }

  // Restore saved window mode
  if (saved.mode) {
    applyWindowMode(saved.mode);
  }

  mainWindow.loadURL('http://localhost:4973');

  // Auto-retry connection if server is still starting up
  mainWindow.webContents.on('did-fail-load', (event, errorCode) => {
    if (errorCode !== -3) { // -3 is ABORTED, ignore
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL('http://localhost:4973');
        }
      }, 800);
    }
  });

  // Prevent accidental zoom changes via Ctrl + +/- or Ctrl + MouseWheel on Windows
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && (input.key === '+' || input.key === '-' || input.key === '=' || input.key === '0')) {
      event.preventDefault();
    }
  });

  // Open window smoothly when ready without showing Dock icon
  mainWindow.once('ready-to-show', () => {
    mainWindow.showInactive();
    if (process.platform === 'darwin' && app.dock) {
      try { app.dock.hide(); } catch (e) {}
    }
  });

  // Save bounds on move/resize
  mainWindow.on('moved', () => saveBounds(mainWindow.getBounds()));
  mainWindow.on('resized', () => saveBounds(mainWindow.getBounds()));

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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

  const isVisible = mainWindow && mainWindow.isVisible();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Team To do • Yahia Bin Zaman',
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
      label: isVisible ? 'Hide Widget' : 'Show Widget',
      click: () => {
        if (!mainWindow) {
          createWidgetWindow();
        } else if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.showInactive();
          if (process.platform === 'darwin' && app.dock) {
            try { app.dock.hide(); } catch (e) {}
          }
        }
        updateTrayMenu();
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
      label: 'GitHub Repository ↗',
      click: () => {
        shell.openExternal('https://github.com/yahiabinzaman/team-to-do');
      }
    },
    {
      label: 'About Team To do',
      click: () => {
        openAboutWindow();
      }
    },
    { type: 'separator' },
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
      trayIcon = nativeImage.createFromPath(templatePath);
      trayIcon.setTemplateImage(true);
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('Team To do');
    updateTrayMenu();

    tray.on('click', () => {
      tray.popUpContextMenu();
    });
    tray.on('right-click', () => {
      tray.popUpContextMenu();
    });
  } catch (err) {
    console.error('Tray initialization error:', err);
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
    } else {
      createWidgetWindow();
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

    // On macOS: Set accessory policy and hide dock icon
    if (process.platform === 'darwin') {
      try {
        if (typeof app.setActivationPolicy === 'function') {
          app.setActivationPolicy('accessory');
        }
      } catch (e) {}
      if (app.dock) {
        try {
          app.dock.hide();
        } catch (e) {}
      }
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
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWidgetWindow();
      } else {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
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
