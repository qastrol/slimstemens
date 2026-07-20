const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

let hostWindow = null;
let displayWindow = null;

// Electron-only media performance hints (heeft geen effect op webserver-versie).
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

function applyWindowChromeDefaults(window) {
  if (!window || window.isDestroyed()) {
    return;
  }

  window.setAutoHideMenuBar(true);
  window.setMenuBarVisibility(false);
  window.removeMenu();
}

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
      backgroundThrottling: false,
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
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath
    }
  });

  hostWindow.loadFile(path.join(__dirname, 'index.html'));
  displayWindow.loadFile(path.join(__dirname, 'display.html'));

  applyWindowChromeDefaults(hostWindow);
  applyWindowChromeDefaults(displayWindow);

  displayWindow.on('enter-full-screen', () => {
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.setMinimizable(false);
    }
  });

  // Sta minimaliseren weer toe zodra Fullscreen verlaten wordt
  displayWindow.on('leave-full-screen', () => {
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.setMinimizable(true);
    }
  });

  // Schakel F11 in/uit toggle in op het Display-venster
  displayWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      const isFull = displayWindow.isFullScreen();
      displayWindow.setFullScreen(!isFull);
      event.preventDefault(); // Voorkom standaard browserafhandeling
    }
  });

  hostWindow.webContents.setWindowOpenHandler(() => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        menuBarVisible: false
      }
    };
  });

  hostWindow.webContents.on('did-create-window', (createdWindow) => {
    applyWindowChromeDefaults(createdWindow);
  });

  hostWindow.on('closed', () => {
    const siblingDisplay = displayWindow;
    hostWindow = null;
    if (siblingDisplay && !siblingDisplay.isDestroyed()) {
      siblingDisplay.close();
    }
  });

  displayWindow.on('closed', () => {
    const siblingHost = hostWindow;
    displayWindow = null;
    if (siblingHost && !siblingHost.isDestroyed()) {
      siblingHost.close();
    }
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
