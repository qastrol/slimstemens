(() => {
  const desktopBridge = window.slimstemensDesktopBridge;
  const hostCheatsCheckbox = document.getElementById('hostCheatsEnabledCheckbox');
  const integrationOption = document.getElementById('streamerBotOption');
  const enabledCheckbox = document.getElementById('streamerBotEnabled');
  const addressField = document.getElementById('streamerBotAddressField');
  const urlInput = document.getElementById('streamerBotUrl');
  const status = document.getElementById('streamerBotStatus');
  const subscriptionId = 'de-slimste-mens-host';

  if (!integrationOption || !enabledCheckbox || !addressField || !urlInput || !status || !hostCheatsCheckbox) return;

  let socket = null;
  let reconnectTimeout = null;
  let gameStarted = false;

  function setStatus(message) {
    status.textContent = message;
    status.hidden = !enabledCheckbox.checked || !hostCheatsCheckbox.checked || !desktopBridge;
  }

  function clearReconnect() {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  function closeConnection() {
    clearReconnect();
    if (!socket) return;
    const currentSocket = socket;
    socket = null;
    currentSocket.onclose = null;
    currentSocket.onerror = null;
    currentSocket.onmessage = null;
    currentSocket.close();
  }

  function isIntegrationAvailable() {
    return !!desktopBridge && hostCheatsCheckbox.checked;
  }

  function updateAvailability() {
    const available = isIntegrationAvailable();
    integrationOption.hidden = !desktopBridge;
    enabledCheckbox.disabled = !available;
    addressField.style.display = available && enabledCheckbox.checked ? 'block' : 'none';
    if (!available) {
      enabledCheckbox.checked = false;
      closeConnection();
      setStatus('Streamer.bot: niet ingeschakeld.');
    } else if (!enabledCheckbox.checked) {
      setStatus('Streamer.bot: niet ingeschakeld.');
    }
  }

  function scheduleReconnect() {
    clearReconnect();
    if (!enabledCheckbox.checked || !isIntegrationAvailable()) return;
    reconnectTimeout = setTimeout(connect, 5000);
  }

  function handleMessage(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.warn('Streamer.bot stuurde ongeldige JSON:', error);
      setStatus('Bericht ontvangen met ongeldige JSON.');
      return;
    }

    if (message?.status === 'ok' || message?.event?.source === null) return;
    const request = message?.event?.type === 'Custom'
      ? message.data
      : message?.data?.name
        ? message.data
        : message;
    if (request?.name !== 'HostCheat') return;

    try {
      if (!isIntegrationAvailable() || !enabledCheckbox.checked) {
        throw new Error('De Streamer.bot-integratie is uitgeschakeld.');
      }
      const executed = window.executeStreamerBotHostRequest(request);
      if (!executed) {
        setStatus(`Opdracht niet uitgevoerd: ${request.arguments?.operation || 'onbekende actie'}.`);
        return;
      }
      setStatus(`Opdracht uitgevoerd: ${request.arguments?.operation || 'hostactie'}.`);
    } catch (error) {
      console.error('Streamer.bot-hostopdracht mislukt:', error);
      setStatus(`Opdracht mislukt: ${error.message || error}`);
    }
  }

  function connect() {
    clearReconnect();
    if (!enabledCheckbox.checked || !isIntegrationAvailable()) return;
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) return;

    let endpoint;
    try {
      endpoint = new URL(urlInput.value.trim());
      if (!['ws:', 'wss:'].includes(endpoint.protocol)) {
        throw new Error('Gebruik een ws://- of wss://-adres.');
      }
    } catch (error) {
      setStatus(`Ongeldig WebSocket-adres: ${error.message}`);
      return;
    }

    setStatus(`Streamer.bot: verbinden met ${endpoint.host}…`);
    try {
      const connection = new WebSocket(endpoint.href);
      socket = connection;
      connection.onopen = () => {
        if (socket !== connection) return;
        try {
          connection.send(JSON.stringify({
            request: 'Subscribe',
            id: subscriptionId,
            events: { general: ['Custom'] }
          }));
          setStatus('Streamer.bot: verbonden; wacht op hostopdracht.');
        } catch (error) {
          console.error('Streamer.bot Custom-events konden niet worden aangevraagd:', error);
          setStatus(`Streamer.bot: abonneren mislukt: ${error.message || error}`);
          connection.close();
        }
      };
      connection.onmessage = handleMessage;
      connection.onerror = () => {
        if (socket === connection) setStatus('Streamer.bot: verbindingsfout; opnieuw proberen…');
      };
      connection.onclose = () => {
        if (socket !== connection) return;
        socket = null;
        setStatus('Streamer.bot: verbinding verbroken; opnieuw proberen…');
        scheduleReconnect();
      };
    } catch (error) {
      socket = null;
      setStatus(`Streamer.bot: verbinding mislukt: ${error.message || error}`);
      scheduleReconnect();
    }
  }

  enabledCheckbox.addEventListener('change', () => {
    addressField.style.display = isIntegrationAvailable() && enabledCheckbox.checked ? 'block' : 'none';
    if (enabledCheckbox.checked && isIntegrationAvailable() && gameStarted) {
      connect();
    } else if (enabledCheckbox.checked && isIntegrationAvailable()) {
      closeConnection();
      setStatus('Streamer.bot: klaar; start het spel om te verbinden.');
    } else {
      closeConnection();
      setStatus('Streamer.bot: niet ingeschakeld.');
    }
  });

  urlInput.addEventListener('change', () => {
    if (!enabledCheckbox.checked || !isIntegrationAvailable()) return;
    closeConnection();
    if (gameStarted) connect();
    else setStatus('Streamer.bot: adres opgeslagen; start het spel om te verbinden.');
  });

  hostCheatsCheckbox.addEventListener('change', updateAvailability);
  window.addEventListener('slimstemens:game-started', () => {
    gameStarted = true;
    if (enabledCheckbox.checked && isIntegrationAvailable()) connect();
  });
  window.addEventListener('slimstemens:game-reset', () => {
    gameStarted = false;
    closeConnection();
    if (enabledCheckbox.checked && isIntegrationAvailable()) {
      setStatus('Streamer.bot: klaar; start het spel om te verbinden.');
    }
  });
  updateAvailability();
})();
