// server.js - De Slimste Mens Lokale WebSocket Server

const WebSocket = require('ws');

// Standaardpoort voor WebSockets is 8081. Zorg ervoor dat deze vrij is.
const wss = new WebSocket.Server({ port: 8081 });

console.log('WebSocket Server gestart op ws://localhost:8081');

// Houdt alle verbonden clients (index.html en display.html) bij
const clients = new Set();

wss.on('connection', function connection(ws) {
  
  // Voeg de nieuwe client toe aan de set
  clients.add(ws);
  console.log('Nieuwe client verbonden. Totaal clients:', clients.size);

  // Verwerk inkomende berichten (van de Host Tool: index.html)
  ws.on('message', function incoming(message) {
    const messageString = message.toString();
    console.log(`Ontvangen bericht: ${messageString}`);

    // Stuur het bericht door naar ALLE andere clients (inclusief de display)
    clients.forEach(client => {
      // Controleer of de client open is en NIET de zender is (optioneel, maar efficiënter)
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  });

  // Verwerk het sluiten van de verbinding
  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client verbinding gesloten. Totaal clients:', clients.size);
  });
  
  // Foutafhandeling
  ws.on('error', (error) => {
    console.error('WebSocket fout opgetreden:', error.message);
  });
});

// Zorg ervoor dat de server afsluit wanneer het hoofdproces stopt
process.on('SIGINT', () => {
    console.log('\nServer sluit af...');
    wss.close(() => {
        console.log('WebSocket server gesloten.');
        process.exit(0);
    });
});