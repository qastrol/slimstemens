const { app, BrowserWindow, dialog, ipcMain, protocol } = require('electron');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { Readable } = require('stream');

app.setName('De Slimste Mens');
app.setAppUserModelId('nl.slimstemens.desktop');

protocol.registerSchemesAsPrivileged([{
  scheme: 'slimstemens-media',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true
  }
}]);

let hostWindow = null;
let displayWindow = null;
let mediaCacheDirectory = null;
let mediaCacheCleanupStarted = false;
const cachedMedia = new Map();
const mediaTypeExtensions = new Map([
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['video/ogg', '.ogv'],
  ['video/quicktime', '.mov'],
  ['video/x-m4v', '.m4v'],
  ['video/x-matroska', '.mkv'],
  ['video/x-msvideo', '.avi']
]);

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

ipcMain.handle('cache-quiz-media', async (event, bytes, mimeType) => {
  const isQuizWindow = [hostWindow, displayWindow].some((window) => (
    window && !window.isDestroyed() && window.webContents.id === event.sender.id
  ));
  if (!isQuizWindow) {
    throw new Error('Media mag alleen vanuit een quizvenster worden opgeslagen.');
  }
  if (!ArrayBuffer.isView(bytes) || bytes.BYTES_PER_ELEMENT !== 1 || bytes.byteLength === 0) {
    throw new Error('Ongeldige videodata voor de Electron-mediacache.');
  }
  if (bytes.byteLength > 512 * 1024 * 1024) {
    throw new Error('Videobestand is groter dan de maximale Electron-cachegrootte (512 MB).');
  }

  const extension = mediaTypeExtensions.get(mimeType);
  if (!extension) {
    throw new Error(`Niet-ondersteund mediatype voor de Electron-cache: ${mimeType}`);
  }

  if (!mediaCacheDirectory) {
    mediaCacheDirectory = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'slimstemens-media-'));
  }

  const id = randomUUID();
  const fileName = `${id}${extension}`;
  const filePath = path.join(mediaCacheDirectory, fileName);
  await fs.promises.writeFile(filePath, bytes);
  cachedMedia.set(fileName, { filePath, mimeType });

  return `slimstemens-media://media/${fileName}`;
});

function registerMediaProtocol() {
  protocol.handle('slimstemens-media', async (request) => {
    const url = new URL(request.url);
    const fileName = path.basename(url.pathname);
    const media = url.hostname === 'media' ? cachedMedia.get(fileName) : null;
    if (!media) {
      return new Response('Media niet gevonden.', { status: 404 });
    }

    let stat;
    try {
      stat = await fs.promises.stat(media.filePath);
    } catch (error) {
      console.error('Gecachede video kon niet worden gelezen:', error);
      return new Response('Media niet beschikbaar.', { status: 500 });
    }

    const headers = {
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range',
      'Content-Type': media.mimeType
    };
    const rangeHeader = request.headers.get('range');
    let start = 0;
    let end = stat.size - 1;
    let status = 200;

    if (rangeHeader) {
      const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
      if (!match || (!match[1] && !match[2])) {
        return new Response(null, {
          status: 416,
          headers: { ...headers, 'Content-Range': `bytes */${stat.size}` }
        });
      }

      if (!match[1]) {
        const suffixLength = Number(match[2]);
        if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
          return new Response(null, {
            status: 416,
            headers: { ...headers, 'Content-Range': `bytes */${stat.size}` }
          });
        }
        start = Math.max(0, stat.size - suffixLength);
      } else {
        start = Number(match[1]);
        if (!Number.isSafeInteger(start) || start >= stat.size) {
          return new Response(null, {
            status: 416,
            headers: { ...headers, 'Content-Range': `bytes */${stat.size}` }
          });
        }
      }

      if (match[2] && match[1]) {
        end = Number(match[2]);
        if (!Number.isSafeInteger(end) || end < start) {
          return new Response(null, {
            status: 416,
            headers: { ...headers, 'Content-Range': `bytes */${stat.size}` }
          });
        }
        end = Math.min(end, stat.size - 1);
      }

      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }

    headers['Content-Length'] = String(end - start + 1);
    if (request.method === 'HEAD') {
      return new Response(null, { status, headers });
    }

    const fileStream = fs.createReadStream(media.filePath, { start, end });
    fileStream.on('error', (error) => {
      console.error('Fout tijdens streamen van gecachede video:', error);
    });
    return new Response(Readable.toWeb(fileStream), { status, headers });
  });
}

function createWindows() {
  const windowIcon = path.join(__dirname, 'assets', 'slimstemens.ico');
  const preloadPath = path.join(__dirname, 'js', 'electron-bridge.js');

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



  displayWindow.loadFile(path.join(__dirname, 'display.html'));
    hostWindow.loadFile(path.join(__dirname, 'index.html'));


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

app.on('will-quit', (event) => {
  if (!mediaCacheDirectory || mediaCacheCleanupStarted) {
    return;
  }

  event.preventDefault();
  mediaCacheCleanupStarted = true;
  fs.promises.rm(mediaCacheDirectory, { recursive: true, force: true })
    .catch((error) => {
      console.error('Tijdelijke Electron-mediacache kon niet worden verwijderd:', error);
    })
    .finally(() => app.quit());
});

app.whenReady().then(() => {
  registerMediaProtocol();
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
