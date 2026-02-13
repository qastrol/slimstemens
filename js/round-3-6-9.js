
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

let defaultThreeSixNineMax = 12;

// ===== STANDALONE KLOK2.MP3 LOOP FUNCTIONALITEIT =====
// Deze functies zijn volledig standalone en onafhankelijk van andere code
// Audio speelt alleen af op display.html, niet op index.html
let klok369TimerInterval = null;
let klok369ElapsedSeconds = 0;
let klok369IsPlaying = false;
let klok369ErrorCount = 0;

function klok369_startLoop() {
  // Stop bestaande loop eerst
  klok369_stopLoop();
  
  klok369IsPlaying = true;
  klok369ElapsedSeconds = 0;
  klok369_updateTimerDisplay();
  
  // Start timer interval (elke seconde)
  klok369TimerInterval = setInterval(() => {
    klok369ElapsedSeconds++;
    klok369_updateTimerDisplay();
  }, 1000);
  
  // Stuur display update voor loop start (audio speelt alleen op display.html)
  try {
    if (typeof sendDisplayUpdate === 'function') {
      sendDisplayUpdate({ type: 'audio', action: 'loopStart', src: 'SFX/klok2.mp3' });
    }
  } catch(e) {}
}

function klok369_stopLoop() {
  // Stop timer
  if (klok369TimerInterval) {
    clearInterval(klok369TimerInterval);
    klok369TimerInterval = null;
  }
  
  klok369IsPlaying = false;
  
  // Stuur display update voor loop stop (audio speelt alleen op display.html)
  try {
    if (typeof sendDisplayUpdate === 'function') {
      sendDisplayUpdate({ type: 'audio', action: 'loopStop' });
    }
  } catch(e) {}
}

function klok369_resetTimer() {
  klok369ElapsedSeconds = 0;
  klok369_updateTimerDisplay();
}

function klok369_updateTimerDisplay() {
  const timerEl = document.getElementById('klok369Timer');
  if (timerEl) {
    timerEl.textContent = `${klok369ElapsedSeconds}s`;
  }
}

function klok369_toggleLoop() {
  if (klok369IsPlaying) {
    klok369_stopLoop();
    klok369_resetTimer();
  } else {
    klok369_startLoop();
  }
}

function klok369_handleCorrectAnswer() {
  klok369_stopLoop();
  klok369_resetTimer();
  klok369ErrorCount = 0;
}

function klok369_handleWrongAnswer() {
  klok369_resetTimer();
  klok369ErrorCount++;
  
  // Als 3 fouten, stop de loop
  if (klok369ErrorCount >= 3) {
    klok369_stopLoop();
    klok369ErrorCount = 0;
  }
}

function klok369_resetErrorCount() {
  klok369ErrorCount = 0;
}
// ===== EINDE STANDALONE KLOK FUNCTIONALITEIT =====


function setupThreeSixNineRound() {
  // Reset klok state bij start van ronde
  klok369_stopLoop();
  klok369_resetTimer();
  klok369_resetErrorCount();
  
  // Haal vragen op met fallback naar standaard vragen
  const questionsToUse = getQuestionsForRound('threeSixNine', Q_3_6_9);
  
  // Check of shuffle aan of uit staat
  const shouldShuffle = shouldShuffleRound('threeSixNine');
  perRoundState.questions = shouldShuffle ? shuffleArray(questionsToUse.slice()) : questionsToUse.slice();
  
  // Haal maxQuestions uit config, of gebruik standaard waarde
  const configMaxQuestions = getRoundSetting('threeSixNine', 'maxQuestions', null);
  if (configMaxQuestions !== null && !isNaN(configMaxQuestions) && configMaxQuestions > 0) {
    perRoundState.max = Math.min(configMaxQuestions, perRoundState.questions.length);
    console.log(`3-6-9: Aantal vragen uit config: ${perRoundState.max}`);
  } else {
    perRoundState.max = defaultThreeSixNineMax;
  }

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

  const q = perRoundState.questions[currentQuestionIndex] || { text: 'Placeholdervraag', answers: [], type: 'classic' };
  perRoundState.currentQuestion = q; 
  currentQuestionIndex++;

  const activePlayerName = players[activePlayerIndex]?.name || '-';

  // Render vraag gebaseerd op type
  let questionHTML = `<strong>Vraag ${currentQuestionIndex} (3-6-9)</strong>`;
  
  switch(q.type) {
    case 'multiple-choice':
      if (q.options && q.options.A && q.options.B && q.options.C && q.options.D) {
        questionHTML += `
          <div>${q.text}</div>
          <div class="multiple-choice-options">
            <div><strong>A:</strong> ${q.options.A}</div>
            <div><strong>B:</strong> ${q.options.B}</div>
            <div><strong>C:</strong> ${q.options.C}</div>
            <div><strong>D:</strong> ${q.options.D}</div>
          </div>
          <div class="small">(Druk op Goed of Fout. Elke derde vraag: +10s bonus)</div>
          <div class="muted small">Juiste antwoord: ${q.correctAnswer || 'Onbekend'}</div>`;
        if (q.remarks) {
          questionHTML += `<div class="host-remarks">💬 ${q.remarks}</div>`;
        }
      } else {
        // Fallback als options ontbreken
        questionHTML += `
          <div>${q.text}</div>
          <div class="small">(Multiple-choice opties ontbreken - behandel als klassieke vraag)</div>
          <div class="muted small">Antwoord: ${q.answers ? q.answers.join(', ') : 'Onbekend'}</div>`;
        if (q.remarks) {
          questionHTML += `<div class="host-remarks">💬 ${q.remarks}</div>`;
        }
      }
      break;
      
    case 'photo':
      questionHTML += `
        <div>${q.text}</div>
        <div class="small" style="color:#888">📷 Foto beschikbaar: ${q.photoUrl || 'Geen URL'}</div>
        <div class="small">(Gebruik knop hieronder om foto te tonen/verbergen)</div>
        <div class="muted small">Antwoord: ${q.answers ? q.answers.join(', ') : 'Onbekend'}</div>`;
      if (q.remarks) {
        questionHTML += `<div class="host-remarks">💬 ${q.remarks}</div>`;
      }
      break;
      
    case 'audio':
      questionHTML += `
        <div>${q.text}</div>
        <div class="small" style="color:#888">🔊 Audio beschikbaar: ${q.audioUrl || 'Geen URL'}</div>
        <div class="small">(Gebruik knop hieronder om audio af te spelen)</div>
        <div class="muted small">Antwoord: ${q.answers ? q.answers.join(', ') : 'Onbekend'}</div>`;
      if (q.remarks) {
        questionHTML += `<div class="host-remarks">💬 ${q.remarks}</div>`;
      }
      break;
      
    case 'doe':
      questionHTML += `
        <div>${q.text}</div>
        <div class="small" style="color:#f90">⚡ DOE-VRAAG: Kies welke kandidaat wint</div>
        <div class="muted small">${q.description || ''}</div>`;
      if (q.remarks) {
        questionHTML += `<div class="host-remarks">💬 ${q.remarks}</div>`;
      }
      break;
      
    case 'estimation':
      questionHTML += `
        <div>${q.text}</div>
        <div class="small" style="color:#09f">📊 INSCHATTINGSVRAAG: Elke kandidaat geeft een antwoord</div>
        <div class="muted small">Juiste antwoord: ${q.correctAnswer || 'Onbekend'} ${q.unit || ''}</div>`;
      if (q.remarks) {
        questionHTML += `<div class="host-remarks">💬 ${q.remarks}</div>`;
      }
      break;
      
    case 'classic':
    default:
      questionHTML += `
        <div>${q.text}</div>
        <div class="small">(Druk op Goed of Fout. Elke derde vraag: +10s bonus)</div>
        <div class="muted small">Antwoord: ${q.answers ? q.answers.join(', ') : 'Onbekend'}</div>`;
      if (q.remarks) {
        questionHTML += `<div class="host-remarks">💬 ${q.remarks}</div>`;
      }
      break;
  }

  currentQuestionEl.innerHTML = questionHTML;

  perRoundState.currentIsBonus = (currentQuestionIndex % 3 === 0);
  perRoundState.originalPlayer = activePlayerIndex;
  perRoundState.currentQuestionTried = [];
  
  // Reset error count voor nieuwe vraag
  klok369_resetErrorCount();
  
  highlightActive();
  
  // Render controls voor dit vraagtype
  renderThreeSixNineControls();

  sendDisplayUpdate({
    type: 'update',
    currentRoundName: 'threeSixNine',
    questionType: q.type || 'classic',
    currentQuestionDisplay: q.text,
    currentQuestionIndex: currentQuestionIndex,
    maxQuestions: perRoundState.max,
    activePlayer: activePlayerName,
    activeIndex: activePlayerIndex,
    photoUrl: q.photoUrl,
    audioUrl: q.audioUrl,
    options: q.options,
    players
  });

}

function markThreeSixNineAnswer(isRight) {
  if (!roundRunning || !perRoundState.currentQuestion) return;

  const currentPlayer = players[activePlayerIndex];

  if (isRight) {
    // KLOK RESET: Goed antwoord
    klok369_handleCorrectAnswer();
    
    if (currentQuestionIndex % 3 === 0) {
      currentPlayer.seconds += 10;
      flash(`GOED! +10s bonus voor ${currentPlayer.name}!`, 'good');
    } else {
      flash(`GOED! Geen tijd, ${currentPlayer.name} blijft aan de beurt.`, 'good');
    }

    

  } else {
    // KLOK RESET: Fout antwoord
    klok369_handleWrongAnswer();
    
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

    const q = perRoundState.currentQuestion;
    const qType = q?.type || 'classic';
    
    let controlsHTML = `
        <button onclick="nextThreeSixNineQuestion()" id="roundNextQuestionBtn">Volgende vraag</button>
        <button onclick="klok369_toggleLoop()" id="playKlok369" class="secondary" style="background:#E2904A">
            Klok <span id="klok369Timer" style="margin-left:8px;font-weight:bold">${klok369ElapsedSeconds}s</span>
        </button>
    `;
    
    // Type-specifieke knoppen
    if (qType === 'photo') {
        controlsHTML += `
            <button onclick="toggleThreeSixNinePhoto()" id="togglePhotoBtn" class="secondary" style="background:#4A90E2">
                📷 Foto Tonen/Verbergen
            </button>
        `;
    }
    
    if (qType === 'audio') {
        controlsHTML += `
            <button onclick="playThreeSixNineAudio()" id="playAudioBtn" class="secondary" style="background:#E24A90">
                🔊 Audio Afspelen
            </button>
        `;
    }
    
    // Goed/Fout knoppen voor alle types behalve doe en estimation
    if (qType !== 'doe' && qType !== 'estimation') {
        controlsHTML += `
            <button onclick="markThreeSixNineAnswer(true); playSFX('SFX/goed.mp3');" id="roundMarkRightBtn">Goed</button>
            <button onclick="markThreeSixNineAnswer(false); playSFX('SFX/fout.mp3');" id="roundMarkWrongBtn">Fout</button>
        `;
    }
    
    if (qType === 'doe') {
        controlsHTML += `
            <div style="margin-top:10px">
                <div class="small">Kies winnaar:</div>
                ${players.map((p, i) => `
                    <button onclick="selectDoeWinner(${i})" class="secondary" style="margin:2px">
                        ${p.name}
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    if (qType === 'estimation') {
        controlsHTML += `
            <div style="margin-top:10px">
                <div class="small">Wie zat het dichtst bij?</div>
                ${players.map((p, i) => `
                    <button onclick="selectEstimationWinner(${i})" class="secondary" style="margin:2px">
                        ${p.name}
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    controlsEl.innerHTML = controlsHTML;
}

// Foto tonen/verbergen
function toggleThreeSixNinePhoto() {
    const q = perRoundState.currentQuestion;
    if (!q || !q.photoUrl) return;
    
    perRoundState.photoVisible = !perRoundState.photoVisible;
    
    const activePlayerName = players[activePlayerIndex]?.name || '-';
    
    sendDisplayUpdate({
        type: 'update',
        currentRoundName: 'threeSixNine',
        action: 'togglePhoto',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: activePlayerName,
        activeIndex: activePlayerIndex,
        photoUrl: q.photoUrl,
        photoVisible: perRoundState.photoVisible,
        players
    });
    
    flash(perRoundState.photoVisible ? 'Foto getoond' : 'Foto verborgen');
}

// Audio afspelen
function playThreeSixNineAudio() {
    const q = perRoundState.currentQuestion;
    if (!q || !q.audioUrl) return;
    
    const activePlayerName = players[activePlayerIndex]?.name || '-';
    
    sendDisplayUpdate({
        type: 'update',
        currentRoundName: 'threeSixNine',
        action: 'playAudio',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: activePlayerName,
        activeIndex: activePlayerIndex,
        audioUrl: q.audioUrl,
        players
    });
    
    flash('Audio afspelen...');
    playSFX(q.audioUrl);
}

// DOE-vraag winnaar selecteren
function selectDoeWinner(playerIndex) {
    if (!roundRunning || !perRoundState.currentQuestion) return;
    
    activePlayerIndex = playerIndex;
    const winner = players[playerIndex];
    const q = perRoundState.currentQuestion;
    
    if (currentQuestionIndex % 3 === 0) {
        winner.seconds += 10;
        playSFX('SFX/goed.mp3');
        flash(`${winner.name} wint! +10s bonus!`, 'good');
    } else {
        flash(`${winner.name} wint en blijft aan de beurt!`, 'good');
    }
    
    sendDisplayUpdate({
        type: 'update',
        action: 'doeWinner',
        currentRoundName: 'threeSixNine',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: winner.name,
        activeIndex: playerIndex,
        players
    });
    
    renderPlayers();
}

// Inschattingsvraag winnaar selecteren
function selectEstimationWinner(playerIndex) {
    if (!roundRunning || !perRoundState.currentQuestion) return;
    
    activePlayerIndex = playerIndex;
    const winner = players[playerIndex];
    const q = perRoundState.currentQuestion;
    
    if (currentQuestionIndex % 3 === 0) {
        winner.seconds += 10;
        playSFX('SFX/goed.mp3');
        flash(`${winner.name} zat het dichtst bij! +10s bonus!`, 'good');
    } else {
        flash(`${winner.name} zat het dichtst bij en blijft aan de beurt!`, 'good');
    }
    
    sendDisplayUpdate({
        type: 'update',
        action: 'estimationWinner',
        currentRoundName: 'threeSixNine',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: winner.name,
        activeIndex: playerIndex,
        players
    });
    
    renderPlayers();
}

document.getElementById('setThreeSixNineCountBtn').addEventListener('click', () => {
  const num = document.getElementById('threeSixNineCount').value;
  setThreeSixNineMax(num);
});