  const ws = new WebSocket("ws://localhost:3000");

  function sendGameState() {
    const state = {
      players,
      round: perRoundState.round || "—",
      question: currentQuestionEl.innerText,
      activePlayer: players[activePlayerIndex]?.name || "",
    };
    ws.send(JSON.stringify({ type: "update", data: state }));
  }

  // Stuur updates bij elke belangrijke actie
  const oldRenderPlayers = renderPlayers;
  renderPlayers = function() {
    oldRenderPlayers();
    sendGameState();
  };

  const oldStartRound = startRound;
  startRound = function(roundKey) {
    oldStartRound(roundKey);
    sendGameState();
  };

  const oldMarkAnswer = markAnswer;
  markAnswer = function(isRight) {
    oldMarkAnswer(isRight);
    sendGameState();
  };