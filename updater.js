import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const GITHUB_OWNER = 'yahiabinzaman';
const GITHUB_REPO = 'team-to-do';
const RAW_PKG_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/package.json`;
const MAIN_ZIP_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/archive/refs/heads/main.zip`;
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const RELEASES_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

const PRESERVED_ROOT_ENTRIES = new Set([
  'node_modules',
  '.env',
  '.env.local',
  '.git',
  'data',
  'dist',
  'build',
  '.DS_Store'
]);

export function compareSemver(a, b) {
  const parse = (v) => {
    const clean = String(v || '0.0.0').trim().replace(/^v/i, '');
    const [core, pre = ''] = clean.split('-');
    const parts = core.split('.').map(n => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return { parts: parts.slice(0, 3), pre };
  };
  const va = parse(a);
  const vb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (va.parts[i] > vb.parts[i]) return 1;
    if (va.parts[i] < vb.parts[i]) return -1;
  }
  if (!va.pre && vb.pre) return 1;
  if (va.pre && !vb.pre) return -1;
  if (va.pre !== vb.pre) return va.pre > vb.pre ? 1 : -1;
  return 0;
}

export function copyUpdatedTree(srcDir, destDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (PRESERVED_ROOT_ENTRIES.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copySubtree(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copySubtree(srcDir, destDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copySubtree(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function extractZip(zipPath, extractDir) {
  fs.mkdirSync(extractDir, { recursive: true });
  if (process.platform === 'win32') {
    const escapedZip = zipPath.replace(/'/g, "''");
    const escapedDest = extractDir.replace(/'/g, "''");
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDest}' -Force`
      ],
      { timeout: 60000 }
    );
  } else {
    await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', extractDir], { timeout: 60000 });
  }
}

async function runNpmInstall(appDir) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await execFileAsync(
    npmCmd,
    ['install', '--omit=dev', '--no-audit', '--no-fund'],
    {
      cwd: appDir,
      shell: process.platform === 'win32',
      timeout: 180000
    }
  );
}

export function createAutoUpdater({ app, shell, Notification, appDir, getVersion, stopServer, onStatusChange }) {
  let state = {
    status: 'idle', // 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date'
    version: null,
    downloadUrl: null
  };
  let busy = false;
  let electronAutoUpdater = null;
  let electronUpdaterWired = false;

  const setState = (patch) => {
    state = { ...state, ...patch };
    if (typeof onStatusChange === 'function') {
      onStatusChange({ ...state });
    }
  };

  const notify = (title, body) => {
    try {
      if (Notification && Notification.isSupported()) {
        new Notification({ title, body, silent: true }).show();
      }
    } catch (e) {}
  };

  const wireElectronUpdater = () => {
    if (electronUpdaterWired) return electronAutoUpdater;
    electronUpdaterWired = true;
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.logger = null;

      autoUpdater.on('checking-for-update', () => {
        setState({ status: 'checking' });
      });

      autoUpdater.on('update-available', (info) => {
        const ver = info?.version || '';
        setState({ status: 'downloading', version: ver });
        notify('Team To do Update', `Downloading v${ver} in the background...`);
      });

      autoUpdater.on('update-not-available', () => {
        const wasManual = state._manual;
        setState({ status: 'up-to-date', version: null, _manual: false });
        if (wasManual) {
          notify('Team To do', `You are already on the latest version (v${getVersion()}).`);
        }
      });

      autoUpdater.on('update-downloaded', async (info) => {
        const ver = info?.version || state.version || '';
        setState({ status: 'ready', version: ver });
        notify('Team To do Updated', `v${ver} downloaded. Restarting automatically...`);
        setTimeout(async () => {
          try { await stopServer?.(); } catch (e) {}
          app.isQuiting = true;
          autoUpdater.quitAndInstall(true, true);
        }, 1800);
      });

      autoUpdater.on('error', (err) => {
        console.log('[Updater Notice]:', err?.message || err);
        const wasManual = state._manual;
        setState({ status: 'idle', _manual: false });
        if (wasManual) {
          notify('Team To do Update', 'Could not complete automatic update check right now.');
        }
      });

      electronAutoUpdater = autoUpdater;
    } catch (e) {
      console.log('[Updater] electron-updater unavailable:', e?.message || e);
    }
    return electronAutoUpdater;
  };

  async function runSourceUpdate(isManual) {
    setState({ status: 'checking' });
    const res = await fetch(`${RAW_PKG_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remotePkg = await res.json();
    const localVer = getVersion();

    if (compareSemver(remotePkg.version, localVer) <= 0) {
      setState({ status: 'up-to-date', version: null });
      if (isManual) {
        notify('Team To do', `You are already on the latest version (v${localVer}).`);
      }
      return;
    }

    setState({ status: 'downloading', version: remotePkg.version });
    notify('Team To do Update', `Updating from v${localVer} to v${remotePkg.version}...`);

    const zipRes = await fetch(MAIN_ZIP_URL, { signal: AbortSignal.timeout(60000) });
    if (!zipRes.ok) throw new Error(`Archive download HTTP ${zipRes.status}`);
    const zipBuffer = Buffer.from(await zipRes.arrayBuffer());

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'team-todo-upd-'));
    const zipPath = path.join(tmpRoot, 'update.zip');
    const extractDir = path.join(tmpRoot, 'extracted');

    try {
      fs.writeFileSync(zipPath, zipBuffer);
      await extractZip(zipPath, extractDir);

      const candidates = fs.readdirSync(extractDir);
      const repoDirName = candidates.find(name =>
        fs.existsSync(path.join(extractDir, name, 'package.json'))
      );
      if (!repoDirName) throw new Error('Extracted package.json not found');

      const srcRoot = path.join(extractDir, repoDirName);
      const localPkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf-8'));
      const depsChanged =
        JSON.stringify(remotePkg.dependencies || {}) !== JSON.stringify(localPkg.dependencies || {});

      copyUpdatedTree(srcRoot, appDir);

      if (depsChanged) {
        await runNpmInstall(appDir);
      }

      setState({ status: 'ready', version: remotePkg.version });
      notify('Team To do Updated', `Updated to v${remotePkg.version}. Restarting widget...`);

      setTimeout(async () => {
        try { await stopServer?.(); } catch (e) {}
        app.isQuiting = true;
        const cleanArgs = process.argv.slice(1).filter(a => a !== '--relaunched');
        cleanArgs.push('--relaunched');
        app.relaunch({ args: cleanArgs });
        app.exit(0);
      }, 900);
    } finally {
      try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {}
    }
  }

  async function runReleaseNotifyCheck(isManual) {
    setState({ status: 'checking' });
    let latestVersion = null;
    let downloadUrl = RELEASES_PAGE_URL;

    try {
      const relRes = await fetch(RELEASES_API_URL, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(8000)
      });
      if (relRes.ok) {
        const rel = await relRes.json();
        latestVersion = String(rel.tag_name || rel.name || '').replace(/^v/i, '');
        const assets = Array.isArray(rel.assets) ? rel.assets : [];
        const matchAsset = process.platform === 'darwin'
          ? assets.find(a => a.name.endsWith('.dmg'))
          : assets.find(a => a.name.toLowerCase().includes('portable') && a.name.endsWith('.exe'))
            || assets.find(a => a.name.endsWith('.exe'));
        if (matchAsset?.browser_download_url) downloadUrl = matchAsset.browser_download_url;
        else if (rel.html_url) downloadUrl = rel.html_url;
      }
    } catch (e) {}

    if (!latestVersion) {
      const pkgRes = await fetch(`${RAW_PKG_URL}?t=${Date.now()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000)
      });
      if (pkgRes.ok) {
        const pkg = await pkgRes.json();
        latestVersion = pkg.version;
      }
    }

    const localVer = getVersion();
    if (latestVersion && compareSemver(latestVersion, localVer) > 0) {
      setState({ status: 'available', version: latestVersion, downloadUrl });
      notify('Team To do Update Available', `v${latestVersion} is available. Click the tray icon to update.`);
    } else {
      setState({ status: 'up-to-date', version: null, downloadUrl: null });
      if (isManual) {
        notify('Team To do', `You are already on the latest version (v${localVer}).`);
      }
    }
  }

  async function checkForUpdates(isManual = false) {
    if (busy) return;
    busy = true;
    try {
      const isPortableWin = process.platform === 'win32' && !!process.env.PORTABLE_EXECUTABLE_DIR;
      if (app.isPackaged && process.platform === 'win32' && !isPortableWin) {
        const updater = wireElectronUpdater();
        if (updater) {
          setState({ _manual: isManual });
          await updater.checkForUpdates();
          return;
        }
      }

      if (!app.isPackaged) {
        await runSourceUpdate(isManual);
      } else {
        await runReleaseNotifyCheck(isManual);
      }
    } catch (err) {
      console.log('[Updater Notice]:', err?.message || err);
      setState({ status: 'idle' });
      if (isManual) {
        notify('Team To do Update', 'Unable to check for updates right now.');
      }
    } finally {
      busy = false;
    }
  }

  function applyPendingUpdate() {
    if (state.status === 'ready' && electronAutoUpdater) {
      Promise.resolve(stopServer?.()).finally(() => {
        app.isQuiting = true;
        electronAutoUpdater.quitAndInstall(true, true);
      });
      return;
    }
    if (state.downloadUrl) {
      shell.openExternal(state.downloadUrl);
    }
  }

  function startSchedule() {
    setTimeout(() => checkForUpdates(false), 5000);
    setInterval(() => checkForUpdates(false), 30 * 60 * 1000);
  }

  return {
    getState: () => ({ ...state }),
    checkForUpdates,
    applyPendingUpdate,
    startSchedule
  };
}
