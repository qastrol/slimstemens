const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

let hostWindow = null;
let displayWindow = null;

ipcMain.on('quiz-message', (event, message) => {
  [hostWindow, displayWindow].forEach((window) => {
    if (!window || window.webContents.isDestroyed()) return;
    if (window.webContents.id === event.sender.id) return;

    window.webContents.send('quiz-message', message);
  });
});

function createWindows() {
  const windowIcon = path.join(__dirname, 'assets', 'slimstemens.ico');
  const preloadPath = path.join(__dirname, 'js', 'electron-bridge.js');

  hostWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'De Slimste Mens - Host',
    autoHideMenuBar: true,
    icon: windowIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath
    }
  });

  displayWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'De Slimste Mens - Display',
    autoHideMenuBar: true,
    icon: windowIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath
    }
  });

  hostWindow.loadFile(path.join(__dirname, 'index.html'));
  displayWindow.loadFile(path.join(__dirname, 'display.html'));

  hostWindow.on('closed', () => {
    hostWindow = null;
    if (displayWindow) displayWindow.close();
  });

  displayWindow.on('closed', () => {
    displayWindow = null;
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.whenReady().then(() => {
  createWindows();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindows();
  }
});
