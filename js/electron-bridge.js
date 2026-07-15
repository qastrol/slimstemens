const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('slimstemensDesktopBridge', {
  send(message) {
    ipcRenderer.send('quiz-message', message);
  },
  onMessage(callback) {
    const handler = (_event, message) => callback(message);
    ipcRenderer.on('quiz-message', handler);

    return () => {
      ipcRenderer.removeListener('quiz-message', handler);
    };
  }
});
