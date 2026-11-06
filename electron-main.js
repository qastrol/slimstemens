const { app, BrowserWindow, dialog, ipcMain, protocol } = require('electron');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const yauzl = require('yauzl');

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
let mediaCacheDirectoryPromise = null;
let mediaCacheCleanupStarted = false;
const cachedMedia = new Map();
const mediaUploads = new Map();
const zipImports = new Map();
const activeConfigMediaFiles = new Set();
const retiredConfigMediaFiles = new Set();
let gameMediaInUse = false;
const MAX_MEDIA_UPLOAD_SIZE = 1024 * 1024 * 1024;
const MAX_MEDIA_UPLOAD_CHUNK_SIZE = 1024 * 1024;
const MAX_ZIP_ENTRY_COUNT = 50000;
const MAX_CONFIG_JSON_SIZE = 16 * 1024 * 1024;
const MAX_CONFIG_MEDIA_IMPORT_SIZE = 2 * MAX_MEDIA_UPLOAD_SIZE;
let activeZipMediaExtractions = 0;
const zipMediaExtractionQueue = [];
const mediaTypeExtensions = new Map([
  ['audio/mpeg', '.mp3'],
  ['audio/wav', '.wav'],
  ['audio/ogg', '.ogg'],
  ['audio/mp4', '.m4a'],
  ['audio/aac', '.aac'],
  ['audio/flac', '.flac'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['video/ogg', '.ogv'],
  ['video/quicktime', '.mov'],
  ['video/x-m4v', '.m4v'],
  ['video/x-matroska', '.mkv'],
  ['video/x-msvideo', '.avi'],
  ['application/octet-stream', '.bin']
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

function assertQuizWindow(senderId) {
  const isQuizWindow = [hostWindow, displayWindow].some((window) => (
    window && !window.isDestroyed() && window.webContents.id === senderId
  ));
  if (!isQuizWindow) {
    throw new Error('Media mag alleen vanuit een quizvenster worden opgeslagen.');
  }
}

function acquireZipMediaExtractionSlot() {
  return new Promise((resolve) => {
    zipMediaExtractionQueue.push(resolve);
    releaseZipMediaExtractionSlots();
  });
}

function releaseZipMediaExtractionSlots() {
  const maxConcurrentExtractions = gameMediaInUse ? 1 : 2;
  while (
    activeZipMediaExtractions < maxConcurrentExtractions &&
    zipMediaExtractionQueue.length > 0
  ) {
    activeZipMediaExtractions += 1;
    zipMediaExtractionQueue.shift()();
  }
}

function releaseZipMediaExtractionSlot() {
  activeZipMediaExtractions -= 1;
  releaseZipMediaExtractionSlots();
}

async function ensureMediaCacheDirectory() {
  if (!mediaCacheDirectory) {
    if (!mediaCacheDirectoryPromise) {
      mediaCacheDirectoryPromise = fs.promises.mkdtemp(
        path.join(app.getPath('temp'), 'slimstemens-media-')
      );
    }
    const pendingDirectory = mediaCacheDirectoryPromise;
    try {
      mediaCacheDirectory = await pendingDirectory;
    } catch (error) {
      if (mediaCacheDirectoryPromise === pendingDirectory) {
        mediaCacheDirectoryPromise = null;
      }
      throw error;
    }
  }
  return mediaCacheDirectory;
}

async function discardMediaUpload(uploadId, upload) {
  if (mediaUploads.get(uploadId) === upload) {
    mediaUploads.delete(uploadId);
  }
  if (!upload.stream.destroyed) {
    upload.stream.destroy();
  }
  if (!upload.stream.closed) {
    await new Promise((resolve) => upload.stream.once('close', resolve));
  }
  await fs.promises.rm(upload.filePath, { force: true });
}

async function createMediaUpload(senderId, kind, mimeType, extension) {
  const uploadId = randomUUID();
  const fileName = `${uploadId}${extension}`;
  const filePath = path.join(await ensureMediaCacheDirectory(), fileName);
  const stream = fs.createWriteStream(filePath, { flags: 'wx' });
  const upload = { senderId, kind, fileName, filePath, mimeType, stream, size: 0 };
  stream.on('error', (error) => {
    upload.error = error;
  });
  mediaUploads.set(uploadId, upload);
  try {
    await new Promise((resolve, reject) => {
      stream.once('open', resolve);
      stream.once('error', reject);
    });
  } catch (error) {
    await discardMediaUpload(uploadId, upload);
    throw error;
  }
  return uploadId;
}

async function writeMediaUploadChunk(senderId, uploadId, bytes, kind) {
  const upload = mediaUploads.get(uploadId);
  if (!upload || upload.senderId !== senderId || upload.kind !== kind) {
    throw new Error('De Electron-upload bestaat niet of hoort bij een ander venster.');
  }
  if (!ArrayBuffer.isView(bytes) || bytes.BYTES_PER_ELEMENT !== 1 ||
      bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_UPLOAD_CHUNK_SIZE) {
    await discardMediaUpload(uploadId, upload);
    throw new Error('Ongeldig of te groot uploadblok voor de Electron-cache.');
  }
  if (upload.size + bytes.byteLength > MAX_MEDIA_UPLOAD_SIZE) {
    await discardMediaUpload(uploadId, upload);
    throw new Error('Bestand is groter dan de maximale Electron-uploadgrootte (1 GB).');
  }
  if (upload.error) {
    await discardMediaUpload(uploadId, upload);
    throw upload.error;
  }

  try {
    await new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      upload.stream.once('error', onError);
      upload.stream.write(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), (error) => {
        upload.stream.removeListener('error', onError);
        if (error) reject(error);
        else resolve();
      });
    });
    upload.size += bytes.byteLength;
    return upload.size;
  } catch (error) {
    await discardMediaUpload(uploadId, upload);
    throw error;
  }
}

async function finishMediaUpload(uploadId, upload) {
  if (upload.size === 0) {
    await discardMediaUpload(uploadId, upload);
    throw new Error('Leeg bestand kan niet in de Electron-cache worden opgeslagen.');
  }
  if (upload.error) {
    await discardMediaUpload(uploadId, upload);
    throw upload.error;
  }
  try {
    await new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      upload.stream.once('error', onError);
      upload.stream.end(() => {
        upload.stream.removeListener('error', onError);
        resolve();
      });
    });
    mediaUploads.delete(uploadId);
  } catch (error) {
    await discardMediaUpload(uploadId, upload);
    throw error;
  }
}

function normalizeZipEntryName(name) {
  return name.replace(/\\/g, '/').replace(/^\/+/, '');
}

function selectZipConfigEntry(entries) {
  const files = entries.filter((entry) => !entry.fileName.endsWith('/'));
  return files.find((entry) => normalizeZipEntryName(entry.fileName).toLowerCase() === 'game-config.json') ||
    files.find((entry) => normalizeZipEntryName(entry.fileName).toLowerCase().endsWith('/game-config.json')) ||
    files.find((entry) => normalizeZipEntryName(entry.fileName).toLowerCase().endsWith('.json')) ||
    null;
}

async function readZipEntryAsText(zipFile, entry) {
  if (entry.uncompressedSize > MAX_CONFIG_JSON_SIZE) {
    throw new Error('Het configuratiebestand in de ZIP is groter dan 16 MB.');
  }
  const stream = await zipFile.openReadStreamPromise(entry);
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > MAX_CONFIG_JSON_SIZE) {
      stream.destroy();
      throw new Error('Het configuratiebestand in de ZIP is groter dan 16 MB.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function closeZipFile(zipFile) {
  if (!zipFile.isOpen) return;
  await new Promise((resolve, reject) => {
    zipFile.once('close', resolve);
    zipFile.once('error', reject);
    zipFile.close();
  });
}

async function openZipImport(upload) {
  const zipFile = await yauzl.openPromise(upload.filePath, {
    autoClose: false,
    lazyEntries: true,
    validateEntrySizes: true
  });
  const entries = [];
  try {
    for await (const entry of zipFile.eachEntry()) {
      if (entries.length >= MAX_ZIP_ENTRY_COUNT) {
        throw new Error(`De ZIP bevat meer dan ${MAX_ZIP_ENTRY_COUNT} bestanden.`);
      }
      entries.push(entry);
    }
    const configEntry = selectZipConfigEntry(entries);
    if (!configEntry) {
      throw new Error('Geen game-config.json gevonden in het ZIP bestand.');
    }
    const configJson = await readZipEntryAsText(zipFile, configEntry);
    return {
      importId: randomUUID(),
      senderId: upload.senderId,
      zipPath: upload.filePath,
      zipFile,
      entriesByName: new Map(entries.map((entry) => [
        normalizeZipEntryName(entry.fileName),
        entry
      ])),
      cachedFiles: new Set(),
      cachedByPath: new Map(),
      cachePromises: new Map(),
      totalCachedBytes: 0,
      configJson,
      entryNames: entries.map((entry) => ({
        name: normalizeZipEntryName(entry.fileName),
        dir: entry.fileName.endsWith('/')
      }))
    };
  } catch (error) {
    await closeZipFile(zipFile);
    throw error;
  }
}

async function cacheZipEntry(importData, entryName, mimeType) {
  const normalizedName = normalizeZipEntryName(entryName);
  if (importData.cachedByPath.has(normalizedName)) {
    return importData.cachedByPath.get(normalizedName);
  }
  if (importData.cachePromises.has(normalizedName)) {
    return importData.cachePromises.get(normalizedName);
  }
  const entry = importData.entriesByName.get(normalizedName);
  const extension = mediaTypeExtensions.get(mimeType);
  if (!entry || entry.fileName.endsWith('/') || !extension) {
    throw new Error(`Ongeldig of niet-ondersteund ZIP-mediabestand: ${entryName}`);
  }
  if (entry.uncompressedSize <= 0 || entry.uncompressedSize > MAX_MEDIA_UPLOAD_SIZE) {
    throw new Error(`ZIP-mediabestand is leeg of groter dan 1 GB: ${entryName}`);
  }
  if (importData.totalCachedBytes + entry.uncompressedSize > MAX_CONFIG_MEDIA_IMPORT_SIZE) {
    throw new Error('De uitgepakte media in deze configuratie overschrijdt de limiet van 2 GB.');
  }

  importData.totalCachedBytes += entry.uncompressedSize;
  const cachePromise = (async () => {
    const fileName = `${randomUUID()}${extension}`;
    let filePath = null;
    let hasExtractionSlot = false;
    try {
      filePath = path.join(await ensureMediaCacheDirectory(), fileName);
      await acquireZipMediaExtractionSlot();
      hasExtractionSlot = true;
      const readStream = await importData.zipFile.openReadStreamPromise(entry);
      await pipeline(readStream, fs.createWriteStream(filePath, { flags: 'wx' }));
      cachedMedia.set(fileName, { filePath, mimeType });
      importData.cachedFiles.add(fileName);
      const mediaUrl = `slimstemens-media://media/${fileName}`;
      importData.cachedByPath.set(normalizedName, mediaUrl);
      return mediaUrl;
    } catch (error) {
      importData.totalCachedBytes -= entry.uncompressedSize;
      if (filePath) await fs.promises.rm(filePath, { force: true });
      throw error;
    } finally {
      if (hasExtractionSlot) releaseZipMediaExtractionSlot();
      importData.cachePromises.delete(normalizedName);
    }
  })();
  importData.cachePromises.set(normalizedName, cachePromise);
  return cachePromise;
}

async function removeCachedMedia(fileNames) {
  await Promise.all([...fileNames].map(async (fileName) => {
    const media = cachedMedia.get(fileName);
    cachedMedia.delete(fileName);
    if (media) await fs.promises.rm(media.filePath, { force: true });
  }));
}

async function closeZipImport(importData) {
  await closeZipFile(importData.zipFile);
  await fs.promises.rm(importData.zipPath, { force: true });
}

async function discardZipImport(importId) {
  const importData = zipImports.get(importId);
  if (!importData) return false;
  zipImports.delete(importId);
  await Promise.allSettled([...importData.cachePromises.values()]);
  await closeZipImport(importData);
  await removeCachedMedia(importData.cachedFiles);
  return true;
}

ipcMain.handle('begin-quiz-media-upload', async (event, mimeType) => {
  assertQuizWindow(event.sender.id);
  const extension = mediaTypeExtensions.get(mimeType);
  if (!extension) throw new Error(`Niet-ondersteund mediatype voor de Electron-cache: ${mimeType}`);
  return createMediaUpload(event.sender.id, 'media', mimeType, extension);
});

ipcMain.handle('write-quiz-media-upload-chunk', async (event, uploadId, bytes) => {
  assertQuizWindow(event.sender.id);
  return writeMediaUploadChunk(event.sender.id, uploadId, bytes, 'media');
});

ipcMain.handle('finish-quiz-media-upload', async (event, uploadId) => {
  assertQuizWindow(event.sender.id);
  const upload = mediaUploads.get(uploadId);
  if (!upload || upload.senderId !== event.sender.id || upload.kind !== 'media') {
    throw new Error('De Electron-media-upload bestaat niet of hoort bij een ander venster.');
  }
  await finishMediaUpload(uploadId, upload);
  cachedMedia.set(upload.fileName, { filePath: upload.filePath, mimeType: upload.mimeType });
  return `slimstemens-media://media/${upload.fileName}`;
});

ipcMain.handle('abort-quiz-media-upload', async (event, uploadId) => {
  assertQuizWindow(event.sender.id);
  const upload = mediaUploads.get(uploadId);
  if (!upload) return false;
  if (upload.senderId !== event.sender.id || upload.kind !== 'media') {
    throw new Error('De Electron-media-upload hoort bij een ander venster.');
  }
  await discardMediaUpload(uploadId, upload);
  return true;
});

ipcMain.handle('begin-quiz-zip-import', async (event) => {
  assertQuizWindow(event.sender.id);
  return createMediaUpload(event.sender.id, 'zip', 'application/zip', '.zip');
});

ipcMain.handle('write-quiz-zip-import-chunk', async (event, uploadId, bytes) => {
  assertQuizWindow(event.sender.id);
  return writeMediaUploadChunk(event.sender.id, uploadId, bytes, 'zip');
});

ipcMain.handle('finish-quiz-zip-import', async (event, uploadId) => {
  assertQuizWindow(event.sender.id);
  const upload = mediaUploads.get(uploadId);
  if (!upload || upload.senderId !== event.sender.id || upload.kind !== 'zip') {
    throw new Error('De ZIP-upload bestaat niet of hoort bij een ander venster.');
  }
  await finishMediaUpload(uploadId, upload);
  try {
    const importData = await openZipImport(upload);
    zipImports.set(importData.importId, importData);
    return {
      importId: importData.importId,
      configJson: importData.configJson,
      entries: importData.entryNames
    };
  } catch (error) {
    await fs.promises.rm(upload.filePath, { force: true });
    throw error;
  }
});

ipcMain.handle('abort-quiz-zip-import-upload', async (event, uploadId) => {
  assertQuizWindow(event.sender.id);
  const upload = mediaUploads.get(uploadId);
  if (!upload) return false;
  if (upload.senderId !== event.sender.id || upload.kind !== 'zip') {
    throw new Error('De ZIP-upload hoort bij een ander venster.');
  }
  await discardMediaUpload(uploadId, upload);
  return true;
});

ipcMain.handle('cache-quiz-zip-entry', async (event, importId, entryName, mimeType) => {
  assertQuizWindow(event.sender.id);
  const importData = zipImports.get(importId);
  if (!importData || importData.senderId !== event.sender.id) {
    throw new Error('De Electron-ZIP-import bestaat niet of hoort bij een ander venster.');
  }
  return cacheZipEntry(importData, entryName, mimeType);
});

ipcMain.handle('discard-quiz-zip-import', async (event, importId) => {
  assertQuizWindow(event.sender.id);
  const importData = zipImports.get(importId);
  if (!importData) return false;
  if (importData.senderId !== event.sender.id) {
    throw new Error('De Electron-ZIP-import hoort bij een ander venster.');
  }
  return discardZipImport(importId);
});

ipcMain.handle('commit-config-media-import', async (event, importId = null) => {
  assertQuizWindow(event.sender.id);
  let nextFiles = new Set();
  if (importId) {
    const importData = zipImports.get(importId);
    if (!importData || importData.senderId !== event.sender.id) {
      throw new Error('De nieuwe Electron-mediaconfiguratie bestaat niet meer.');
    }
    zipImports.delete(importId);
    nextFiles = importData.cachedFiles;
    await closeZipImport(importData);
  }

  const previousFiles = new Set(activeConfigMediaFiles);
  activeConfigMediaFiles.clear();
  nextFiles.forEach((fileName) => activeConfigMediaFiles.add(fileName));
  if (gameMediaInUse) {
    previousFiles.forEach((fileName) => {
      if (!activeConfigMediaFiles.has(fileName)) retiredConfigMediaFiles.add(fileName);
    });
  } else {
    await removeCachedMedia([...previousFiles].filter((fileName) => !activeConfigMediaFiles.has(fileName)));
  }

  const staleImports = [...zipImports.keys()].filter((pendingId) => pendingId !== importId);
  await Promise.all(staleImports.map((pendingId) => discardZipImport(pendingId)));
  if (!gameMediaInUse && retiredConfigMediaFiles.size > 0) {
    await removeCachedMedia(retiredConfigMediaFiles);
    retiredConfigMediaFiles.clear();
  }
  return true;
});

ipcMain.handle('set-game-media-in-use', async (event, inUse) => {
  assertQuizWindow(event.sender.id);
  if (typeof inUse !== 'boolean') {
    throw new Error('Ongeldige status voor game-mediagebruik.');
  }
  if (inUse && retiredConfigMediaFiles.size > 0) {
    await removeCachedMedia(retiredConfigMediaFiles);
    retiredConfigMediaFiles.clear();
  }
  gameMediaInUse = inUse;
  if (!gameMediaInUse && retiredConfigMediaFiles.size > 0) {
    await removeCachedMedia(retiredConfigMediaFiles);
    retiredConfigMediaFiles.clear();
  }
  releaseZipMediaExtractionSlots();
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
  Promise.all([
    ...[...mediaUploads].map(async ([uploadId, upload]) => {
      try {
        await discardMediaUpload(uploadId, upload);
      } catch (error) {
        console.error('Onvolledige Electron-media-upload kon niet worden verwijderd:', error);
      }
    }),
    ...[...zipImports.keys()].map(async (importId) => {
      try {
        await discardZipImport(importId);
      } catch (error) {
        console.error('Onvolledige Electron-ZIP-import kon niet worden verwijderd:', error);
      }
    })
  ])
    .then(() => fs.promises.rm(mediaCacheDirectory, { recursive: true, force: true }))
    .catch((error) => console.error('Tijdelijke Electron-mediacache kon niet worden verwijderd:', error))
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
