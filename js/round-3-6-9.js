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
  perRoundState.questions = shouldShuffle
    ? (typeof shuffleArrayShared === 'function' ? shuffleArrayShared(questionsToUse) : questionsToUse.slice())
    : questionsToUse.slice();
  
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

function getThreeSixNineMediaUrls(question, phase = 'question') {
  const q = question || {};

  if (phase === 'after') {
    return {
      photoUrl: q.afterPhotoUrl || q.revealPhotoUrl || null,
      audioUrl: q.afterAudioUrl || q.revealAudioUrl || null,
      videoUrl: q.afterVideoUrl || q.revealVideoUrl || null
    };
  }

  return {
    photoUrl: q.questionPhotoUrl || q.photoUrl || null,
    audioUrl: q.questionAudioUrl || q.audioUrl || null,
    videoUrl: q.questionVideoUrl || q.videoUrl || q.clip || null
  };
}

function resetThreeSixNineMediaState() {
  perRoundState.mediaQuestionPhotoVisible = false;
  perRoundState.mediaAfterPhotoVisible = false;
  perRoundState.mediaQuestionAudioPlaying = false;
  perRoundState.mediaAfterAudioPlaying = false;
  perRoundState.mediaQuestionVideoPlaying = false;
  perRoundState.mediaAfterVideoPlaying = false;
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
    if (typeof markCurrentRoundComplete === 'function') {
      markCurrentRoundComplete();
    }

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
  const questionMedia = getThreeSixNineMediaUrls(q, 'question');
  const afterMedia = getThreeSixNineMediaUrls(q, 'after');

  // Render vraag gebaseerd op type
  let questionHTML = `<strong>Vraag ${currentQuestionIndex} (3-6-9)</strong>`;
  const qType = q.type || 'classic';

  questionHTML += `<div>${q.text}</div>`;

  if (qType === 'multiple-choice' && q.options) {
    questionHTML += `
      <div class="multiple-choice-options">
        <div><strong>A:</strong> ${q.options.A || '-'}</div>
        <div><strong>B:</strong> ${q.options.B || '-'}</div>
        <div><strong>C:</strong> ${q.options.C || '-'}</div>
        <div><strong>D:</strong> ${q.options.D || '-'}</div>
      </div>
      <div class="muted small">Juiste antwoord: ${q.correctAnswer || 'Onbekend'}</div>`;
  }

  if (qType === 'doe') {
    questionHTML += `<div class="small" style="color:#f90">⚡ DOE-VRAAG: Kies welke kandidaat wint</div>`;
    if (q.description) {
      questionHTML += `<div class="muted small">${q.description}</div>`;
    }
  }

  if (qType === 'estimation') {
    questionHTML += `
      <div class="small" style="color:#09f">📊 INSCHATTINGSVRAAG: elke kandidaat geeft een antwoord</div>
      <div class="muted small">Juiste antwoord: ${q.correctAnswer || 'Onbekend'} ${q.unit || ''}</div>`;
  }

  if (qType === 'classic') {
    questionHTML += `<div class="muted small">Antwoord: ${q.answers ? q.answers.join(', ') : 'Onbekend'}</div>`;
  }

  if (questionMedia.photoUrl || questionMedia.audioUrl || questionMedia.videoUrl) {
    questionHTML += `<div class="small">Vraagmedia beschikbaar:${questionMedia.photoUrl ? ' 📷 foto' : ''}${questionMedia.audioUrl ? ' 🔊 audio' : ''}${questionMedia.videoUrl ? ' 🎬 video' : ''}</div>`;
  }

  if (afterMedia.photoUrl || afterMedia.audioUrl || afterMedia.videoUrl) {
    questionHTML += `<div class="small">Na-vraagmedia beschikbaar:${afterMedia.photoUrl ? ' 📷 foto' : ''}${afterMedia.audioUrl ? ' 🔊 audio' : ''}${afterMedia.videoUrl ? ' 🎬 video' : ''}</div>`;
  }

  if (q.remarks) {
    questionHTML += `<div class="host-remarks">💬 ${q.remarks}</div>`;
  }

  currentQuestionEl.innerHTML = questionHTML;

  perRoundState.currentIsBonus = (currentQuestionIndex % 3 === 0);
  perRoundState.originalPlayer = activePlayerIndex;
  perRoundState.currentQuestionTried = [];
  
  // Reset error count voor nieuwe vraag
  klok369_resetErrorCount();
  
  // Reset media-visibility bij elke nieuwe vraag.
  resetThreeSixNineMediaState();
  
  highlightActive();
  
  // Render controls voor dit vraagtype
  renderThreeSixNineControls();

  sendDisplayUpdate({
    type: 'update',
    currentRoundName: 'threeSixNine',
    questionType: qType,
    currentQuestionDisplay: q.text,
    currentQuestionIndex: currentQuestionIndex,
    maxQuestions: perRoundState.max,
    activePlayer: activePlayerName,
    activeIndex: activePlayerIndex,
    hasQuestionPhoto: !!questionMedia.photoUrl,
    hasQuestionAudio: !!questionMedia.audioUrl,
    hasQuestionVideo: !!questionMedia.videoUrl,
    hasAfterPhoto: !!afterMedia.photoUrl,
    hasAfterAudio: !!afterMedia.audioUrl,
    hasAfterVideo: !!afterMedia.videoUrl,
    photoVisible: false,
    activeMediaPhase: 'question',
    options: q.options,
    players
  });

}

function markThreeSixNineAnswer(isRight) {
  if (!roundRunning || !perRoundState.currentQuestion) return;

  const currentPlayer = players[activePlayerIndex];
  const currentQuestion = perRoundState.currentQuestion;
  const questionMedia = getThreeSixNineMediaUrls(currentQuestion, 'question');
  const afterMedia = getThreeSixNineMediaUrls(currentQuestion, 'after');

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
    questionType: currentQuestion.type || 'classic',
    currentQuestionDisplay: currentQuestion.text || "—",
    currentQuestionIndex,
    maxQuestions: perRoundState.max,
    activePlayer: players[activePlayerIndex]?.name || '-',
    activeIndex: activePlayerIndex,
    options: currentQuestion.options,
    hasQuestionPhoto: !!questionMedia.photoUrl,
    hasQuestionAudio: !!questionMedia.audioUrl,
    hasQuestionVideo: !!questionMedia.videoUrl,
    hasAfterPhoto: !!afterMedia.photoUrl,
    hasAfterAudio: !!afterMedia.audioUrl,
    hasAfterVideo: !!afterMedia.videoUrl,
    photoVisible: !!perRoundState.mediaQuestionPhotoVisible,
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
    const questionMedia = getThreeSixNineMediaUrls(q, 'question');
    const afterMedia = getThreeSixNineMediaUrls(q, 'after');
    
    let controlsHTML = `
      <button onclick="nextThreeSixNineQuestion()" id="roundNextQuestionBtn">Volgende vraag (N)</button>
        <button onclick="klok369_toggleLoop()" id="playKlok369" class="secondary" style="background:#E2904A">
            Klok (K) <span id="klok369Timer" style="margin-left:8px;font-weight:bold">${klok369ElapsedSeconds}s</span>
        </button>
    `;
    
    // Vraagmedia knoppen
    if (questionMedia.photoUrl) {
        controlsHTML += `
        <button onclick="toggleThreeSixNinePhoto('question')" id="toggleQuestionPhotoBtn" class="secondary" style="background:#4A90E2">
          📷 Vraagfoto tonen/verbergen (Q)
            </button>
        `;
    }

    if (questionMedia.audioUrl) {
        controlsHTML += `
        <button onclick="playThreeSixNineAudio('question')" id="playQuestionAudioBtn" class="secondary" style="background:#E24A90">
          ${perRoundState.mediaQuestionAudioPlaying ? '⏹️ Vraagaudio stoppen (W)' : '🔊 Vraagaudio afspelen (W)'}
        </button>
      `;
    }

    if (questionMedia.videoUrl) {
      controlsHTML += `
        <button onclick="playThreeSixNineVideo('question')" id="playQuestionVideoBtn" class="secondary" style="background:#6b4ae2">
          ${perRoundState.mediaQuestionVideoPlaying ? '⏹️ Vraagvideo stoppen (E)' : '🎬 Vraagvideo fullscreen (E)'}
        </button>
      `;
    }

    // Na-vraagmedia knoppen
    if (afterMedia.photoUrl) {
      controlsHTML += `
        <button onclick="toggleThreeSixNinePhoto('after')" id="toggleAfterPhotoBtn" class="secondary" style="background:#2f7ecf">
          📷 Na-vraag foto tonen/verbergen (A)
        </button>
      `;
    }

    if (afterMedia.audioUrl) {
      controlsHTML += `
        <button onclick="playThreeSixNineAudio('after')" id="playAfterAudioBtn" class="secondary" style="background:#cc3f82">
          ${perRoundState.mediaAfterAudioPlaying ? '⏹️ Na-vraag audio stoppen (S)' : '🔊 Na-vraag audio afspelen (S)'}
        </button>
      `;
    }

    if (afterMedia.videoUrl) {
      controlsHTML += `
        <button onclick="playThreeSixNineVideo('after')" id="playAfterVideoBtn" class="secondary" style="background:#5b3ad6">
          ${perRoundState.mediaAfterVideoPlaying ? '⏹️ Na-vraag video stoppen (D)' : '🎬 Na-vraag video fullscreen (D)'}
            </button>
        `;
    }
    
    // Goed/Fout knoppen voor alle types behalve doe en estimation
    if (qType !== 'doe' && qType !== 'estimation') {
        controlsHTML += `
        <button onclick="markThreeSixNineAnswer(true); playSFX('SFX/goed.mp3');" id="roundMarkRightBtn">Goed (G)</button>
        <button onclick="markThreeSixNineAnswer(false); playSFX('SFX/fout.mp3');" id="roundMarkWrongBtn">Fout (F)</button>
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
function toggleThreeSixNinePhoto(phase = 'question') {
    const q = perRoundState.currentQuestion;
  if (!q) return;

  const media = getThreeSixNineMediaUrls(q, phase);
  if (!media.photoUrl) return;

  const visibilityKey = phase === 'after' ? 'mediaAfterPhotoVisible' : 'mediaQuestionPhotoVisible';
  perRoundState[visibilityKey] = !perRoundState[visibilityKey];
    
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
    activeMediaPhase: phase,
    photoUrl: media.photoUrl,
        photoVisible: !!perRoundState[visibilityKey],
        players
    });
    
  flash(perRoundState[visibilityKey] ? 'Foto getoond' : 'Foto verborgen');
}

// Audio afspelen
function playThreeSixNineAudio(phase = 'question') {
    const q = perRoundState.currentQuestion;
  console.log('🎵 playThreeSixNineAudio aangeroepen met vraag:', q, 'fase:', phase);
    
  const media = getThreeSixNineMediaUrls(q, phase);
  if (!q || !media.audioUrl) {
    console.warn('❌ Geen vraag of audioUrl gevonden:', { q, audioUrl: media.audioUrl, phase });
        return;
    }
    
    const activePlayerName = players[activePlayerIndex]?.name || '-';

    const playingKey = phase === 'after' ? 'mediaAfterAudioPlaying' : 'mediaQuestionAudioPlaying';
    const isAlreadyPlaying = !!perRoundState[playingKey];

    if (isAlreadyPlaying) {
      perRoundState.mediaQuestionAudioPlaying = false;
      perRoundState.mediaAfterAudioPlaying = false;

      sendDisplayUpdate({
        type: 'update',
        currentRoundName: 'threeSixNine',
        action: 'stopAudio',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: activePlayerName,
        activeIndex: activePlayerIndex,
        activeMediaPhase: phase,
        players
      });

      renderThreeSixNineControls();
      flash('Audio gestopt.');
      return;
    }

    perRoundState.mediaQuestionAudioPlaying = false;
    perRoundState.mediaAfterAudioPlaying = false;
    perRoundState[playingKey] = true;
    
    console.log('📤 Versturen audio update naar display:', media.audioUrl);
    
    // Stuur alleen naar display - audio speelt ALLEEN op display.html
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
        activeMediaPhase: phase,
        audioUrl: media.audioUrl,
        players
    });
    
      renderThreeSixNineControls();
    flash('Audio wordt afgespeeld op display...');
    // NIET op host afspelen: playSFX() verwijderd
}

function playThreeSixNineVideo(phase = 'question') {
    const q = perRoundState.currentQuestion;
    const media = getThreeSixNineMediaUrls(q, phase);
    if (!q || !media.videoUrl) {
      return;
    }

    const activePlayerName = players[activePlayerIndex]?.name || '-';

    const playingKey = phase === 'after' ? 'mediaAfterVideoPlaying' : 'mediaQuestionVideoPlaying';
    const isAlreadyPlaying = !!perRoundState[playingKey];

    if (isAlreadyPlaying) {
      perRoundState.mediaQuestionVideoPlaying = false;
      perRoundState.mediaAfterVideoPlaying = false;

      sendDisplayUpdate({
        type: 'update',
        currentRoundName: 'threeSixNine',
        action: 'stopVideo',
        questionType: q.type || 'classic',
        currentQuestionDisplay: q.text,
        currentQuestionIndex: currentQuestionIndex,
        maxQuestions: perRoundState.max,
        activePlayer: activePlayerName,
        activeIndex: activePlayerIndex,
        activeMediaPhase: phase,
        players
      });

      renderThreeSixNineControls();
      flash('Video gestopt.');
      return;
    }

    perRoundState.mediaQuestionVideoPlaying = false;
    perRoundState.mediaAfterVideoPlaying = false;
    perRoundState[playingKey] = true;

    sendDisplayUpdate({
      type: 'update',
      currentRoundName: 'threeSixNine',
      action: 'playVideo',
      questionType: q.type || 'classic',
      currentQuestionDisplay: q.text,
      currentQuestionIndex: currentQuestionIndex,
      maxQuestions: perRoundState.max,
      activePlayer: activePlayerName,
      activeIndex: activePlayerIndex,
      activeMediaPhase: phase,
      videoUrl: media.videoUrl,
      players
    });

    renderThreeSixNineControls();
    flash('Video wordt fullscreen afgespeeld op display...');
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