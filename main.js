const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

// 远程数据地址：创建 GitHub 仓库并开启 Pages 后填入，例如
// https://<用户名>.github.io/<仓库名>/data/crosshairs.json
// 留空则只使用内置数据
const REMOTE_DATA_URL = '';

function readBundledData() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'crosshairs.json'), 'utf8'));
  } catch (e) {
    return { community: [], pros: [], updatedAt: null };
  }
}

function fetchRemoteData(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'CrosshairCollector/1.0' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(6000, () => { req.destroy(); resolve(null); });
  });
}

ipcMain.handle('get-data', async () => {
  const bundled = readBundledData();
  if (!REMOTE_DATA_URL) return bundled;
  const remote = await fetchRemoteData(REMOTE_DATA_URL);
  if (remote && Array.isArray(remote.community) && Array.isArray(remote.pros)) return remote;
  return bundled;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 860,
    minHeight: 600,
    backgroundColor: '#FFF6E5',
    autoHideMenuBar: true,
    title: '无畏契约准星收集',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
