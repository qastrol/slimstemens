
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

let defaultThreeSixNineMax = 12;

function setupThreeSixNineRound() {
  
  perRoundState.questions = shuffleArray(Q_3_6_9.slice());
  
  
  perRoundState.max = defaultThreeSixNineMax;

  currentQuestionIndex = 0;
  perRoundState.currentQuestion = null;
  
currentQuestionEl.innerHTML = `<em>3-6-9 ronde: ${perRoundState.max} vragen. Druk op Volgende vraag om te starten.</em>`;

  renderThreeSixNineControls();

  
sendDisplayUpdate({
    type: 'round_start',
    name: '3-6-9 Ronde',
    key: 'threeSixNine',
    currentQuestionDisplay: null,
    currentQuestionIndex: 0,
    maxQuestions: perRoundState.max,
    activePlayer: players[activePlayerIndex]?.name || '-',
    activeIndex: activePlayerIndex,
    players
});

}


function setThreeSixNineMax(num) {
  const n = parseInt(num);
  if (!isNaN(n) && n > 0 && n <= Q_3_6_9.length) {
    defaultThreeSixNineMax = n;
    flash(`Aantal vragen voor 3-6-9 ingesteld op ${n}`);
  } else {
    flash(`Ongeldig aantal vragen. Maximaal: ${Q_3_6_9.length}`);
  }
}

function nextThreeSixNineQuestion() {
  if (!players.length) {
    flash('Maak eerst het spel aan met spelers');
    return;
  }

  if(currentQuestionIndex >= perRoundState.max){
    flash('Einde van de 3-6-9 ronde!');
    currentQuestionEl.innerHTML = '<em>Ronde afgelopen.</em>';
    perRoundState.currentQuestion = null;

    sendDisplayUpdate({
      type: 'update',
      currentRoundName: 'threeSixNine',
      currentQuestionDisplay: null
    });
    return;
  }

  const q = perRoundState.questions[currentQuestionIndex] || { text: 'Placeholdervraag', answers: [] };
  perRoundState.currentQuestion = q; 
  currentQuestionIndex++;

  const activePlayerName = players[activePlayerIndex]?.name || '-';

  currentQuestionEl.innerHTML = `
    <strong>Vraag ${currentQuestionIndex} (3-6-9)</strong>
    <div>${q.text}</div>
    <div class="small">(Druk op Goed of Fout. Elke derde vraag: +10s bonus)</div>
    <div class="muted small">Antwoord: ${q.answers.join(', ')}</div>`;

  perRoundState.currentIsBonus = (currentQuestionIndex % 3 === 0);
  perRoundState.originalPlayer = activePlayerIndex;
  perRoundState.currentQuestionTried = [];
  highlightActive();

sendDisplayUpdate({
    type: 'update',
    currentRoundName: 'threeSixNine',
    currentQuestionDisplay: q.text,
    currentQuestionIndex: currentQuestionIndex,
    maxQuestions: perRoundState.max,
    activePlayer: activePlayerName,
    activeIndex: activePlayerIndex,
    players
});

}

function markThreeSixNineAnswer(isRight) {
  if (!roundRunning || !perRoundState.currentQuestion) return;

  const currentPlayer = players[activePlayerIndex];

  if (isRight) {
    
    if (currentQuestionIndex % 3 === 0) {
      currentPlayer.seconds += 10;
      flash(`GOED! +10s bonus voor ${currentPlayer.name}!`, 'good');
    } else {
      flash(`GOED! Geen tijd, ${currentPlayer.name} blijft aan de beurt.`, 'good');
    }

    

  } else {
    
    activePlayerIndex = (activePlayerIndex + 1) % players.length;
    flash(`FOUT! Beurt naar ${players[activePlayerIndex].name} voor dezelfde vraag.`, 'wrong');
  }

  
  currentPlayer.seconds = Math.max(0, currentPlayer.seconds);

  
  sendDisplayUpdate({
    type: 'update',
    action: 'answer',
    isRight,
    currentRoundName: 'threeSixNine',
    scene: 'round-369',
    currentQuestionDisplay: perRoundState.currentQuestion?.text || "—",
    currentQuestionIndex,
    maxQuestions: perRoundState.max,
    activePlayer: players[activePlayerIndex]?.name || '-',
    activeIndex: activePlayerIndex,
    players
  });

  renderPlayers();
}



function renderThreeSixNineControls() {
    const controlsEl = document.getElementById('roundControls');

    if (!controlsEl) {
        console.warn('renderThreeSixNineControls: roundControls element niet gevonden. Overslaan.');
        return;
    }

    controlsEl.innerHTML = `
        <button onclick="nextThreeSixNineQuestion()" id="roundNextQuestionBtn">Volgende vraag</button>
        <button onclick="markThreeSixNineAnswer(true); playSFX('SFX/goed.mp3');" id="roundMarkRightBtn">Goed</button>
        <button onclick="markThreeSixNineAnswer(false); playSFX('SFX/fout.mp3');" id="roundMarkWrongBtn">Fout</button>
    `;
}

document.getElementById('setThreeSixNineCountBtn').addEventListener('click', () => {
  const num = document.getElementById('threeSixNineCount').value;
  setThreeSixNineMax(num);
});