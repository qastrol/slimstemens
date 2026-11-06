const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('slimstemensDesktopBridge', {
  send(message) {
    ipcRenderer.send('quiz-message', message);
  },
  beginMediaUpload(mimeType) {
    return ipcRenderer.invoke('begin-quiz-media-upload', mimeType);
  },
  writeMediaUploadChunk(uploadId, bytes) {
    return ipcRenderer.invoke('write-quiz-media-upload-chunk', uploadId, bytes);
  },
  finishMediaUpload(uploadId) {
    return ipcRenderer.invoke('finish-quiz-media-upload', uploadId);
  },
  abortMediaUpload(uploadId) {
    return ipcRenderer.invoke('abort-quiz-media-upload', uploadId);
  },
  beginZipImport() {
    return ipcRenderer.invoke('begin-quiz-zip-import');
  },
  writeZipImportChunk(uploadId, bytes) {
    return ipcRenderer.invoke('write-quiz-zip-import-chunk', uploadId, bytes);
  },
  finishZipImport(uploadId) {
    return ipcRenderer.invoke('finish-quiz-zip-import', uploadId);
  },
  abortZipImportUpload(uploadId) {
    return ipcRenderer.invoke('abort-quiz-zip-import-upload', uploadId);
  },
  cacheZipEntry(importId, entryName, mimeType) {
    return ipcRenderer.invoke('cache-quiz-zip-entry', importId, entryName, mimeType);
  },
  discardZipImport(importId) {
    return ipcRenderer.invoke('discard-quiz-zip-import', importId);
  },
  commitConfigMediaImport(importId) {
    return ipcRenderer.invoke('commit-config-media-import', importId);
  },
  setGameMediaInUse(inUse) {
    return ipcRenderer.invoke('set-game-media-in-use', inUse);
  },
  onMessage(callback) {
    const handler = (_event, message) => callback(message);
    ipcRenderer.on('quiz-message', handler);

    return () => {
      ipcRenderer.removeListener('quiz-message', handler);
    };
  }
});
