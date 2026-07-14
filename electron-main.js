const { app, BrowserWindow, dialog } = require('electron');
const WebSocket = require('ws');
const path = require('path');

let websocketServer = null;
let hostWindow = null;
let displayWindow = null;

function startWebSocketServer() {
  if (websocketServer) return Promise.resolve(websocketServer);

  return new Promise((resolve, reject) => {
    try {
      const clients = new Set();
      websocketServer = new WebSocket.Server({ port: 8081 });

      websocketServer.on('connection', (ws) => {
        clients.add(ws);

        ws.on('message', (message) => {
          const messageString = message.toString();

          clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(messageString);
            }
          });
        });

        ws.on('close', () => {
          clients.delete(ws);
        });

        ws.on('error', (error) => {
          console.error('WebSocket fout opgetreden:', error.message);
        });
      });

      websocketServer.on('listening', () => {
        console.log('WebSocket Server gestart op ws://localhost:8081');
        resolve(websocketServer);
      });

      websocketServer.on('error', (error) => {
        websocketServer = null;

        const isPortInUse = error && (error.code === 'EADDRINUSE' || error.code === 'EACCES');
        const message = isPortInUse
          ? 'Poort 8081 is al in gebruik. Sluit eerst een andere versie van De Slimste Mens of een andere app die deze poort gebruikt.'
          : `De lokale server kon niet starten:\n${error.message}`;

        dialog.showErrorBox('Serverfout', message);
        reject(error);
      });
    } catch (error) {
      websocketServer = null;
      dialog.showErrorBox(
        'Serverfout',
        `De lokale server kon niet starten:\n${error.message}`
      );
      reject(error);
    }
  });
}

function createWindows() {
  const windowIcon = path.join(__dirname, 'assets', 'slimstemens.ico');

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
      nodeIntegration: false
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
      nodeIntegration: false
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

function stopWebSocketServer() {
  if (!websocketServer) return;

  try {
    websocketServer.close();
  } catch {
    // Negeer sluitfouten bij afsluiten.
  }

  websocketServer = null;
}

app.on('before-quit', () => {
  app.isQuitting = true;
  stopWebSocketServer();
});

app.whenReady().then(() => {
  startWebSocketServer()
    .then(() => {
      createWindows();
    })
    .catch(() => {
      app.quit();
    });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindows();
  }
});
