// JPCS HUB desktop app (Windows). Opens the live JPCS HUB web portal in its own
// window, so the data, features and updates are the same as the website.
const { app, BrowserWindow, shell, session, Menu } = require('electron');
const path = require('path');

const PORTAL_URL = process.env.JPCS_HUB_URL || 'https://keaneleekeane.github.io/jpcs-hub/';
const PORTAL_ORIGIN = new URL(PORTAL_URL).origin;

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'JPCS HUB',
    backgroundColor: '#17295a',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.loadURL(PORTAL_URL);

  // No internet: show a friendly page with a Retry button.
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: PORTAL_URL } });
  });

  // Links to other sites (uploaded files, receipts) open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(PORTAL_ORIGIN)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(PORTAL_ORIGIN) && !url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); }
  });
}

app.whenReady().then(() => {
  // Camera and microphone for video calls, only for the JPCS HUB portal.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const origin = (details.requestingUrl || wc.getURL() || '').startsWith(PORTAL_ORIGIN);
    callback(origin && ['media', 'notifications', 'fullscreen', 'clipboard-sanitized-write'].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission, requestingOrigin) =>
    requestingOrigin === PORTAL_ORIGIN && ['media', 'notifications', 'fullscreen'].includes(permission));

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'JPCS HUB', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  ]));

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// Only one JPCS HUB window at a time.
if (!app.requestSingleInstanceLock()) app.quit();
else app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
