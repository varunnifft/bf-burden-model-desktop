// Desktop shell for BF Model (3.5): serves the bundled www/ folder offline in one window.
const { app, BrowserWindow, Menu, protocol, net, shell, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// A GUI app on Windows may have no usable stderr; printing a Node warning there must not crash the app
process.removeAllListeners('warning');

const WWW = path.join(__dirname, 'www');
const HOME = 'app://bf/index.html';

// A fixed app:// origin keeps saved inputs (localStorage) stable between runs and updates
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 420, minHeight: 500,
    title: 'BF Model', backgroundColor: '#15171a',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.loadURL(HOME);

  // Only the bundled pages open inside the app; any web link goes to the system browser
  const external = (url) => !url.startsWith('app://bf/');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (external(url) && /^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!external(url)) return;
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });
  // Excel / CSV made by the pages (input template, data sheet, exports): ask where to save, Downloads by default
  win.webContents.session.on('will-download', (e, item) => {
    item.setSaveDialogOptions({ title: 'Save file', defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
  });
  // Mouse back/forward buttons (Windows)
  win.on('app-command', (e, cmd) => {
    if (cmd === 'browser-backward' && win.webContents.navigationHistory.canGoBack()) win.webContents.navigationHistory.goBack();
    if (cmd === 'browser-forward' && win.webContents.navigationHistory.canGoForward()) win.webContents.navigationHistory.goForward();
  });
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const nav = () => win && win.webContents.navigationHistory;
  const template = [
    ...(mac ? [{ role: 'appMenu' }] : [{ label: 'File', submenu: [{ role: 'quit', label: 'Exit' }] }]),
    { role: 'editMenu' },
    { label: 'View', submenu: [
      { label: 'Home', accelerator: mac ? 'Cmd+Shift+H' : 'Alt+Home', click: () => win && win.loadURL(HOME) },
      { label: 'Data input', accelerator: 'CmdOrCtrl+0', click: () => win && win.loadURL('app://bf/data-input.html') },
      { label: 'Burden batch wise output chemistry', accelerator: 'CmdOrCtrl+1', click: () => win && win.loadURL('app://bf/chemistry.html') },
      { label: 'Burden calculator', accelerator: 'CmdOrCtrl+2', click: () => win && win.loadURL('app://bf/calculator.html') },
      { label: '3D distribution', accelerator: 'CmdOrCtrl+3', click: () => win && win.loadURL('app://bf/simulator.html') },
      { label: 'Report', accelerator: 'CmdOrCtrl+4', click: () => win && win.loadURL('app://bf/report.html') },
      { label: 'Furnace 3D view', accelerator: 'CmdOrCtrl+5', click: () => win && win.loadURL('app://bf/furnace-inside.html') },
      { type: 'separator' },
      { label: 'Back', accelerator: mac ? 'Cmd+[' : 'Alt+Left', click: () => nav() && nav().canGoBack() && nav().goBack() },
      { label: 'Forward', accelerator: mac ? 'Cmd+]' : 'Alt+Right', click: () => nav() && nav().canGoForward() && nav().goForward() },
      { role: 'reload' },
      { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [
      { label: 'About BF Model', click: () => app.showAboutPanel() }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

  app.whenReady().then(() => {
    app.setAboutPanelOptions({
      applicationName: 'BF Model', applicationVersion: app.getVersion(),
      copyright: 'Blast furnace burden chemistry, burden distribution and furnace 3D view. Works offline.'
    });
    // Serve www/ files; refuse anything outside it
    protocol.handle('app', (req) => {
      const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
      const file = path.normalize(path.join(WWW, rel || 'index.html'));
      if (!file.startsWith(WWW + path.sep)) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });
    // "Load from a link" on the import cards: download here (no browser CORS limit), only for the app's own pages
    ipcMain.handle('bf-fetch-url', async (e, url) => {
      try {
        if (!e.senderFrame || !String(e.senderFrame.url).startsWith('app://bf/')) throw new Error('not allowed');
        const u = new URL(String(url));
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('only http and https links');
        const r = await net.fetch(u.toString(), { redirect: 'follow' });
        if (!r.ok) throw new Error('the server answered HTTP ' + r.status);
        const cd = r.headers.get('content-disposition') || '', m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
        const data = new Uint8Array(await r.arrayBuffer());
        if (data.length > 30 * 1024 * 1024) throw new Error('the file is larger than 30 MB');
        return { ok: true, data, name: m ? decodeURIComponent(m[1]) : '' };
      } catch (err) {
        const msg = String(err && err.message || err);
        return { ok: false, error: /ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED/.test(msg) ? 'no internet connection' : msg };
      }
    });
    // Sign-up and login (www/auth-api.js): POST to the registration server, only https and only from the app's own pages
    ipcMain.handle('bf-post', async (e, url, body) => {
      try {
        if (!e.senderFrame || !String(e.senderFrame.url).startsWith('app://bf/')) throw new Error('not allowed');
        const u = new URL(String(url));
        if (u.protocol !== 'https:') throw new Error('only https links');
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 45000);
        try {
          const r = await net.fetch(u.toString(), { method: 'POST', body: String(body), redirect: 'follow', signal: ctl.signal,
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
          if (!r.ok) throw new Error('the server answered HTTP ' + r.status);
          return { ok: true, text: await r.text() };
        } finally { clearTimeout(t); }
      } catch (err) {
        const msg = String(err && err.message || err);
        return { ok: false, error: /ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|abort/i.test(msg) ? 'no internet connection' : msg };
      }
    });
    // Report and Furnace 3D view: print the page to an A4 PDF and save it where the user picks (Downloads by default)
    ipcMain.handle('bf-save-pdf', async (e, name) => {
      try {
        if (!e.senderFrame || !/^app:\/\/bf\/(report|furnace-inside)\.html/.test(String(e.senderFrame.url))) throw new Error('not allowed');
        const file = String(name).replace(/[^\w.-]+/g, '_').replace(/^\.+/, '') || 'BF_Model_Report.pdf';
        const pick = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), {
          title: 'Save as PDF', defaultPath: path.join(app.getPath('downloads'), file), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
        if (pick.canceled || !pick.filePath) return { ok: false };
        const data = await e.sender.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true });
        await fs.promises.writeFile(pick.filePath, data);
        shell.showItemInFolder(pick.filePath);
        return { ok: true, path: pick.filePath };
      } catch (err) {
        return { ok: false, error: String(err && err.message || err) };
      }
    });
    buildMenu();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
